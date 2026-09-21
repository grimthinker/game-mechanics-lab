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
import { PlacementMode, Point, BlackboardPickingState, Vec3 } from '../types';
import { PieMenuState } from '../components/PieMenu/types';
import { EDITOR_CONFIG } from '../config/editorConfig';
import { useDragDrop } from '../dnd/DragDropContext';
import { CREATURE_BLUEPRINTS } from '../ecs/templates';

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

  const isMarqueeActiveRef = useRef<boolean>(false);
  const [cursorWorldPos, setCursorWorldPos] = useState<Vec3 | null>(null);

  const { isDragging, startDrag, setHoverTarget } = useDragDrop();
  const dragCandidateRef = useRef<{ id: string; startX: number; startY: number } | null>(null);

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
      if (app.gizmo.isDragging()) return; // Если уже тянем манипулятор, игнорируем клик для сцены

      const point = app.getCanvasPoint(e.clientX, e.clientY);

      // В режиме игры: подбор предмета через Ctrl+ЛКМ
      if (mode === GameMode.GAME && (e.ctrlKey || e.metaKey)) {
        const targetEntityId = app.selection.pickNearestEntity(
          point,
          undefined,
          e.clientX,
          e.clientY
        );
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

      // Клик по сущности на поле — выбор с поддержкой Shift (мультиселект / инверсия)
      const entityId = app.selection.pickEntityAt(point, e.clientX, e.clientY);
      if (entityId) {
        const comp = app.world.getEntity(entityId);
        if (comp?.item && !comp.ownership && mode === GameMode.EDITOR) {
          dragCandidateRef.current = { id: entityId, startX: e.clientX, startY: e.clientY };
          return; // Откладываем выделение до отпускания или сдвига мыши
        }

        if (e.shiftKey && app.selection.selectedEntityIds.has(entityId)) {
          app.selection.deselectEntity(entityId);
        } else {
          app.selection.selectEntity(entityId, !e.shiftKey);
        }
        syncPlayerControls();
        updateStats();
        return;
      }

      // Клик по пустому месту — начинаем рамку выделения
      isMarqueeActiveRef.current = true;
      app.selection.startMarquee({ x: e.clientX, y: e.clientY });
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
    setCursorWorldPos({ x: Math.round(point.x), y: Math.round(point.y), z: Math.round(point.z) });

    if (isDragging) {
      setHoverTarget({ type: 'ground' });
      return;
    }

    if (dragCandidateRef.current) {
      const dx = e.clientX - dragCandidateRef.current.startX;
      const dy = e.clientY - dragCandidateRef.current.startY;
      if (Math.hypot(dx, dy) > 5) {
        const id = dragCandidateRef.current.id;
        const comp = app.world.getEntity(id);
        if (comp && comp.item) {
          let icon = '📦';
          if (comp.item.type === 'weapon') icon = '⚔️';
          else if (comp.item.type === 'armor') icon = '🛡️';
          else if (comp.item.type === 'bag') icon = '🎒';
          else if (comp.item.type === 'bodyPart') icon = '🥩';

          startDrag(
            {
              id,
              name: comp.meta?.name ?? comp.item.name,
              icon,
              size: comp.item.size,
              weight: comp.physicsStats?.weight.current ?? 1,
            },
            { type: 'ground' },
            e.clientX,
            e.clientY
          );
        }
        dragCandidateRef.current = null;
      }
      return;
    }

    if (app.gizmo.isDragging() && mode === GameMode.EDITOR) {
      return;
    }

    // Обновление рамки выделения
    if (isMarqueeActiveRef.current && (e.buttons & 1) === 1) {
      app.selection.updateMarquee({ x: e.clientX, y: e.clientY });
      e.currentTarget.style.cursor = 'crosshair';
      return;
    }

    // Подсветка при наведении
    let isHoveringEntity = false;
    if (placementMode) {
      app.selection.hoverEntity(null);
    } else {
      const nearestId = app.selection.pickNearestEntity(point, undefined, e.clientX, e.clientY);
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

    if (dragCandidateRef.current) {
      const id = dragCandidateRef.current.id;
      dragCandidateRef.current = null;

      if (e.shiftKey && app.selection.selectedEntityIds.has(id)) {
        app.selection.deselectEntity(id);
      } else {
        app.selection.selectEntity(id, !e.shiftKey);
      }
      syncPlayerControls();
      updateStats();
      return;
    }

    const point = app.getCanvasPoint(e.clientX, e.clientY);

    if (app.gizmo.isDragging() && mode === GameMode.EDITOR) {
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
          const blueprint = CREATURE_BLUEPRINTS[placementMode.options.structureType];
          const spawnedId = app.entityFactory.spawnModularCreature(
            app.world,
            app.physics,
            app.aiSystem,
            point,
            blueprint,
            placementMode.options.behavior,
            placementMode.options.name
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
  };

  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragCandidateRef.current = null;
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
    if (isDragging) {
      setHoverTarget(null);
    }
    dragCandidateRef.current = null;

    const app = appRef.current;
    if (app) {
      app.setMouseScreenPos(null, null);
      if (app.gizmo.isDragging()) {
        app.gizmo.cancelDrag(true);
      }
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
