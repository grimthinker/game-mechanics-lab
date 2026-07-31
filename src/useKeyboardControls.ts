import { useRef, useEffect, useCallback, MutableRefObject } from 'react';
import { GameApp } from './GameApp';
import { Creature } from './Creature';

interface UseKeyboardControlsProps {
  appRef: MutableRefObject<GameApp | null>;
  isModalOpen: boolean;
  isEditModalOpen: boolean;
  updateStats: () => void;
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

    const candidate = app.selectedCreature?.type === 'player' ? app.selectedCreature : null;
    const player = candidate && candidate.isAlive && candidate.hp > 0 ? candidate : null;
    const controlled = controlledCreatureRef.current;

    if (controlled && controlled !== player) {
      controlled.stopMovingForward();
      controlled.stopTurning();
      controlled.stopRunning();
      controlled.stopCrouching();
    }

    controlledCreatureRef.current = player;
    if (!player) return;

    const keys = keysPressedRef.current;
    if (keys.has('w')) {
      player.startMovingForward();
    } else {
      player.stopMovingForward();
    }

    if (keys.has('a') && !keys.has('d')) {
      player.startTurning(-1);
    } else if (keys.has('d') && !keys.has('a')) {
      player.startTurning(1);
    } else {
      player.stopTurning();
    }

    if (keys.has('shift')) {
      player.startRunning();
    } else {
      player.stopRunning();
    }

    if (keys.has('c')) {
      player.startCrouching();
    } else {
      player.stopCrouching();
    }
  }, [appRef]);

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
        const player = controlledCreatureRef.current;
        if (player && player.isAlive && player.hp > 0) {
          player.attack();
          updateStats();
        }
        e.preventDefault();
        return;
      }

      if (!CONTROL_KEYS.has(key) || keysPressedRef.current.has(key)) return;

      keysPressedRef.current.add(key);
      syncPlayerControls();
      e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const key = getKeyName(e);
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
  }, [isModalOpen, isEditModalOpen, syncPlayerControls, updateStats]);

  return { syncPlayerControls };
};