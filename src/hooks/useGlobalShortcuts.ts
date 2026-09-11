import { useEffect, useRef } from 'react';
import { GameMode } from '../constants';

interface GlobalShortcutsProps {
  mode: GameMode;
  isPaused: boolean;
  togglePause: () => void;
  modals: any; // В идеале типизировать интерфейсом UseGameModalsReturn
  handleSpawnConfirm: () => void;
  setShowBTPanel: React.Dispatch<React.SetStateAction<boolean>>;
  onUndo?: () => void;
  onRedo?: () => void;
}

export const useGlobalShortcuts = (props: GlobalShortcutsProps) => {
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
      ) {
        return; // Игнорируем нажатия при вводе текста
      }

      const { mode, togglePause, modals, handleSpawnConfirm, setShowBTPanel, onUndo, onRedo } =
        propsRef.current;

      // Обработка Esc и Enter для модалок
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (modals.isEditModalOpen) modals.closeAllEditModals();
        else if (modals.isModalOpen) modals.closeSpawnModal();
        else if (modals.isItemSpawnModalOpen) modals.closeItemSpawnModal();
        else if (modals.isZoneSpawnModalOpen) modals.closeZoneSpawnModal();
        return;
      }

      if (e.key === 'Enter' || e.code === 'Enter') {
        if (modals.isModalOpen) {
          e.preventDefault();
          handleSpawnConfirm();
        }
        return;
      }

      // Если открыта любая модалка, блокируем остальные хоткеи
      if (
        modals.isModalOpen ||
        modals.isItemSpawnModalOpen ||
        modals.isZoneSpawnModalOpen ||
        modals.isEditModalOpen
      ) {
        return;
      }

      // Быстрые клавиши отмены и повтора (Undo / Redo)
      if (mode === GameMode.EDITOR && (e.ctrlKey || e.metaKey)) {
        if (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            if (onRedo) onRedo();
          } else {
            if (onUndo) onUndo();
          }
          return;
        }

        if (e.code === 'KeyY' || e.key.toLowerCase() === 'y') {
          e.preventDefault();
          if (onRedo) onRedo();
          return;
        }
      }

      // Пауза (Пробел)
      if (e.code === 'Space' || e.key === ' ') {
        if (mode === GameMode.SIMULATION) {
          e.preventDefault();
          togglePause();
        }
        return;
      }

      // Быстрые клавиши интерфейса
      if (
        e.code === 'Delete' ||
        e.key === 'Delete' ||
        e.code === 'Backspace' ||
        e.key === 'Backspace'
      ) {
        if (mode === GameMode.EDITOR) {
          e.preventDefault();
          handleSpawnConfirm(); // fallback
          if (modals.handleDeleteEntity) modals.handleDeleteEntity();
        }
      } else if (e.code === 'KeyU' || e.key.toLowerCase() === 'u') {
        if (mode !== GameMode.GAME) {
          setShowBTPanel((prev: boolean) => !prev);
        }
        e.preventDefault();
      } else if (e.ctrlKey && (e.code === 'KeyB' || e.key.toLowerCase() === 'b')) {
        if (mode === GameMode.EDITOR) modals.openSpawnModal('AttackerTree');
        e.preventDefault();
      } else if (e.ctrlKey && (e.code === 'KeyP' || e.key.toLowerCase() === 'p')) {
        if (mode === GameMode.EDITOR) modals.openSpawnModal('PlayerTree');
        e.preventDefault();
      } else if (e.ctrlKey && (e.code === 'KeyI' || e.key.toLowerCase() === 'i')) {
        if (mode === GameMode.EDITOR) modals.openItemSpawnModal();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
