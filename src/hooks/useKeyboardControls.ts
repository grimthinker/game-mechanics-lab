import { useEffect, useCallback } from 'react';
import { GameMode } from '../constants';
import { GlobalInput } from '../input/GlobalInput';

interface UseKeyboardControlsProps {
  isModalOpen: boolean;
  isEditModalOpen: boolean;
  mode: GameMode;
}

const CONTROL_KEYS = new Set(['w', 'a', 's', 'd', 'shift', 'c']);

const getKeyName = (e: KeyboardEvent): string => {
  switch (e.code) {
    case 'KeyW': return 'w';
    case 'KeyA': return 'a';
    case 'KeyS': return 's';
    case 'KeyD': return 'd';
    case 'ShiftLeft':
    case 'ShiftRight': return 'shift';
    case 'KeyC': return 'c';
    case 'Space': return ' ';
    default: return e.key.toLowerCase();
  }
};

export const useKeyboardControls = ({
  isModalOpen,
  isEditModalOpen,
  mode,
}: UseKeyboardControlsProps) => {

  const syncPlayerControls = useCallback(() => {
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
      if (isModalOpen || isEditModalOpen || isTextInputTarget(e.target)) return;
      const key = getKeyName(e);
      if (key === ' ' || e.code === 'Space') {
        if (!e.ctrlKey && !e.metaKey && mode === GameMode.GAME) {
            GlobalInput.keys.add(' ');
            e.preventDefault();
            return;
        }
      }

      if (!CONTROL_KEYS.has(key) || GlobalInput.keys.has(key)) return;

      GlobalInput.keys.add(key);
      e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = getKeyName(e);
      if (!CONTROL_KEYS.has(key)) return;

      GlobalInput.keys.delete(key);
    };

    const onBlur = () => {
      GlobalInput.keys.clear();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isModalOpen, isEditModalOpen, mode]);

  return { syncPlayerControls };
};