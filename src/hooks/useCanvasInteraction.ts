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

import { PieMenuState } from '../components/PieMenu/types';

interface UseCanvasInteractionProps {
  appRef: MutableRefObject<GameApp | null>;
  placementMode: PlacementMode | null;
  setPlacementMode: Dispatch<SetStateAction<PlacementMode | null>>;
  syncPlayerControls: () => void;
  updateStats: () => void;
  mode: GameMode;
  typeFilters: Record<string, boolean>;
  onOpenPieMenu?: (menuState: PieMenuState) => void;
  onClosePieMenu?: () => void;
}

export const useCanvasInteraction = ({
  appRef,
  placementMode,
  setPlacementMode,
  syncPlayerControls,
  updateStats,
  mode,
  typeFilters,
  onOpenPieMenu,
  onClosePieMenu,
}: UseCanvasInteractionProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const clickedEntityIdRef = useRef<string | null>(null);
  const isMarqueeActiveRef = useRef<boolean>(false);
  const [cursorWorldPos, setCursorWorldPos] = useState<Point | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.cursor = placementMode ? 'pointer' : 'default';

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (onClosePieMenu) onClosePieMenu();
      appRef.current?.zoomAt(e.clientX, e.clientY, e.deltaY);
    };

    container.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', onWheel);
    };
  }, [placementMode, onClosePieMenu]);

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    const app = appRef.current;
    if (!app) return;

    if (onClosePieMenu) onClosePieMenu();

    // Вращение камеры (LAlt + ЛКМ)
    if (e.button === 0 && e.altKey) {
      e.preventDefault();
      app.camera.startRotate(e.clientX, e.clientY);
      return;
    }

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

      // 1. Проверка клика по интерактивному манипулятору (Gizmo)
      if (mode === GameMode.EDITOR && app.selectedEntityId && app.gizmoTool !== 'select') {
        const gizmoHandle = app.hitTestGizmo(point);
        if (gizmoHandle) {
          clickedEntityIdRef.current = null;
          app.startGizmoDrag(gizmoHandle, point);
          e.currentTarget.style.cursor = gizmoHandle === 'rotate' ? 'crosshair' : 'grabbing';
          return;
        }
      }

      // 2. Клик по сущности на поле — выбор с поддержкой Shift (мультиселект / инверсия)
      const entityId = app.pickEntityAt(point, e.clientX, e.clientY);
      if (entityId) {
        clickedEntityIdRef.current = entityId;
        if (e.shiftKey && app.selectedEntityIds.has(entityId)) {
          app.deselectEntity(entityId);
        } else {
          app.selectEntity(entityId, !e.shiftKey);
        }
        syncPlayerControls();
        updateStats();
        return;
      }

      // 3. Клик по пустому месту — начинаем рамку выделения
      clickedEntityIdRef.current = null;
      isMarqueeActiveRef.current = true;
      app.startMarquee(point);
    }
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const app = appRef.current;
    if (!app) return;

    // Вращение
    if (app.camera.isRotating) {
      app.camera.rotate(e.clientX, e.clientY);
      e.currentTarget.style.cursor = 'move';
      return;
    }

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

    // Обновление перетаскивания манипулятора (запись намерения без нагрузки на BVH)
    if (app.isGizmoDragging() && mode === GameMode.EDITOR) {
      app.setPendingGizmoDrag(point, e.shiftKey);
      e.currentTarget.style.cursor = app.activeGizmoHandle === 'rotate' ? 'crosshair' : 'grabbing';
      return;
    }

    // Обновление рамки выделения
    if (isMarqueeActiveRef.current && (e.buttons & 1) === 1) {
      app.updateMarquee(point);
      e.currentTarget.style.cursor = 'crosshair';
      return;
    }

    // Проверка наведения на манипулятор (Gizmo Hover)
    if (
      mode === GameMode.EDITOR &&
      app.selectedEntityId &&
      !placementMode &&
      app.gizmoTool !== 'select'
    ) {
      const gizmoHit = app.hitTestGizmo(point);
      app.hoveredGizmoHandle = gizmoHit;
      if (gizmoHit) {
        app.hoverEntity(null);
        if (gizmoHit === 'x') e.currentTarget.style.cursor = 'ew-resize';
        else if (gizmoHit === 'y') e.currentTarget.style.cursor = 'ns-resize';
        else if (gizmoHit === 'center') e.currentTarget.style.cursor = 'move';
        else if (gizmoHit === 'rotate') e.currentTarget.style.cursor = 'crosshair';
        return;
      }
    } else {
      app.hoveredGizmoHandle = null;
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

    if (app.camera.isRotating) {
      app.camera.endRotate();
      e.currentTarget.style.cursor = 'default';
      return;
    }

    if (e.button === 1) {
      app.endPan();
      e.currentTarget.style.cursor = 'default';
      return;
    }

    if (e.button !== 0) return;

    const point = app.getCanvasPoint(e.clientX, e.clientY);

    // Завершение взаимодействия с манипулятором
    if (app.isGizmoDragging() && mode === GameMode.EDITOR) {
      app.endGizmoDrag();
      updateStats();
      syncPlayerControls();
      e.currentTarget.style.cursor = 'default';
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

    // Сброс флага клика по сущности (клик в пустое место детерминированно обрабатывает endMarquee)
    clickedEntityIdRef.current = null;
  };

  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const app = appRef.current;
    if (!app || mode !== GameMode.EDITOR || !containerRef.current) return;

    // Правый клик в режиме размещения шаблона отменяет размещение
    if (placementMode) {
      setPlacementMode(null);
      if (onClosePieMenu) onClosePieMenu();
      return;
    }

    if (!onOpenPieMenu) return;

    if (app.isGizmoDragging()) {
      app.cancelGizmoDrag(true);
    }

    const point = app.getCanvasPoint(e.clientX, e.clientY);
    const rect = containerRef.current.getBoundingClientRect();

    // Ограничиваем экранные координаты, чтобы радиальное меню радиусом 115px не обрезалось границами экрана
    const margin = 135;
    const maxX = Math.max(margin, rect.width - margin);
    const maxY = Math.max(margin, rect.height - margin);
    const screenPos = {
      x: Math.min(maxX, Math.max(margin, e.clientX - rect.left)),
      y: Math.min(maxY, Math.max(margin, e.clientY - rect.top)),
    };

    const entityId = app.pickEntityAt(point, e.clientX, e.clientY);

    if (entityId) {
      if (app.selectedEntityIds.has(entityId)) {
        app.selectEntity(entityId, false);
      } else {
        app.selectEntity(entityId, true);
      }
      syncPlayerControls();
      updateStats();

      onOpenPieMenu({
        screenPos,
        worldPos: point,
        targetEntityId: entityId,
        targetEntityIds: Array.from(app.selectedEntityIds),
      });
    } else {
      onOpenPieMenu({
        screenPos,
        worldPos: point,
        targetEntityId: null,
        targetEntityIds: [],
      });
    }
  };

  const handleMouseLeave = () => {
    const app = appRef.current;
    if (app) {
      app.setMouseScreenPos(null, null);
      if (app.isGizmoDragging()) {
        app.cancelGizmoDrag(true);
      }
      app.hoveredGizmoHandle = null;
      if (isMarqueeActiveRef.current) {
        app.marqueeBox = null;
        isMarqueeActiveRef.current = false;
      }
      if (app.camera.isRotating) {
        app.camera.endRotate();
      }
      app.endPan();
      app.hoverEntity(null);
    }
    clickedEntityIdRef.current = null;
    setCursorWorldPos(null);
  };

  return {
    containerRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleContextMenu,
    cursorWorldPos,
  };
};
