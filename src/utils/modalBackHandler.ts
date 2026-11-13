import { useEffect, useRef } from 'react';

interface ModalEntry {
  id: string;
  onClose: () => void;
}

const modalStack: ModalEntry[] = [];
let isPopstateHandling = false;
let programmaticBackCount = 0;

/**
 * Cierra el modal superior si existe alguno abierto.
 * Usado por el botón atrás nativo de Android (MainActivity) y popstate.
 */
export function closeTopModalIfAny(): boolean {
  if (modalStack.length === 0) return false;
  const topModal = modalStack.pop();
  if (topModal) {
    try {
      topModal.onClose();
    } catch (err) {
      console.error('[modalBackHandler] Error cerrando modal:', err);
    }
  }
  return true;
}

export function hasOpenModal(): boolean {
  return modalStack.length > 0;
}

export function isHandlingModalPopstate(): boolean {
  return isPopstateHandling || programmaticBackCount > 0 || modalStack.length > 0;
}

// Listener global de popstate para capturar el botón o gesto atrás de Android
if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    if (programmaticBackCount > 0) {
      programmaticBackCount = Math.max(0, programmaticBackCount - 1);
      isPopstateHandling = true;
      setTimeout(() => {
        if (programmaticBackCount === 0) {
          isPopstateHandling = false;
        }
      }, 150);
      return;
    }
    if (modalStack.length > 0) {
      isPopstateHandling = true;
      closeTopModalIfAny();
      setTimeout(() => {
        isPopstateHandling = false;
      }, 150);
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
        // Solo revertir history.back() si el estado actual del historial corresponde exactamente a este modal
        if (
          !isPopstateHandling &&
          typeof window !== 'undefined' &&
          window.history.state?.isModal === true &&
          window.history.state?.modalId === id
        ) {
          programmaticBackCount++;
          isPopstateHandling = true;
          try {
            window.history.back();
          } catch (e) {
            programmaticBackCount = Math.max(0, programmaticBackCount - 1);
            isPopstateHandling = false;
          }
          setTimeout(() => {
            if (programmaticBackCount > 0) {
              programmaticBackCount = 0;
            }
            isPopstateHandling = false;
          }, 350);
        }
      }
      modalIdRef.current = null;
    };
  }, [isOpen, modalName]);
}

