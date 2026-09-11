import { useEffect, useRef } from 'react';
import { GameMode } from '../constants';

import { GizmoTool } from '../gizmos/types';

interface GlobalShortcutsProps {
  mode: GameMode;
  isPaused: boolean;
  togglePause: () => void;
  handleDeleteEntity: () => void;
  onQuickSpawn?: (type: 'player' | 'attacker') => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onExitGame?: () => void;
  onSetGizmoTool?: (tool: GizmoTool) => void;
  onCancelGizmo?: () => boolean;
  onClosePieMenu?: () => boolean;
}

export const useGlobalShortcuts = (props: GlobalShortcutsProps) => {
  const propsRef = useRef(props);
  propsRef.current = props;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Предотвращаем фокус меню браузера по нажатию на Alt
      if (e.key === 'Alt') {
        e.preventDefault();
      }

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
      ) {
        return; // Игнорируем нажатия при вводе текста
      }

      const {
        mode,
        togglePause,
        handleDeleteEntity,
        onQuickSpawn,
        onUndo,
        onRedo,
        onExitGame,
        onSetGizmoTool,
        onCancelGizmo,
        onClosePieMenu,
      } = propsRef.current;

      // Закрытие радиального меню, отмена манипулятора или выход из игры по Escape
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (mode === GameMode.EDITOR && onClosePieMenu && onClosePieMenu()) {
          e.preventDefault();
          return;
        }
        if (mode === GameMode.EDITOR && onCancelGizmo && onCancelGizmo()) {
          e.preventDefault();
          return;
        }
        if (mode === GameMode.GAME && onExitGame) {
          e.preventDefault();
          onExitGame();
          return;
        }
      }

      // Переключение режима манипулятора в редакторе: Q (Select), W (Translate), E (Rotate)
      if (mode === GameMode.EDITOR && !e.ctrlKey && !e.metaKey && !e.altKey && onSetGizmoTool) {
        if (e.code === 'KeyQ' || e.key.toLowerCase() === 'q') {
          e.preventDefault();
          onSetGizmoTool('select');
          return;
        }
        if (e.code === 'KeyW' || e.key.toLowerCase() === 'w') {
          e.preventDefault();
          onSetGizmoTool('translate');
          return;
        }
        if (e.code === 'KeyE' || e.key.toLowerCase() === 'e') {
          e.preventDefault();
          onSetGizmoTool('rotate');
          return;
        }
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

      // Удаление выделенного
      if (
        e.code === 'Delete' ||
        e.key === 'Delete' ||
        e.code === 'Backspace' ||
        e.key === 'Backspace'
      ) {
        if (mode === GameMode.EDITOR) {
          e.preventDefault();
          handleDeleteEntity();
        }
        return;
      }

      // Быстрый спавн
      if (e.ctrlKey && (e.code === 'KeyP' || e.key.toLowerCase() === 'p')) {
        if (mode === GameMode.EDITOR && onQuickSpawn) {
          onQuickSpawn('player');
          e.preventDefault();
        }
      } else if (e.ctrlKey && (e.code === 'KeyB' || e.key.toLowerCase() === 'b')) {
        if (mode === GameMode.EDITOR && onQuickSpawn) {
          onQuickSpawn('attacker');
          e.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
};
