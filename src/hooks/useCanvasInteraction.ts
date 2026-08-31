
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
      
      if (app.isPaused && mode === GameMode.EDITOR) {
        const creature = app.pickCreatureAt(point);
        if (creature) {
          app.selectCreature(creature);
          syncPlayerControls();
          updateStats();

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

    if (app.isDraggingCreature() && mode === GameMode.EDITOR) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      app.updateDraggedCreaturePosition(point);
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }

    if (app.isPaused && mode === GameMode.EDITOR && clickedCreatureIdRef.current && dragStartPosRef.current) {
      const dx = e.clientX - dragStartPosRef.current.x;
      const dy = e.clientY - dragStartPosRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        const worldPoint = app.getCanvasPoint(dragStartPosRef.current.x, dragStartPosRef.current.y);
        app.startDraggingCreature(clickedCreatureIdRef.current, worldPoint);
        return;
      }
    }

    app.pan(e.clientX, e.clientY);

    if (e.buttons === 1) {
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }

    const point = app.getCanvasPoint(e.clientX, e.clientY);
    const creature = app.pickCreatureAt(point);
    e.currentTarget.style.cursor = creature ? 'pointer' : 'grab';
  };

  const handleMouseUp = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (e.button !== 0 || !app) return;

    if (app.isDraggingCreature() && mode === GameMode.EDITOR) {
      app.endCreatureDrag();
      updateStats();
      clickedCreatureIdRef.current = null;
      dragStartPosRef.current = null;

      const point = app.getCanvasPoint(e.clientX, e.clientY);
      const creature = app.pickCreatureAt(point);
      e.currentTarget.style.cursor = creature ? 'pointer' : 'grab';
      return;
    }

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
      
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      const creature = app.pickCreatureAt(point);
      e.currentTarget.style.cursor = creature ? 'pointer' : 'grab';
      return;
    }

    const wasDragging = app.endPan();
    if (!wasDragging && !app.isPaused) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      app.selectCreature(app.pickCreatureAt(point));
      syncPlayerControls();
      updateStats();
    } else if (!wasDragging && app.isPaused && mode !== GameMode.EDITOR) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      app.selectCreature(app.pickCreatureAt(point));
      syncPlayerControls();
      updateStats();
    }

    const point = app.getCanvasPoint(e.clientX, e.clientY);
    const creature = app.pickCreatureAt(point);
    e.currentTarget.style.cursor = creature ? 'pointer' : 'grab';
  };

  const handleMouseLeave = () => {
    const app = appRef.current;
    if (app?.isDraggingCreature()) {
      app.cancelCreatureDrag();
    }
    appRef.current?.endPan();
    clickedCreatureIdRef.current = null;
    dragStartPosRef.current = null;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'default';
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