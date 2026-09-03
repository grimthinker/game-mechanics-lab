import { useRef, useEffect, MutableRefObject, Dispatch, SetStateAction, MouseEvent as ReactMouseEvent } from 'react';
import { GameApp } from '../GameApp';
import { GameMode } from '../constants';
import { PlacementMode } from '../types';

interface UseCanvasInteractionProps {
  appRef: MutableRefObject<GameApp | null>;
  placementMode: PlacementMode | null;
  setPlacementMode: Dispatch<SetStateAction<PlacementMode | null>>;
  syncPlayerControls: () => void;
  updateStats: () => void;
  mode: GameMode;
}

export const useCanvasInteraction = ({
  appRef,
  placementMode,
  setPlacementMode,
  syncPlayerControls,
  updateStats,
  mode,
}: UseCanvasInteractionProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const clickedEntityIdRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.cursor = placementMode ? 'pointer' : 'grab';

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      appRef.current?.zoomAt(e.clientX, e.clientY, e.deltaY);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [placementMode]);

  const handleMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (e.button === 0 && app) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);

      if (!placementMode && app.isPaused && mode === GameMode.EDITOR) {
        const entityId = app.pickEntityAt(point);
        if (entityId) {
          clickedEntityIdRef.current = entityId;
          dragStartPosRef.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.style.cursor = 'grabbing';
          return;
        }
      }

      clickedEntityIdRef.current = null;
      dragStartPosRef.current = null;
      app.startPan(e.clientX, e.clientY);
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (!app) return;

    const point = app.getCanvasPoint(e.clientX, e.clientY);

    let isHoveringEntity = false;
    if (placementMode) {
      app.hoverEntity(null);
    } else {
      const nearestId = app.pickNearestEntity(point);
      app.hoverEntity(nearestId);
      isHoveringEntity = nearestId !== null;
    }

    if (app.isDraggingEntity() && mode === GameMode.EDITOR) {
      app.updateDraggedEntityPosition(point);
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }

    if (app.isPaused && mode === GameMode.EDITOR && clickedEntityIdRef.current && dragStartPosRef.current) {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        const clickWorldPoint = app.getCanvasPoint(dragStartPosRef.current.x, dragStartPosRef.current.y);
        app.startDraggingEntity(clickedEntityIdRef.current, clickWorldPoint);
        app.updateDraggedEntityPosition(point);
        e.currentTarget.style.cursor = 'grabbing';
        return;
      }
    }

    app.pan(e.clientX, e.clientY);

    if (e.buttons === 1) {
      e.currentTarget.style.cursor = 'grabbing';
    } else if (placementMode || isHoveringEntity) {
      e.currentTarget.style.cursor = 'pointer';
    } else {
      e.currentTarget.style.cursor = 'grab';
    }
  };

  const handleMouseUp = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (e.button !== 0 || !app) return;

    const point = app.getCanvasPoint(e.clientX, e.clientY);

    if (app.isDraggingEntity() && mode === GameMode.EDITOR) {
      app.endEntityDrag();
      app.endPan();
      updateStats();
      clickedEntityIdRef.current = null;
      dragStartPosRef.current = null;

      const nearestId = app.pickNearestEntity(point);
      e.currentTarget.style.cursor = nearestId ? 'pointer' : 'grab';
      return;
    }

    const hadClickedEntity = clickedEntityIdRef.current;
    clickedEntityIdRef.current = null;
    dragStartPosRef.current = null;

    if (placementMode && mode === GameMode.EDITOR) {
      const wasDragging = app.endPan();
      if (!wasDragging) {
        if (placementMode.kind === 'creature') {
          const config = placementMode.config;
          app.spawnCreature(
            config,
            point
          );
        } else if (placementMode.kind === 'item') {
          app.spawnWorldItem(placementMode.itemData, point, placementMode.isSolid, placementMode.radius);
        }
        setPlacementMode(null);
        syncPlayerControls();
        updateStats();
      }

      const nearestId = app.pickNearestEntity(point);
      e.currentTarget.style.cursor = nearestId ? 'pointer' : 'grab';
      return;
    }

    if (hadClickedEntity && mode === GameMode.EDITOR && app.isPaused) {
      const entityId = app.pickEntityAt(point);
      app.selectEntity(entityId);
      syncPlayerControls();
      updateStats();

      const nearestId = app.pickNearestEntity(point);
      e.currentTarget.style.cursor = nearestId ? 'pointer' : 'grab';
      return;
    }

    const wasDragging = app.endPan();
    if (!wasDragging) {
      const targetEntityId = app.pickNearestEntity(point);
      app.selectEntity(targetEntityId);
      syncPlayerControls();
      updateStats();
    }

    const nearestId = app.pickNearestEntity(point);
    e.currentTarget.style.cursor = placementMode || nearestId ? 'pointer' : 'grab';
  };

  const handleMouseLeave = () => {
    const app = appRef.current;
    if (app) {
      if (app.isDraggingEntity()) {
        app.cancelEntityDrag();
      }
      app.endPan();
      app.hoverEntity(null);
    }
    clickedEntityIdRef.current = null;
    dragStartPosRef.current = null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = placementMode ? 'pointer' : 'grab';
    }
  };

  return {
    canvasRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
};