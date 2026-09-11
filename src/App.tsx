import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameApp } from './GameApp';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { EntityConfig } from './ecs/types';
import { BTLogicComponent, BTNodeDTO } from './ai/core';
import { deg2Rad } from './utils';
import { serializeBTNode } from './ai/serializer';
import {
  SpawnModal,
  UniversalEditModal,
  ItemSpawnModal,
  ZoneSpawnModal,
  ObstacleSpawnModal,
  InteractionSlotModal,
  EquipmentAreaModal,
} from './components/modals';
import { useBTPanelState } from './hooks/useBTPanelState';
import { useGameModals } from './hooks/useGameModals';
import { BTPanel } from './components/BTPanel';
import { Toolbar } from './components/Toolbar';
import { SelectionBottomPanel } from './components/SelectionBottomPanel';
import { PlacementMode } from './types';
import { GameMode } from './constants';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

export const App: React.FC = () => {
  const appRef = useRef<GameApp | null>(null);
  const worldFileInputRef = useRef<HTMLInputElement | null>(null);

  const [mode, setMode] = useState<GameMode>(GameMode.EDITOR);
  const [snapshot, setSnapshot] = useState<any>(null);

  const modeRef = useRef(mode);

  const setModeSync = useCallback((m: GameMode) => {
    setMode(m);
    modeRef.current = m;
    if (appRef.current) appRef.current.gameMode = m;
  }, []);

  const [obstaclesEnabled, setObstaclesEnabled] = useState(true);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [selectedEntityIds, setSelectedEntityIds] = useState<string[]>([]);
  const [typeFilters, setTypeFilters] = useState<Record<string, boolean>>({
    creature: true,
    item: true,
    obstacle: true,
    zone: true,
    marker: true,
  });
  const [, setFrameTick] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [placementMode, setPlacementMode] = useState<PlacementMode | null>(null);

  const [btData, setBtData] = useState<BTNodeDTO | null>(null);
  const [btBlackboard, setBtBlackboard] = useState<Record<string, any> | null>(null);

  const { showBTPanel, setShowBTPanel, btPanelWidth, isResizingBT, startResizingBT } =
    useBTPanelState();

  const showBTPanelRef = useRef(showBTPanel);
  const lastBTUpdateRef = useRef<number>(0);
  const lastUIUpdateRef = useRef<number>(0);
  const lastSelectedEntityIdRef = useRef<string | null>(null);

  useEffect(() => {
    showBTPanelRef.current = showBTPanel;
    if (showBTPanel && appRef.current?.selectedEntity) {
      const c = appRef.current.selectedEntity;
      setBtData(!c.brain || !c.brain.root_node ? null : serializeBTNode(c.brain.root_node));
      setBtBlackboard(!c.brain ? null : { ...c.brain.blackboard.getData() });
    }
  }, [showBTPanel]);

  const modals = useGameModals({ appRef });

  const updateStats = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const currentMode = modeRef.current;

    if (currentMode === GameMode.GAME) {
      const isAnyPlayerAlive = app.world
        .getAllEntities()
        .some(
          ([_, comp]) => comp.aiStats?.behavior?.current === 'PlayerTree' && comp.health?.isAlive
        );
      if (!isAnyPlayerAlive) {
        setModeSync(GameMode.SIMULATION);
        app.isPaused = true;
        setIsPaused(true);
      }
    }

    const targetId = app.selectedEntity?.id ?? null;
    const isEntityChanged = targetId !== lastSelectedEntityIdRef.current;

    if (isEntityChanged) {
      lastSelectedEntityIdRef.current = targetId;
      setSelectedEntityId(targetId);
    }
    setSelectedEntityIds(Array.from(app.selectedEntityIds));

    const now = performance.now();
    const shouldUpdateUI = isEntityChanged || app.isPaused || now - lastUIUpdateRef.current >= 100;

    if (shouldUpdateUI) {
      lastUIUpdateRef.current = now;
      setFrameTick((t) => (t + 1) % 1000);
    }

    if (targetId) {
      const brain = app.world.getComponent(targetId, 'brain') as BTLogicComponent | undefined;

      if (showBTPanelRef.current) {
        if (isEntityChanged || app.isPaused || now - lastBTUpdateRef.current >= 100) {
          lastBTUpdateRef.current = now;
          setBtData(!brain || !brain.root_node ? null : serializeBTNode(brain.root_node));
          setBtBlackboard(!brain ? null : { ...brain.blackboard.getData() });
        }
      }
    } else {
      setBtData(null);
      setBtBlackboard(null);
    }
  }, [setModeSync]);

  const updateStatsRef = useRef(updateStats);
  updateStatsRef.current = updateStats;

  const { syncPlayerControls } = useKeyboardControls({
    isModalOpen:
      modals.isModalOpen ||
      modals.isItemSpawnModalOpen ||
      modals.isZoneSpawnModalOpen ||
      modals.isObstacleSpawnModalOpen ||
      isPaused,
    isEditModalOpen: modals.isAnyEditModalOpen,
    mode,
  });

  const { canvasRef, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } =
    useCanvasInteraction({
      appRef,
      placementMode,
      setPlacementMode,
      syncPlayerControls,
      updateStats,
      mode,
      typeFilters,
    });

  const createNewWorld = useCallback(() => {
    setSnapshot(null);
    const app = appRef.current;
    if (!app) return;

    const canvas = canvasRef.current;
    const spawnPos = {
      x: canvas ? canvas.width / 2 : 300,
      y: canvas ? canvas.height / 2 : 300,
    };

    app.initDefaultWorld(spawnPos);
    syncPlayerControls();
    updateStats();
  }, [canvasRef, syncPlayerControls, updateStats]);

  // Инициализация движка строго 1 раз при монтировании канваса
  useEffect(() => {
    if (!canvasRef.current) return;
    const app = new GameApp(canvasRef.current);
    appRef.current = app;

    app.gameMode = modeRef.current;
    app.isPaused = true;
    setIsPaused(true);

    app.start();
    app.onFrame = () => updateStatsRef.current();

    // Создание начального мира при первом запуске
    const canvas = canvasRef.current;
    const spawnPos = {
      x: canvas ? canvas.width / 2 : 300,
      y: canvas ? canvas.height / 2 : 300,
    };
    app.initDefaultWorld(spawnPos);
    updateStatsRef.current();

    return () => {
      app.destroy();
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    if (modeRef.current === GameMode.EDITOR || modeRef.current === GameMode.GAME) {
      return;
    }

    if (!app.isPaused && app.isDraggingEntity()) {
      app.cancelEntityDrag();
      updateStats();
    }

    const nextState = !app.isPaused;
    app.isPaused = nextState;
    setIsPaused(nextState);
  }, [updateStats]);

  const goToEditor = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    app.clearPlayerAim();
    if (snapshot) {
      app.deserializeWorld(snapshot);
      setSnapshot(null);
    }
    setModeSync(GameMode.EDITOR);
    app.isPaused = true;
    setIsPaused(true);
    app.selectEntity(null);
    app.hoverEntity(null);
    updateStats();
  }, [snapshot, updateStats, setModeSync]);

  const goToSimulation = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    app.clearPlayerAim();
    if (modeRef.current === GameMode.EDITOR) {
      setSnapshot(app.serializeWorld());
    }
    setModeSync(GameMode.SIMULATION);
    app.isPaused = false;
    setIsPaused(false);
    app.selectEntity(null);
    app.hoverEntity(null);
    updateStats();
  }, [updateStats, setModeSync]);

  const goToGame = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    if (modeRef.current === GameMode.EDITOR) {
      setSnapshot(app.serializeWorld());
    }
    setModeSync(GameMode.GAME);
    app.isPaused = false;
    setIsPaused(false);
    setShowBTPanel(false);
    updateStats();
  }, [updateStats, setShowBTPanel, setModeSync]);

  const handleSpawnConfirm = useCallback(() => {
    if (!modals.pendingSpawnBehavior) return;
    setPlacementMode({
      kind: 'entity',
      config: {
        physics: { radius: modals.radius, weight: modals.weight, isSolid: modals.isSolid },
        health: { hp: 100, maxHp: 100 },
        armorStats: {
          defense: modals.defense,
          flatReduction: modals.flatReduction,
        },
        movement: {
          maxSpeed: modals.maxSpeed,
          maxTurnSpeed: deg2Rad(modals.maxTurnSpeed),
          runSpeedMultiplier: modals.runSpeedMultiplier,
          crouchSpeedMultiplier: modals.crouchSpeedMultiplier,
          walkSpeedMultiplier: modals.walkSpeedMultiplier,
          runTurnMultiplier: modals.runTurnMultiplier,
          crouchTurnMultiplier: modals.crouchTurnMultiplier,
          strafeSpeedMultiplier: modals.strafeSpeedMultiplier,
          backwardSpeedMultiplier: modals.backwardSpeedMultiplier,
          strafeTurnMultiplier: modals.strafeTurnMultiplier,
          backwardTurnMultiplier: modals.backwardTurnMultiplier,
          pickupSpeedMultiplier: modals.pickupSpeedMultiplier,
          pickupTurnMultiplier: modals.pickupTurnMultiplier,
        },
        stealth: {
          stealthPower: modals.stealthPower,
          runStealthMultiplier: modals.runStealthMultiplier,
          crouchStealthMultiplier: modals.crouchStealthMultiplier,
          walkStealthMultiplier: modals.walkStealthMultiplier,
          turnInPlaceStealthMultiplier: modals.turnInPlaceStealthMultiplier,
          immobileStealthMultiplier: modals.immobileStealthMultiplier,
        },
        ai: { behavior: modals.pendingSpawnBehavior },
        equip: {
          interactionSlots: [
            { id: 'hand_left', interactDist: 15, strength: 50, itemId: null },
            { id: 'hand_right', interactDist: 15, strength: 50, itemId: null },
          ],
          equipmentAreas: [
            { id: 'head', name: 'Голова', type: 'head', space: 10, itemIds: [] },
            { id: 'neck', name: 'Шея', type: 'neck', space: 10, itemIds: [] },
            { id: 'torso', name: 'Туловище', type: 'torso', space: 40, itemIds: [] },
            { id: 'hands_1', name: 'Рука (кольца)', type: 'hands', space: 10, itemIds: [] },
            { id: 'hands_2', name: 'Рука (браслеты)', type: 'hands', space: 10, itemIds: [] },
            { id: 'legs', name: 'Ноги', type: 'legs', space: 20, itemIds: [] },
            { id: 'feet_1', name: 'Ступня левая', type: 'feet', space: 10, itemIds: [] },
            { id: 'feet_2', name: 'Ступня правая', type: 'feet', space: 10, itemIds: [] },
          ],
        },
        meta: {
          name: 'Существо',
          stance: 'standing',
          movementMode: 'immobile',
          directionMode: 'immobile',
          actionMode: 'idle',
          entityType: 'creature',
        },
      },
    });
    modals.closeSpawnModal();
  }, [modals]);

  const handleItemSpawnConfirm = useCallback(
    (config: EntityConfig) => {
      setPlacementMode({
        kind: 'entity',
        config,
      });
      modals.closeItemSpawnModal();
    },
    [modals]
  );

  const handleZoneSpawnConfirm = useCallback(
    (config: EntityConfig) => {
      setPlacementMode({
        kind: 'entity',
        config,
      });
      modals.closeZoneSpawnModal();
    },
    [modals]
  );

  const handleObstacleSpawnConfirm = useCallback(
    (config: EntityConfig) => {
      setPlacementMode({
        kind: 'entity',
        config,
      });
      modals.closeObstacleSpawnModal();
    },
    [modals]
  );

  const handleDeleteEntity = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    app.deleteSelectedEntities();
    syncPlayerControls();
    updateStats();
  }, [syncPlayerControls, updateStats]);

  const handleUndo = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    if (app.undo()) {
      syncPlayerControls();
      updateStats();
    }
  }, [syncPlayerControls, updateStats]);

  const handleRedo = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    if (app.redo()) {
      syncPlayerControls();
      updateStats();
    }
  }, [syncPlayerControls, updateStats]);

  useGlobalShortcuts({
    mode,
    isPaused,
    togglePause,
    modals: { ...modals, handleDeleteEntity },
    handleSpawnConfirm,
    setShowBTPanel,
    onUndo: handleUndo,
    onRedo: handleRedo,
  });

  const isReadOnly = mode !== GameMode.EDITOR;

  return (
    <div id="app">
      <div id="canvas-container" style={{ position: 'relative', overflow: 'hidden' }}>
        <canvas
          id="game-canvas"
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={(e) => e.preventDefault()}
        />
        <SelectionBottomPanel
          selectedEntityIds={selectedEntityIds}
          selectedEntityId={selectedEntityId}
          world={appRef.current?.world}
          typeFilters={typeFilters}
          leftOffset={showBTPanel ? btPanelWidth : 0}
          isResizingBT={isResizingBT}
          onToggleFilter={(type) =>
            setTypeFilters((prev) => ({ ...prev, [type]: prev[type] === false ? true : false }))
          }
          onSelectEntity={(id) => {
            appRef.current?.selectEntity(id, false);
            updateStats();
          }}
          onDeselectEntity={(id) => {
            appRef.current?.deselectEntity(id);
            updateStats();
          }}
          onClearSelection={() => {
            appRef.current?.selectEntity(null, true);
            updateStats();
          }}
          onDeleteSelected={handleDeleteEntity}
          onInspectEntity={(id) => modals.openEditModal(id)}
        />
        {placementMode && (
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(41, 128, 185, 0.9)',
              padding: '10px 20px',
              borderRadius: '8px',
              display: 'flex',
              gap: '15px',
              alignItems: 'center',
              zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <span>Выберите место для спавна на поле</span>
            <button
              className="btn btn-sm"
              style={{ backgroundColor: '#c0392b' }}
              onClick={() => setPlacementMode(null)}
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      {showBTPanel && (
        <BTPanel
          btPanelWidth={btPanelWidth}
          btData={btData}
          btBlackboard={btBlackboard}
          onClose={() => setShowBTPanel(false)}
          onResizeBTStart={startResizingBT}
          isResizingBT={isResizingBT}
        />
      )}

      <Toolbar
        mode={mode}
        goToEditor={goToEditor}
        goToSimulation={goToSimulation}
        goToGame={goToGame}
        obstaclesEnabled={obstaclesEnabled}
        setObstaclesEnabled={(val) => {
          setObstaclesEnabled(val);
          appRef.current?.physics.setObstaclesEnabled(val);
        }}
        selectedEntityId={selectedEntityId}
        world={appRef.current?.world}
        worldFileInputRef={worldFileInputRef}
        onNewWorld={createNewWorld}
        onSaveWorld={() => {
          const app = appRef.current;
          if (!app) return;
          const data = app.serializeWorld();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `world_${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }}
        onLoadWorldFile={(file) => {
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const data = JSON.parse(evt.target?.result as string);
              const app = appRef.current;
              if (app) {
                setSnapshot(null);
                app.deserializeWorld(data);
                app.history.clear();
                syncPlayerControls();
                updateStats();
              }
            } catch {
              alert('Ошибка при чтении JSON файла мира!');
            }
          };
          reader.readAsText(file);
        }}
        openSpawnModal={modals.openSpawnModal}
        openItemSpawnModal={modals.openItemSpawnModal}
        openZoneSpawnModal={modals.openZoneSpawnModal}
        openObstacleSpawnModal={modals.openObstacleSpawnModal}
        openEditModal={modals.openEditModal}
        openSlotModal={modals.openSlotModal}
        openAreaModal={modals.openAreaModal}
        handleDeleteEntity={handleDeleteEntity}
        isPaused={isPaused}
        canUndo={appRef.current?.history.canUndo() ?? false}
        canRedo={appRef.current?.history.canRedo() ?? false}
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      <ZoneSpawnModal
        isOpen={modals.isZoneSpawnModalOpen}
        onClose={modals.closeZoneSpawnModal}
        onConfirm={handleZoneSpawnConfirm}
      />

      <ObstacleSpawnModal
        isOpen={modals.isObstacleSpawnModalOpen}
        onClose={modals.closeObstacleSpawnModal}
        onConfirm={handleObstacleSpawnConfirm}
      />

      <SpawnModal
        isOpen={modals.isModalOpen}
        pendingSpawnBehavior={modals.pendingSpawnBehavior}
        setPendingSpawnBehavior={modals.setPendingSpawnBehavior}
        isSolid={modals.isSolid}
        setIsSolid={modals.setIsSolid}
        radius={modals.radius}
        setRadius={modals.setRadius}
        weight={modals.weight}
        setWeight={modals.setWeight}
        maxSpeed={modals.maxSpeed}
        setMaxSpeed={modals.setMaxSpeed}
        maxTurnSpeed={modals.maxTurnSpeed}
        setMaxTurnSpeed={modals.setMaxTurnSpeed}
        runSpeedMultiplier={modals.runSpeedMultiplier}
        setRunSpeedMultiplier={modals.setRunSpeedMultiplier}
        crouchSpeedMultiplier={modals.crouchSpeedMultiplier}
        setCrouchSpeedMultiplier={modals.setCrouchSpeedMultiplier}
        walkSpeedMultiplier={modals.walkSpeedMultiplier}
        setWalkSpeedMultiplier={modals.setWalkSpeedMultiplier}
        crouchStealthMultiplier={modals.crouchStealthMultiplier}
        setCrouchStealthMultiplier={modals.setCrouchStealthMultiplier}
        runTurnMultiplier={modals.runTurnMultiplier}
        setRunTurnMultiplier={modals.setRunTurnMultiplier}
        crouchTurnMultiplier={modals.crouchTurnMultiplier}
        setCrouchTurnMultiplier={modals.setCrouchTurnMultiplier}
        strafeSpeedMultiplier={modals.strafeSpeedMultiplier}
        setStrafeSpeedMultiplier={modals.setStrafeSpeedMultiplier}
        backwardSpeedMultiplier={modals.backwardSpeedMultiplier}
        setBackwardSpeedMultiplier={modals.setBackwardSpeedMultiplier}
        strafeTurnMultiplier={modals.strafeTurnMultiplier}
        setStrafeTurnMultiplier={modals.setStrafeTurnMultiplier}
        backwardTurnMultiplier={modals.backwardTurnMultiplier}
        setBackwardTurnMultiplier={modals.setBackwardTurnMultiplier}
        pickupSpeedMultiplier={modals.pickupSpeedMultiplier}
        setPickupSpeedMultiplier={modals.setPickupSpeedMultiplier}
        pickupTurnMultiplier={modals.pickupTurnMultiplier}
        setPickupTurnMultiplier={modals.setPickupTurnMultiplier}
        stealthPower={modals.stealthPower}
        setStealthPower={modals.setStealthPower}
        runStealthMultiplier={modals.runStealthMultiplier}
        setRunStealthMultiplier={modals.setRunStealthMultiplier}
        walkStealthMultiplier={modals.walkStealthMultiplier}
        setWalkStealthMultiplier={modals.setWalkStealthMultiplier}
        turnInPlaceStealthMultiplier={modals.turnInPlaceStealthMultiplier}
        setTurnInPlaceStealthMultiplier={modals.setTurnInPlaceStealthMultiplier}
        immobileStealthMultiplier={modals.immobileStealthMultiplier}
        setImmobileStealthMultiplier={modals.setImmobileStealthMultiplier}
        defense={modals.defense}
        setDefense={modals.setDefense}
        flatReduction={modals.flatReduction}
        setFlatReduction={modals.setFlatReduction}
        onClose={modals.closeSpawnModal}
        onConfirm={handleSpawnConfirm}
      />

      <ItemSpawnModal
        isOpen={modals.isItemSpawnModalOpen}
        onClose={modals.closeItemSpawnModal}
        onConfirm={handleItemSpawnConfirm}
      />

      <InteractionSlotModal
        isOpen={modals.isSlotModalOpen}
        creatureId={modals.editingSlot?.creatureId ?? null}
        slotId={modals.editingSlot?.slotId ?? null}
        world={appRef.current?.world}
        isReadOnly={isReadOnly}
        onClose={modals.closeCurrentModal}
        onBeforeSave={() => appRef.current?.commitHistory('Настройка ячейки взаимодействия')}
        onInspectItem={(itemId) => modals.openEditModal(itemId)}
        onConfirm={updateStats}
      />

      <EquipmentAreaModal
        isOpen={modals.isAreaModalOpen}
        creatureId={modals.editingArea?.creatureId ?? null}
        areaId={modals.editingArea?.areaId ?? null}
        world={appRef.current?.world}
        isReadOnly={isReadOnly}
        onClose={modals.closeCurrentModal}
        onBeforeSave={() => appRef.current?.commitHistory('Настройка области экипировки')}
        onInspectItem={(itemId) => modals.openEditModal(itemId)}
        onConfirm={updateStats}
      />

      <UniversalEditModal
        isOpen={modals.isEditModalOpen}
        entityId={modals.editingEntityId}
        world={appRef.current?.world}
        physics={appRef.current?.physics}
        aiSystem={appRef.current?.aiSystem}
        isReadOnly={isReadOnly}
        onClose={modals.closeCurrentModal}
        onBeforeApply={() => appRef.current?.commitHistory('Редактирование сущности')}
        onConfirm={() => {
          modals.closeCurrentModal();
          updateStats();
        }}
        onInspectItem={(itemId) => modals.openEditModal(itemId)}
      />
    </div>
  );
};
