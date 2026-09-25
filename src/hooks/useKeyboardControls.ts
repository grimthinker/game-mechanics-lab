import { useEffect, useCallback } from 'react';
import { GlobalInput } from '../input/GlobalInput';
import { GameMode } from '../config/gameConfig';

interface UseKeyboardControlsProps {
  isModalOpen: boolean;
  isEditModalOpen: boolean;
  mode: GameMode;
}

const CONTROL_KEYS = new Set(['w', 'a', 's', 'd', 'shift', 'c', 'v', 'x', ' ', 'f', 'g']);

const getKeyName = (e: KeyboardEvent): string => {
  switch (e.code) {
    case 'KeyW':
      return 'w';
    case 'KeyA':
      return 'a';
    case 'KeyS':
      return 's';
    case 'KeyD':
      return 'd';
    case 'KeyF':
      return 'f';
    case 'KeyG':
      return 'g';
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'shift';
    case 'KeyC':
      return 'c';
    case 'KeyV':
      return 'v';
    case 'KeyX':
      return 'x';
    case 'Space':
      return ' ';
    default:
      return e.key.toLowerCase();
  }
};

export const useKeyboardControls = ({
  isModalOpen,
  isEditModalOpen,
  mode,
}: UseKeyboardControlsProps) => {
  // Стабильная ссылка: очистка ввода безопасна в любой момент
  const syncPlayerControls = useCallback(() => {
    GlobalInput.keys.clear();
  }, []);

  // Автоматический сброс зажатых клавиш при открытии любого модального окна
  useEffect(() => {
    if (isModalOpen || isEditModalOpen) {
      GlobalInput.keys.clear();
    }
  }, [isModalOpen, isEditModalOpen]);

  useEffect(() => {
    const isTextInputTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Meta') {
        GlobalInput.keys.clear();
        return;
      }
      if (e.key === 'Escape') {
        if ((window as any).appRef && (window as any).appRef.throwTargeting) {
          (window as any).appRef.throwTargeting = null;
        }
      }
      if (isModalOpen || isEditModalOpen || isTextInputTarget(e.target)) return;
      const key = getKeyName(e);
      if (key === ' ' || e.code === 'Space') {
        if (!e.ctrlKey && !e.metaKey && mode === GameMode.GAME) {
          GlobalInput.keys.add(' ');
          e.preventDefault();
          return;
        }
      }

      if (!CONTROL_KEYS.has(key)) return;

      // Клавиша X работает в режиме тумблера (переключатель ходьбы)
      if (key === 'x') {
        if (GlobalInput.keys.has('x')) {
          GlobalInput.keys.delete('x');
        } else {
          GlobalInput.keys.add('x');
        }
        e.preventDefault();
        return;
      }

      // Клавиши C (присед) и V (лечь) работают как взаимоисключающие тумблеры положения
      if (key === 'c') {
        if (GlobalInput.keys.has('c')) {
          GlobalInput.keys.delete('c');
        } else {
          GlobalInput.keys.add('c');
          GlobalInput.keys.delete('v');
        }
        e.preventDefault();
        return;
      }

      if (key === 'v') {
        if (GlobalInput.keys.has('v')) {
          GlobalInput.keys.delete('v');
        } else {
          GlobalInput.keys.add('v');
          GlobalInput.keys.delete('c');
        }
        e.preventDefault();
        return;
      }

      if (GlobalInput.keys.has(key)) return;

      GlobalInput.keys.add(key);
      e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Meta') {
        GlobalInput.keys.clear();
        return;
      }
      const key = getKeyName(e);
      if (!CONTROL_KEYS.has(key)) return;
      // Состояние тумблеров X, C, V не сбрасывается при отпускании клавиши
      if (key === 'x' || key === 'c' || key === 'v') return;

      GlobalInput.keys.delete(key);
    };

    const onBlur = () => {
      GlobalInput.keys.clear();
    };

    const onContextMenu = () => {
      GlobalInput.keys.clear();
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        GlobalInput.keys.clear();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    window.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [isModalOpen, isEditModalOpen, mode]);

  return { syncPlayerControls };
};
