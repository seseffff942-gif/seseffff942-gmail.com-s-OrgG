import { useEffect, useRef } from 'react';

interface ModalEntry {
  id: string;
  onClose: () => void;
}

const modalStack: ModalEntry[] = [];
let isPopstateHandling = false;

// Listener global de popstate para capturar el botón o gesto atrás de Android
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (modalStack.length > 0) {
      isPopstateHandling = true;
      const topModal = modalStack.pop();
      if (topModal) {
        try {
          topModal.onClose();
        } catch (err) {
          console.error('[modalBackHandler] Error cerrando modal con botón atrás:', err);
        }
      }
      setTimeout(() => {
        isPopstateHandling = false;
      }, 80);
    }
  });
}

/**
 * Hook para interceptar el botón y gesto de atrás en Android (PWA / APK).
 * Cierra el modal actual suavemente en vez de salir de la aplicación o saltar de pantalla.
 */
export function useModalBackHandler(isOpen: boolean, onClose: () => void, modalName = 'modal') {
  const modalIdRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen) return;

    const id = `${modalName}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    modalIdRef.current = id;

    // Empujamos una entrada al historial de navegación para que Android no cierre la APK
    try {
      window.history.pushState({ isModal: true, modalId: id }, '');
    } catch (e) {
      // Ignorar si el navegador restringe pushState
    }

    const entry: ModalEntry = {
      id,
      onClose: () => onCloseRef.current()
    };
    modalStack.push(entry);

    return () => {
      const index = modalStack.findIndex(m => m.id === id);
      if (index !== -1) {
        modalStack.splice(index, 1);
        // Si el modal fue cerrado por el usuario (ej. botón X o cancelar) y NO por el botón atrás de Android,
        // revertimos el estado en el historial para mantener la pila limpia.
        if (!isPopstateHandling) {
          try {
            window.history.back();
          } catch (e) {
            // Ignorar
          }
        }
      }
      modalIdRef.current = null;
    };
  }, [isOpen, modalName]);
}

