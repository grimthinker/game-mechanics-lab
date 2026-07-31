import { useRef, useEffect, MutableRefObject, Dispatch, SetStateAction, MouseEvent as ReactMouseEvent } from 'react';
import { GameApp } from './GameApp';
import { CreatureType } from './ecs/types';

interface PlacementConfig {
  type: CreatureType;
  radius: number;
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
    }
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    if (appRef.current) {
      appRef.current.pan(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = (e: ReactMouseEvent<HTMLCanvasElement>) => {
    const app = appRef.current;
    if (e.button !== 0 || !app) return;

    if (placementConfig) {
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
      app.endPan();
      syncPlayerControls();
      updateStats();
      return;
    }

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