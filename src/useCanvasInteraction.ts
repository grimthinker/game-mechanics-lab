import { useRef, useEffect, MutableRefObject, Dispatch, SetStateAction, MouseEvent as ReactMouseEvent } from 'react';
import { GameApp } from './GameApp';
import { CreatureType } from './types';


interface PlacementConfig {
  type: CreatureType;
  radius: number;
  mass: number;
  maxSpeed: number;
  maxTurnSpeed: number;
}

interface UseCanvasInteractionProps {
  appRef: React.MutableRefObject<GameApp | null>;
  placementConfig: PlacementConfig | null;
  setPlacementConfig: React.Dispatch<React.SetStateAction<PlacementConfig | null>>;
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

  // Обработка колеса мыши (зум)
  useEffect(() => {
    const canvas = canvasRef.current;
    const app = appRef.current;
    if (!canvas || !app) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      app.zoomAt(e.clientX, e.clientY, e.deltaY);
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      canvas.removeEventListener('wheel', onWheel);
    };
  }, [appRef]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (e.button === 0 && app) {
      app.startPan(e.clientX, e.clientY);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (appRef.current) {
      appRef.current.pan(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (e.button !== 0 || !app) return;

    // Режим выбора места для спавна
    if (placementConfig) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      app.spawnCreature(
        placementConfig.type,
        placementConfig.radius,
        placementConfig.mass,
        placementConfig.maxSpeed,
        placementConfig.maxTurnSpeed,
        point,
      );
      setPlacementConfig(null);
      app.endPan();
      syncPlayerControls();
      updateStats();
      return;
    }

    // Обычный режим: выбор существа или панорамирование
    const wasDragging = app.endPan();
    if (!wasDragging) {
      const point = app.getCanvasPoint(e.clientX, e.clientY);
      app.selectCreature(app.pickCreatureAt(point));
      syncPlayerControls();
      updateStats();
    }
  };

  const handleMouseLeave = () => {
    appRef.current?.endPan();
  };

  return {
    canvasRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
  };
};