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
import { GameMode } from '../config/gameConfig';
import { PlacementMode, Point, BlackboardPickingState } from '../types';
import { PieMenuState } from '../components/PieMenu/types';
import { EDITOR_CONFIG } from '../config/editorConfig';

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
  bbPicking?: BlackboardPickingState | null;
  setBbPicking?: Dispatch<SetStateAction<BlackboardPickingState | null>>;
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
  bbPicking,
  setBbPicking,
}: UseCanvasInteractionProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const clickedEntityIdRef = useRef<string | null>(null);
  const isMarqueeActiveRef = useRef<boolean>(false);
  const [cursorWorldPos, setCursorWorldPos] = useState<Point | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.style.cursor = placementMode || bbPicking ? 'crosshair' : 'default';

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
        const targetEntityId = app.selection.pickNearestEntity(point);
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

      // Интерактивный выбор сущности для Blackboard (Object Picker)
      if (bbPicking && setBbPicking && mode === GameMode.EDITOR) {
        const pickedId = app.selection.pickEntityAt(point, e.clientX, e.clientY);
        if (pickedId) {
          app.updateEntityBlackboard(bbPicking.entityId, bbPicking.key, pickedId);
        }
        setBbPicking(null);
        syncPlayerControls();
        updateStats();
        return;
      }

      if (placementMode) return;

      // 1. Проверка клика по интерактивному манипулятору (Gizmo)
      if (
        mode === GameMode.EDITOR &&
        app.selection.selectedEntityId &&
        app.gizmo.tool !== 'select'
      ) {
        const gizmoHandle = app.gizmo.hitTest(point);
        if (gizmoHandle) {
          clickedEntityIdRef.current = null;
          app.gizmo.startDrag(gizmoHandle, point);
          e.currentTarget.style.cursor = gizmoHandle === 'rotate' ? 'crosshair' : 'grabbing';
          return;
        }
      }

      // 2. Клик по сущности на поле — выбор с поддержкой Shift (мультиселект / инверсия)
      const entityId = app.selection.pickEntityAt(point, e.clientX, e.clientY);
      if (entityId) {
        clickedEntityIdRef.current = entityId;
        if (e.shiftKey && app.selection.selectedEntityIds.has(entityId)) {
          app.selection.deselectEntity(entityId);
        } else {
          app.selection.selectEntity(entityId, !e.shiftKey);
        }
        syncPlayerControls();
        updateStats();
        return;
      }

      // 3. Клик по пустому месту — начинаем рамку выделения
      clickedEntityIdRef.current = null;
      isMarqueeActiveRef.current = true;
      const rect = containerRef.current!.getBoundingClientRect();
      app.selection.startMarquee({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
  };

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const app = appRef.current;
    if (!app) return;

    if (app.camera.isRotating) {
      app.camera.rotate(e.clientX, e.clientY);
      e.currentTarget.style.cursor = 'move';
      return;
    }

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

    // Обновление перетаскивания манипулятора
    if (app.gizmo.isDragging() && mode === GameMode.EDITOR) {
      app.gizmo.setPendingDrag(point, e.shiftKey);
      e.currentTarget.style.cursor = app.gizmo.activeHandle === 'rotate' ? 'crosshair' : 'grabbing';
      return;
    }

    // Обновление рамки выделения
    if (isMarqueeActiveRef.current && (e.buttons & 1) === 1) {
      const rect = containerRef.current!.getBoundingClientRect();
      app.selection.updateMarquee({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      e.currentTarget.style.cursor = 'crosshair';
      return;
    }

    // Проверка наведения на манипулятор (Gizmo Hover)
    if (
      mode === GameMode.EDITOR &&
      app.selection.selectedEntityId &&
      !placementMode &&
      app.gizmo.tool !== 'select'
    ) {
      const gizmoHit = app.gizmo.hitTest(point);
      app.gizmo.hoveredHandle = gizmoHit;
      if (gizmoHit) {
        app.selection.hoverEntity(null);
        if (gizmoHit === 'x') e.currentTarget.style.cursor = 'ew-resize';
        else if (gizmoHit === 'y') e.currentTarget.style.cursor = 'ns-resize';
        else if (gizmoHit === 'center') e.currentTarget.style.cursor = 'move';
        else if (gizmoHit === 'rotate') e.currentTarget.style.cursor = 'crosshair';
        return;
      }
    } else {
      app.gizmo.hoveredHandle = null;
    }

    // Подсветка при наведении
    let isHoveringEntity = false;
    if (placementMode) {
      app.selection.hoverEntity(null);
    } else {
      const nearestId = app.selection.pickNearestEntity(point);
      app.selection.hoverEntity(nearestId);
      isHoveringEntity = nearestId !== null;
    }

    if (placementMode || bbPicking) {
      e.currentTarget.style.cursor = 'crosshair';
    } else if (isHoveringEntity) {
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
    if (app.gizmo.isDragging() && mode === GameMode.EDITOR) {
      app.gizmo.endDrag();
      updateStats();
      syncPlayerControls();
      e.currentTarget.style.cursor = 'default';
      return;
    }

    // Завершение рамки выделения
    if (isMarqueeActiveRef.current) {
      isMarqueeActiveRef.current = false;
      app.selection.endMarquee(typeFilters);
      updateStats();
      e.currentTarget.style.cursor = 'default';
      return;
    }

    // Спавн сущности
    if (placementMode && mode === GameMode.EDITOR) {
      if (placementMode.kind === 'entity') {
        app.executeTransaction('Спавн объекта', () => {
          const spawnedId = app.spawnEntity(placementMode.config, point);
          app.selection.selectEntity(spawnedId, true);
          return spawnedId;
        });
      } else if (placementMode.kind === 'modular') {
        app.executeTransaction('Спавн составного существа', () => {
          const spawnedId = app.entityFactory.spawnModularHumanoid(
            app.world,
            app.physics,
            app.aiSystem,
            point,
            placementMode.behavior,
            placementMode.name
          );
          app.selection.selectEntity(spawnedId, true);
          return spawnedId;
        });
      }
      setPlacementMode(null);
      syncPlayerControls();
      updateStats();
      return;
    }

    clickedEntityIdRef.current = null;
  };

  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const app = appRef.current;
    if (!app || mode !== GameMode.EDITOR || !containerRef.current) return;

    if (bbPicking && setBbPicking) {
      setBbPicking(null);
      return;
    }

    if (placementMode) {
      setPlacementMode(null);
      if (onClosePieMenu) onClosePieMenu();
      return;
    }

    if (!onOpenPieMenu) return;

    if (app.gizmo.isDragging()) {
      app.gizmo.cancelDrag(true);
    }

    const point = app.getCanvasPoint(e.clientX, e.clientY);

    const margin = EDITOR_CONFIG.pieMenuMargin;
    const minX = Math.min(margin, window.innerWidth / 2);
    const maxX = Math.max(minX, window.innerWidth - margin);
    const minY = Math.min(margin, window.innerHeight / 2);
    const maxY = Math.max(minY, window.innerHeight - margin);

    const screenPos = {
      x: Math.min(maxX, Math.max(minX, e.clientX)),
      y: Math.min(maxY, Math.max(minY, e.clientY)),
    };

    const entityId = app.selection.pickEntityAt(point, e.clientX, e.clientY);

    if (entityId) {
      if (app.selection.selectedEntityIds.has(entityId)) {
        app.selection.selectEntity(entityId, false);
      } else {
        app.selection.selectEntity(entityId, true);
      }
      syncPlayerControls();
      updateStats();

      onOpenPieMenu({
        screenPos,
        worldPos: point,
        targetEntityId: entityId,
        targetEntityIds: Array.from(app.selection.selectedEntityIds),
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
      if (app.gizmo.isDragging()) {
        app.gizmo.cancelDrag(true);
      }
      app.gizmo.hoveredHandle = null;
      if (isMarqueeActiveRef.current) {
        app.selection.marqueeBox = null;
        isMarqueeActiveRef.current = false;
      }
      if (app.camera.isRotating) {
        app.camera.endRotate();
      }
      app.endPan();
      app.selection.hoverEntity(null);
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
