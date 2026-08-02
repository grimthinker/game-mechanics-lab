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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Устанавливаем начальный курсор 'grab' при монтировании, если канвас в фокусе
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
      app.startPan(e.clientX, e.clientY);
      e.currentTarget.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (!app) return;

    app.pan(e.clientX, e.clientY);

    // Если зажата левая кнопка мыши (идёт перемещение камеры / панорамирование)
    if (e.buttons === 1) {
      e.currentTarget.style.cursor = 'grabbing';
      return;
    }

    // Проверяем, находится ли под курсором существо
    const point = app.getCanvasPoint(e.clientX, e.clientY);
    const creature = app.pickCreatureAt(point);

    if (creature) {
      e.currentTarget.style.cursor = 'pointer';
    } else {
      e.currentTarget.style.cursor = 'grab';
    }
  };

  const handleMouseUp = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (e.button !== 0 || !app) return;

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
      
      // Корректно возвращаем курсор после отпускания мыши
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      const creature = app.pickCreatureAt(point);
      e.currentTarget.style.cursor = creature ? 'pointer' : 'grab';
      return;
    }

    const wasDragging = app.endPan();
    if (!wasDragging) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      app.selectCreature(app.pickCreatureAt(point));
      syncPlayerControls();
      updateStats();
    }

    // Корректно возвращаем курсор после отпускания мыши
    const point = app.getCanvasPoint(e.clientX, e.clientY);
    const creature = app.pickCreatureAt(point);
    e.currentTarget.style.cursor = creature ? 'pointer' : 'grab';
  };

  const handleMouseLeave = () => {
    appRef.current?.endPan();
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