import {
  useRef,
  useEffect,
  useState,
  MutableRefObject,
  Dispatch,
  SetStateAction,
  MouseEvent as ReactMouseEvent,
} from 'react';
import { GameApp } from '../GameApp';
import { GameMode } from '../constants';
import { PlacementMode, Point } from '../types';

interface UseCanvasInteractionProps {
  appRef: MutableRefObject<GameApp | null>;
  placementMode: PlacementMode | null;
  setPlacementMode: Dispatch<SetStateAction<PlacementMode | null>>;
  syncPlayerControls: () => void;
  updateStats: () => void;
  mode: GameMode;
  typeFilters: Record<string, boolean>;
}

export const useCanvasInteraction = ({
  appRef,
  placementMode,
  setPlacementMode,
  syncPlayerControls,
  updateStats,
  mode,
  typeFilters,
}: UseCanvasInteractionProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const clickedEntityIdRef = useRef<string | null>(null);
  const isMarqueeActiveRef = useRef<boolean>(false);
  const [cursorWorldPos, setCursorWorldPos] = useState<Point | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.cursor = placementMode ? 'pointer' : 'default';

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      appRef.current?.zoomAt(e.clientX, e.clientY, e.deltaY);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [placementMode]);

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const app = appRef.current;
    if (!app) return;

    // Панорамирование камеры на СКМ (колесико мыши)
    if (e.button === 1) {
      e.preventDefault();
      app.startPan(e.clientX, e.clientY);
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }

    // Действия на ЛКМ
    if (e.button === 0) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);

      // В режиме игры: подбор предмета через Ctrl+ЛКМ
      if (mode === GameMode.GAME && (e.ctrlKey || e.metaKey)) {
        const targetEntityId = app.pickNearestEntity(point);
        if (targetEntityId) {
          const itemComp = app.world.getComponent(targetEntityId, 'item');
          const tagComp = app.world.getComponent(targetEntityId, 'tag');
          const ownershipComp = app.world.getComponent(targetEntityId, 'ownership');
          const isItem = (tagComp?.archetype === 'item' || !!itemComp) && !ownershipComp;

          if (isItem) {
            const entities = app.world.getEntitiesWith('aiStats', 'health');
            const playerEnt = entities.find(
              ([, comp]) => comp.aiStats.behavior.current === 'PlayerTree' && comp.health.isAlive
            );

            if (playerEnt) {
              app.world.addComponent(playerEnt[0], 'pickupIntent', {
                targetItemId: targetEntityId,
              });
            }
          }
        }
        return;
      }

      if (placementMode) return;

      const entityId = app.pickEntityAt(point);
      if (entityId) {
        clickedEntityIdRef.current = entityId;
        dragStartPosRef.current = { x: e.clientX, y: e.clientY };
        return;
      }

      // Клик по пустому месту — начинаем рамку выделения
      clickedEntityIdRef.current = null;
      dragStartPosRef.current = null;
      isMarqueeActiveRef.current = true;
      app.startMarquee(point);
    }
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const app = appRef.current;
    if (!app) return;

    // Панорамирование камеры зажатым СКМ
    if ((e.buttons & 4) === 4) {
      app.pan(e.clientX, e.clientY);
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }

    if (mode === GameMode.GAME) {
      app.setMouseScreenPos(e.clientX, e.clientY);
    } else {
      app.setMouseScreenPos(null, null);
    }

    const point = app.getCanvasPoint(e.clientX, e.clientY);
    setCursorWorldPos({ x: Math.round(point.x), y: Math.round(point.y) });

    // Обновление рамки выделения
    if (isMarqueeActiveRef.current && (e.buttons & 1) === 1) {
      app.updateMarquee(point);
      e.currentTarget.style.cursor = 'crosshair';
      return;
    }

    // Обновление предпросмотра перемещения (Ghost Dragging)
    if (app.isDraggingEntity() && mode === GameMode.EDITOR) {
      app.updateDraggedEntityPosition(point);
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }

    // Инициализация начала драга сущности при смещении мыши > 5px
    if (
      app.isPaused &&
      mode === GameMode.EDITOR &&
      clickedEntityIdRef.current &&
      dragStartPosRef.current &&
      (e.buttons & 1) === 1
    ) {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        const clickWorldPoint = app.getCanvasPoint(
          dragStartPosRef.current.x,
          dragStartPosRef.current.y
        );
        app.startDraggingEntity(clickedEntityIdRef.current, clickWorldPoint);
        app.updateDraggedEntityPosition(point);
        e.currentTarget.style.cursor = 'grabbing';
        return;
      }
    }

    // Подсветка при наведении
    let isHoveringEntity = false;
    if (placementMode) {
      app.hoverEntity(null);
    } else {
      const nearestId = app.pickNearestEntity(point);
      app.hoverEntity(nearestId);
      isHoveringEntity = nearestId !== null;
    }

    if (placementMode || isHoveringEntity) {
      e.currentTarget.style.cursor = 'pointer';
    } else {
      e.currentTarget.style.cursor = 'default';
    }
  };

  const handleMouseUp = (e: ReactMouseEvent<HTMLDivElement>) => {
    const app = appRef.current;
    if (!app) return;

    if (e.button === 1) {
      app.endPan();
      e.currentTarget.style.cursor = 'default';
      return;
    }

    if (e.button !== 0) return;

    const point = app.getCanvasPoint(e.clientX, e.clientY);

    // Завершение перемещения группы
    if (app.isDraggingEntity() && mode === GameMode.EDITOR) {
      app.endEntityDrag();
      updateStats();
      clickedEntityIdRef.current = null;
      dragStartPosRef.current = null;
      const nearestId = app.pickNearestEntity(point);
      e.currentTarget.style.cursor = nearestId ? 'pointer' : 'default';
      return;
    }

    // Завершение рамки выделения
    if (isMarqueeActiveRef.current) {
      isMarqueeActiveRef.current = false;
      app.endMarquee(typeFilters);
      updateStats();
      e.currentTarget.style.cursor = 'default';
      return;
    }

    // Спавн сущности
    if (placementMode && mode === GameMode.EDITOR) {
      if (placementMode.kind === 'entity') {
        app.commitHistory('Спавн объекта');
        const spawnedId = app.spawnEntity(placementMode.config, point);
        app.selectEntity(spawnedId, true);
      }
      setPlacementMode(null);
      syncPlayerControls();
      updateStats();
      return;
    }

    // Одиночный клик по сущности — сбрасываем группу и выбираем только её
    if (clickedEntityIdRef.current) {
      const entityId = app.pickEntityAt(point);
      app.selectEntity(entityId, true);
      clickedEntityIdRef.current = null;
      dragStartPosRef.current = null;
      syncPlayerControls();
      updateStats();
      return;
    }

    // Одиночный клик по пустому месту — сбрасываем всё выделение
    app.selectEntity(null, true);
    syncPlayerControls();
    updateStats();
  };

  const handleMouseLeave = () => {
    const app = appRef.current;
    if (app) {
      app.setMouseScreenPos(null, null);
      if (app.isDraggingEntity()) {
        app.cancelEntityDrag();
      }
      if (isMarqueeActiveRef.current) {
        app.marqueeBox = null;
        isMarqueeActiveRef.current = false;
      }
      app.endPan();
      app.hoverEntity(null);
    }
    clickedEntityIdRef.current = null;
    dragStartPosRef.current = null;
    setCursorWorldPos(null);
  };

  return {
    containerRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    cursorWorldPos,
  };
};
