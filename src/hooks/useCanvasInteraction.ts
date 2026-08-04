import { useRef, useEffect, MutableRefObject, Dispatch, SetStateAction, MouseEvent as ReactMouseEvent } from 'react';
import { GameApp } from '../GameApp';
import { CreatureType, StandardRadius } from '../ecs/types';

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
}

export const useCanvasInteraction = ({
  appRef,
  placementConfig,
  setPlacementConfig,
  syncPlayerControls,
  updateStats,
}: UseCanvasInteractionProps) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Рефы для отслеживания потенциального перетаскивания существа на паузе
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
      
      // Если игра на паузе, проверяем клик по существу
      if (app.isPaused) {
        const creature = app.pickCreatureAt(point);
        if (creature) {
          // 1. Сразу выбираем существо (чтобы открывались его статы/инвентарь)
          app.selectCreature(creature);
          syncPlayerControls();
          updateStats();

          // 2. Запоминаем для возможного старта перетаскивания при движении мыши
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

    // Если перетаскивание уже активировано
    if (app.isDraggingCreature()) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      app.updateDraggedCreaturePosition(point);
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }

    // Если на паузе зажали кнопку на существе и сдвинули мышь больше чем на 5 пикселей — начинаем перетаскивание
    if (app.isPaused && clickedCreatureIdRef.current && dragStartPosRef.current) {
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

    // Если процесс перетаскивания был активен и мы отпустили кнопку мыши
    if (app.isDraggingCreature()) {
      app.endCreatureDrag();
      updateStats();
      clickedCreatureIdRef.current = null;
      dragStartPosRef.current = null;

      const point = app.getCanvasPoint(e.clientX, e.clientY);
      const creature = app.pickCreatureAt(point);
      e.currentTarget.style.cursor = creature ? 'pointer' : 'grab';
      return;
    }

    // Очищаем временные рефы клика
    clickedCreatureIdRef.current = null;
    dragStartPosRef.current = null;

    if (placementConfig) {
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
    // В обычном режиме клик выбирает существо. В режиме паузы существо уже выбрано в момент mouseDown.
    if (!wasDragging && !app.isPaused) {
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