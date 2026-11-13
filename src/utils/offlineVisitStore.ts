/**
 * Persistent IndexedDB store for offline client visits (including Base64 photos
 * and frozen GPS coordinates). Migrates any legacy `offline_client_visits`
 * entries from localStorage so localStorage never hits its ~5 MB quota.
 */

const DB_NAME = 'agricovet_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'offline_visits';
const LEGACY_STORAGE_KEY = 'offline_client_visits';
export const OFFLINE_VISITS_CHANGED_EVENT = 'offline-visits-changed';

export const notifyOfflineVisitsChanged = (): void => {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(OFFLINE_VISITS_CHANGED_EVENT));
  }
};

const getVisitKey = (visit: any): string =>
  String(visit?.offlineId || visit?.id || `VISIT_OFFLINE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

const openOfflineDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'queueKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
};

const readLegacyQueue = (): any[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const clearLegacyQueue = (): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // ignore
  }
};

const sortNewestFirst = (list: any[]): any[] =>
  [...list].sort((a, b) => {
    const ta = new Date(a?.capturedAt || a?.createdAt || 0).getTime();
    const tb = new Date(b?.capturedAt || b?.createdAt || 0).getTime();
    return tb - ta;
  });

/**
 * Returns all pending offline visits from IndexedDB, automatically migrating
 * any legacy localStorage items on first read.
 */
export const getOfflineVisitQueue = async (): Promise<any[]> => {
  const legacyItems = readLegacyQueue();
  try {
    const db = await openOfflineDb();
    if (legacyItems.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        for (const item of legacyItems) {
          const queueKey = getVisitKey(item);
          store.put({ ...item, queueKey });
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      clearLegacyQueue();
    }

    const rows = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : []);
      req.onerror = () => reject(req.error);
    });
    return sortNewestFirst(rows);
  } catch {
    return sortNewestFirst(legacyItems);
  }
};

/**
 * Persists a single offline visit into IndexedDB (with localStorage fallback
 * only when IndexedDB is unavailable) and returns the updated queue.
 */
export const enqueueOfflineVisit = async (visit: any): Promise<any[]> => {
  const queueKey = getVisitKey(visit);
  const record = { ...visit, queueKey };

  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error('Error guardando visita offline en IndexedDB'));
    });
    const updated = await getOfflineVisitQueue();
    notifyOfflineVisitsChanged();
    return updated;
  } catch (idbErr) {
    if (typeof localStorage !== 'undefined') {
      const current = readLegacyQueue().filter(v => getVisitKey(v) !== queueKey);
      const next = [record, ...current];
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(next));
      notifyOfflineVisitsChanged();
      return next;
    }
    throw idbErr;
  }
};

/**
 * Removes a successfully synced offline visit by id or offlineId.
 */
export const removeOfflineVisit = async (idOrOfflineId: string): Promise<void> => {
  const targetKey = String(idOrOfflineId || '');
  if (!targetKey) return;

  try {
    const db = await openOfflineDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        for (const row of rows) {
          if (row.queueKey === targetKey || row.id === targetKey || row.offlineId === targetKey) {
            store.delete(row.queueKey);
          }
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    notifyOfflineVisitsChanged();
  } catch {
    if (typeof localStorage !== 'undefined') {
      const current = readLegacyQueue().filter(
        v => v?.id !== targetKey && v?.offlineId !== targetKey && v?.queueKey !== targetKey
      );
      localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(current));
      notifyOfflineVisitsChanged();
    }
  }
};

export const getOfflineVisitCount = async (): Promise<number> => {
  const queue = await getOfflineVisitQueue();
  return queue.length;
};

