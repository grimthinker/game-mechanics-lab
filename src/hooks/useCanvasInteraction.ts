import { useRef, useEffect, MutableRefObject, Dispatch, SetStateAction, MouseEvent as ReactMouseEvent } from 'react';
import { GameApp } from '../GameApp';
import { CreatureType, StandardRadius } from '../ecs/types';
import { GameMode } from '../constants';

interface PlacementConfig {
  type: CreatureType;
  radius: StandardRadius;
  mass: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  crouchStealthMultiplier: number;
}

interface UseCanvasInteractionProps {
  appRef: MutableRefObject<GameApp | null>;
  placementConfig: PlacementConfig | null;
  setPlacementConfig: Dispatch<SetStateAction<PlacementConfig | null>>;
  syncPlayerControls: () => void;
  updateStats: () => void;
  mode: GameMode;
}

export const useCanvasInteraction = ({
  appRef,
  placementConfig,
  setPlacementConfig,
  syncPlayerControls,
  updateStats,
  mode,
}: UseCanvasInteractionProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const clickedCreatureIdRef = useRef<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.cursor = 'grab';

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      appRef.current?.zoomAt(e.clientX, e.clientY, e.deltaY);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, []);

  const handleMouseDown = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (e.button === 0 && app) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      
      if (!placementConfig && app.isPaused && mode === GameMode.EDITOR) {
        const creature = app.pickCreatureAt(point);
        if (creature) {
          clickedCreatureIdRef.current = creature.id;
          dragStartPosRef.current = { x: e.clientX, y: e.clientY };
          e.currentTarget.style.cursor = 'grabbing';
          return;
        }
      }

      clickedCreatureIdRef.current = null;
      dragStartPosRef.current = null;
      app.startPan(e.clientX, e.clientY);
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (!app) return;

    const point = app.getCanvasPoint(e.clientX, e.clientY);

    if (placementConfig) {
      app.hoverCreature(null);
    } else {
      const nearest = app.pickNearestCreature(point);
      app.hoverCreature(nearest);
    }

    if (app.isDraggingCreature() && mode === GameMode.EDITOR) {
      app.updateDraggedCreaturePosition(point);
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }

    if (app.isPaused && mode === GameMode.EDITOR && clickedCreatureIdRef.current && dragStartPosRef.current) {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        const clickWorldPoint = app.getCanvasPoint(dragStartPosRef.current.x, dragStartPosRef.current.y);
        app.startDraggingCreature(clickedCreatureIdRef.current, clickWorldPoint);
        app.updateDraggedCreaturePosition(point);
        e.currentTarget.style.cursor = 'grabbing';
        return;
      }
    }

    app.pan(e.clientX, e.clientY);

    if (e.buttons === 1) {
      e.currentTarget.style.cursor = 'grabbing';
    } else {
      e.currentTarget.style.cursor = 'grab';
    }
  };

  const handleMouseUp = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (e.button !== 0 || !app) return;

    if (app.isDraggingCreature() && mode === GameMode.EDITOR) {
      app.endCreatureDrag();
      app.endPan();
      updateStats();
      clickedCreatureIdRef.current = null;
      dragStartPosRef.current = null;
      e.currentTarget.style.cursor = 'grab';
      return;
    }

    const hadClickedCreature = clickedCreatureIdRef.current;
    clickedCreatureIdRef.current = null;
    dragStartPosRef.current = null;

    if (placementConfig && mode === GameMode.EDITOR) {
      const wasDragging = app.endPan();
      if (!wasDragging) {
        const point = app.getCanvasPoint(e.clientX, e.clientY);
        app.spawnCreature(
          placementConfig.type,
          placementConfig.radius,
          placementConfig.mass,
          placementConfig.maxSpeed,
          placementConfig.maxTurnSpeed,
          point,
          undefined,
          placementConfig.runSpeedMultiplier,
          placementConfig.crouchSpeedMultiplier,
          placementConfig.crouchStealthMultiplier,
        );
        setPlacementConfig(null);
        syncPlayerControls();
        updateStats();
      }
      e.currentTarget.style.cursor = 'grab';
      return;
    }

    if (hadClickedCreature && mode === GameMode.EDITOR && app.isPaused) {
      const creature = app.pickCreatureAt(app.getCanvasPoint(e.clientX, e.clientY));
      app.selectCreature(creature);
      syncPlayerControls();
      updateStats();
      e.currentTarget.style.cursor = 'grab';
      return;
    }

    const wasDragging = app.endPan();
    if (!wasDragging) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      const targetCreature = app.pickNearestCreature(point);
      app.selectCreature(targetCreature);
      syncPlayerControls();
      updateStats();
    }

    e.currentTarget.style.cursor = 'grab';
  };

  const handleMouseLeave = () => {
    const app = appRef.current;
    if (app) {
      if (app.isDraggingCreature()) {
        app.cancelCreatureDrag();
      }
      app.endPan();
      app.hoverCreature(null);
    }
    clickedCreatureIdRef.current = null;
    dragStartPosRef.current = null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'grab';
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