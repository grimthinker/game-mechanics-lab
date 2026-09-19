import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { GameApp } from '../GameApp';
import { TransferTarget, validateItemTransfer } from '../ecs/utils/itemValidation';
import { GameMode } from '../config/gameConfig';

export interface DragItem {
  id: string;
  name: string;
  icon: string;
  size: number;
  weight: number;
}

interface DragDropState {
  isDragging: boolean;
  dragItem: DragItem | null;
  source: TransferTarget | null;
  cursorPosition: { x: number; y: number };
  hoverTarget: TransferTarget | null;
  isValidTarget: boolean;
  isSwap: boolean;
}

interface DragDropContextValue extends DragDropState {
  startDrag: (item: DragItem, source: TransferTarget, clientX: number, clientY: number) => void;
  setHoverTarget: (target: TransferTarget | null) => void;
  cancelDrag: () => void;
  setApp: (app: GameApp | null) => void;
}

const DragDropContext = createContext<DragDropContextValue | null>(null);

export const useDragDrop = () => {
  const ctx = useContext(DragDropContext);
  if (!ctx) {
    throw new Error('useDragDrop must be used within a DragDropProvider');
  }
  return ctx;
};

export const DragDropProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DragDropState>({
    isDragging: false,
    dragItem: null,
    source: null,
    cursorPosition: { x: 0, y: 0 },
    hoverTarget: null,
    isValidTarget: false,
    isSwap: false,
  });

  // Ref для быстрого доступа внутри глобальных event listeners, чтобы избежать замыканий
  const stateRef = useRef<DragDropState>(state);
  const appRef = useRef<GameApp | null>(null);

  const setApp = useCallback((newApp: GameApp | null) => {
    appRef.current = newApp;
  }, []);

  const restoreGroundVisibility = useCallback(() => {
    const current = stateRef.current;
    const app = appRef.current;
    if (current.source?.type === 'ground' && current.dragItem && app) {
      const renderable = app.world.getComponent(current.dragItem.id, 'renderable');
      if (renderable) renderable.isVisible = true;
    }
  }, []);

  const resetDragState = useCallback(() => {
    setState((prev) => {
      const next = {
        ...prev,
        isDragging: false,
        dragItem: null,
        source: null,
        hoverTarget: null,
        isValidTarget: false,
        isSwap: false,
      };
      stateRef.current = next;
      return next;
    });
    document.body.style.cursor = '';
  }, []);

  const cancelDrag = useCallback(() => {
    restoreGroundVisibility();
    resetDragState();
  }, [restoreGroundVisibility, resetDragState]);

  const startDrag = useCallback(
    (item: DragItem, source: TransferTarget, clientX: number, clientY: number) => {
      const app = appRef.current;
      if (!app || app.gameMode !== GameMode.EDITOR) return;

      if (source.type === 'ground') {
        const renderable = app.world.getComponent(item.id, 'renderable');
        if (renderable) renderable.isVisible = false;
      }

      const nextState: DragDropState = {
        isDragging: true,
        dragItem: item,
        source,
        cursorPosition: { x: clientX, y: clientY },
        hoverTarget: null,
        isValidTarget: false,
        isSwap: false,
      };

      setState(nextState);
      stateRef.current = nextState;
      document.body.style.cursor = 'grabbing';
    },
    []
  );

  const setHoverTarget = useCallback((target: TransferTarget | null) => {
    const currentState = stateRef.current;
    const app = appRef.current;
    if (!app || !currentState.dragItem) return;

    if (!target) {
      setState((prev) => {
        const next = { ...prev, hoverTarget: null, isValidTarget: false, isSwap: false };
        stateRef.current = next;
        return next;
      });
      return;
    }

    // Валидация на лету
    const validation = validateItemTransfer(app.world, currentState.dragItem.id, target);

    setState((prev) => {
      const next = {
        ...prev,
        hoverTarget: target,
        isValidTarget: validation.valid,
        isSwap: validation.isSwap || false,
      };
      stateRef.current = next;
      return next;
    });
  }, []);

  // Гарантированный сброс курсора при любом размонтировании или смене состояния перетаскивания
  useEffect(() => {
    return () => {
      document.body.style.cursor = '';
    };
  }, [state.isDragging]);

  // Глобальные слушатели перемещения и отпускания мыши
  useEffect(() => {
    if (!state.isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      setState((prev) => {
        const next = { ...prev, cursorPosition: { x: e.clientX, y: e.clientY } };
        stateRef.current = next;
        return next;
      });
    };

    const handlePointerUp = (e: PointerEvent) => {
      const { dragItem, hoverTarget, isValidTarget } = stateRef.current;
      const app = appRef.current;
      let success = false;

      if (dragItem && hoverTarget && isValidTarget && app) {
        let finalTarget = hoverTarget;

        // Если бросаем на пол, нужно конвертировать экранные координаты в мировые
        if (finalTarget.type === 'ground') {
          const point = app.getCanvasPoint(e.clientX, e.clientY);
          finalTarget = { ...finalTarget, position: point };
        }

        success = app.itemTransfer.transferItem(dragItem.id, finalTarget);
      }

      // Если перенос не удался или был сброшен мимо цели — восстанавливаем видимость на полу
      if (!success) {
        restoreGroundVisibility();
      }

      resetDragState();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancelDrag();
      }
    };

    const handleBlur = () => {
      cancelDrag();
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, [state.isDragging, cancelDrag, restoreGroundVisibility, resetDragState]);
  return (
    <DragDropContext.Provider value={{ ...state, startDrag, setHoverTarget, cancelDrag, setApp }}>
      {children}
    </DragDropContext.Provider>
  );
};
