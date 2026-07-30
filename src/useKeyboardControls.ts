import { useRef, useEffect, useCallback, MutableRefObject } from 'react';
import { GameApp } from './GameApp';
import { Creature } from './Creature';

interface UseKeyboardControlsProps {
  appRef: MutableRefObject<GameApp | null>;
  isModalOpen: boolean;
  isEditModalOpen: boolean;
  updateStats: () => void;
}

export const useKeyboardControls = ({
  appRef,
  isModalOpen,
  isEditModalOpen,
  updateStats,
}: UseKeyboardControlsProps) => {
  const keysPressedRef = useRef<Set<string>>(new Set());
  const controlledCreatureRef = useRef<Creature | null>(null);

  const syncPlayerControls = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const player = app.selectedCreature?.type === 'player' ? app.selectedCreature : null;
    const controlled = controlledCreatureRef.current;

    if (controlled && controlled !== player) {
      controlled.stopMovingForward();
      controlled.stopTurning();
    }

    controlledCreatureRef.current = player;
    if (!player) return;

    const keys = keysPressedRef.current;
    if (keys.has('w')) player.startMovingForward();
    else player.stopMovingForward();

    if (keys.has('a')) player.startTurning(-1);
    else if (keys.has('d')) player.startTurning(1);
    else player.stopTurning();
  }, [appRef]);

  // Глобальные обработчики клавиатуры
  useEffect(() => {
    const CONTROL_KEYS = new Set(['w', 'a', 'd']);

    const isTextInputTarget = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isModalOpen || isEditModalOpen || isTextInputTarget(e.target)) return;
      const key = e.key.toLowerCase();
      if (!CONTROL_KEYS.has(key) || keysPressedRef.current.has(key)) return;

      keysPressedRef.current.add(key);
      syncPlayerControls();
      e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (!CONTROL_KEYS.has(key)) return;

      keysPressedRef.current.delete(key);
      syncPlayerControls();
    };

    const onBlur = () => {
      keysPressedRef.current.clear();
      syncPlayerControls();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, [isModalOpen, isEditModalOpen, syncPlayerControls]);

  return {
    syncPlayerControls,
  };
};