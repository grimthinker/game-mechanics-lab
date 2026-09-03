import { useEffect } from 'react';
import { GameMode } from '../constants';

interface GlobalShortcutsProps {
  mode: GameMode;
  isPaused: boolean;
  togglePause: () => void;
  modals: any; // В идеале типизировать интерфейсом UseGameModalsReturn
  handleSpawnConfirm: () => void;
  setShowBTPanel: React.Dispatch<React.SetStateAction<boolean>>;
}

export const useGlobalShortcuts = ({
  mode,
  isPaused,
  togglePause,
  modals,
  handleSpawnConfirm,
  setShowBTPanel
}: GlobalShortcutsProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return; // Игнорируем нажатия при вводе текста
      }

      // Обработка Esc и Enter для модалок
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (modals.selectedItemForEdit) modals.closeItemEditModal();
        else if (modals.isEditModalOpen) modals.closeEditModal();
        else if (modals.isModalOpen) modals.closeSpawnModal();
        else if (modals.isItemSpawnModalOpen) modals.closeItemSpawnModal();
        return;
      } 
      
      if (e.key === 'Enter' || e.code === 'Enter') {
        if (modals.isModalOpen) {
          e.preventDefault();
          handleSpawnConfirm();
        } else if (modals.isEditModalOpen) {
          e.preventDefault();
          modals.handleEditConfirm();
        }
        return;
      }

      // Если открыта любая модалка, блокируем остальные хоткеи
      if (modals.isModalOpen || modals.isItemSpawnModalOpen || modals.isEditModalOpen || modals.selectedItemForEdit) {
        return;
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
      if (e.code === 'KeyU' || e.key.toLowerCase() === 'u') {
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
  }, [mode, isPaused, togglePause, modals, handleSpawnConfirm, setShowBTPanel]);
};