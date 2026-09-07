import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameApp } from './GameApp';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { EntityConfig } from './ecs/types';
import { BTLogicComponent, BTNodeDTO } from './ai/core';
import { deg2Rad, rad2Deg } from './utils';
import { serializeBTNode } from './ai/serializer';
import {
  SpawnModal,
  UniversalEditModal,
  ItemSpawnModal,
  ZoneSpawnModal,
} from './components/modals';
import { useBTPanelState } from './hooks/useBTPanelState';
import { useGameModals } from './hooks/useGameModals';
import { BTPanel } from './components/BTPanel';
import { Toolbar } from './components/Toolbar';
import { PlacementMode } from './types';
import { GameMode } from './constants';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

export const App: React.FC = () => {
  const appRef = useRef<GameApp | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const [, setFrameTick] = useState<number>(0);
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [placementMode, setPlacementMode] = useState<PlacementMode | null>(null);

  const [btData, setBtData] = useState<BTNodeDTO | null>(null);
  const [btBlackboard, setBtBlackboard] = useState<Record<string, any> | null>(null);

  const {
    showBTPanel,
    setShowBTPanel,
    btPanelWidth,
    isResizingBT,
    setIsResizingBT,
    blackboardHeight,
    isResizingBB,
    setIsResizingBB,
  } = useBTPanelState();

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
      modals.isModalOpen || modals.isItemSpawnModalOpen || modals.isZoneSpawnModalOpen || isPaused,
    isEditModalOpen: modals.isEditModalOpen,
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

  const handleSpawnConfirm = () => {
    if (!modals.pendingSpawnBehavior) return;
    setPlacementMode({
      kind: 'entity',
      config: {
        physics: { radius: modals.radius, weight: modals.weight, isSolid: modals.isSolid },
        health: { hp: 100, maxHp: 100 },
        movement: {
          maxSpeed: modals.maxSpeed,
          maxTurnSpeed: deg2Rad(modals.maxTurnSpeed),
          runSpeedMultiplier: modals.runSpeedMultiplier,
          crouchSpeedMultiplier: modals.crouchSpeedMultiplier,
          runTurnMultiplier: modals.runTurnMultiplier,
          crouchTurnMultiplier: modals.crouchTurnMultiplier,
        },
        stealth: {
          stealthPower: modals.stealthPower,
          runStealthMultiplier: modals.runStealthMultiplier,
          crouchStealthMultiplier: modals.crouchStealthMultiplier,
        },
        ai: { behavior: modals.pendingSpawnBehavior },
        equip: [
          { type: 'armor', itemId: null },
          { type: 'bag', itemId: null },
          { type: 'weapon', itemId: null },
        ],
        meta: { name: 'Существо', entityType: 'creature' },
      },
    });
    modals.closeSpawnModal();
  };

  const handleItemSpawnConfirm = (config: EntityConfig) => {
    setPlacementMode({
      kind: 'entity',
      config,
    });
    modals.closeItemSpawnModal();
  };

  const handleZoneSpawnConfirm = (config: EntityConfig) => {
    setPlacementMode({
      kind: 'entity',
      config,
    });
    modals.closeZoneSpawnModal();
  };

  const handleDeleteEntity = () => {
    const app = appRef.current;
    if (!app) return;
    app.deleteSelectedEntity();
    syncPlayerControls();
    updateStats();
  };

  useGlobalShortcuts({
    mode,
    isPaused,
    togglePause,
    modals,
    handleSpawnConfirm,
    setShowBTPanel,
  });

  const isReadOnly = mode !== GameMode.EDITOR;

  return (
    <div id="app">
      <div id="canvas-container">
        <canvas
          id="game-canvas"
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
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
          blackboardHeight={blackboardHeight}
          btData={btData}
          btBlackboard={btBlackboard}
          onClose={() => setShowBTPanel(false)}
          onResizeBTStart={() => setIsResizingBT(true)}
          onResizeBBStart={() => setIsResizingBB(true)}
          isResizingBT={isResizingBT}
          isResizingBB={isResizingBB}
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
        setObstaclesData={(data) => appRef.current?.loadObstaclesFromData(data)}
        selectedEntityId={selectedEntityId}
        world={appRef.current?.world}
        fileInputRef={fileInputRef}
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
        openEditModal={modals.openEditModal}
        handleDeleteEntity={handleDeleteEntity}
        isPaused={isPaused}
      />

      <ZoneSpawnModal
        isOpen={modals.isZoneSpawnModalOpen}
        onClose={modals.closeZoneSpawnModal}
        onConfirm={handleZoneSpawnConfirm}
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
        crouchStealthMultiplier={modals.crouchStealthMultiplier}
        setCrouchStealthMultiplier={modals.setCrouchStealthMultiplier}
        runTurnMultiplier={modals.runTurnMultiplier}
        setRunTurnMultiplier={modals.setRunTurnMultiplier}
        crouchTurnMultiplier={modals.crouchTurnMultiplier}
        setCrouchTurnMultiplier={modals.setCrouchTurnMultiplier}
        stealthPower={modals.stealthPower}
        setStealthPower={modals.setStealthPower}
        runStealthMultiplier={modals.runStealthMultiplier}
        setRunStealthMultiplier={modals.setRunStealthMultiplier}
        onClose={modals.closeSpawnModal}
        onConfirm={handleSpawnConfirm}
      />

      <ItemSpawnModal
        isOpen={modals.isItemSpawnModalOpen}
        onClose={modals.closeItemSpawnModal}
        onConfirm={handleItemSpawnConfirm}
      />

      <UniversalEditModal
        isOpen={modals.isEditModalOpen}
        entityId={modals.editingEntityId}
        world={appRef.current?.world}
        physics={appRef.current?.physics}
        aiSystem={appRef.current?.aiSystem}
        isReadOnly={isReadOnly}
        onClose={modals.closeEditModal}
        onConfirm={() => {
          modals.closeEditModal();
          updateStats();
        }}
        onInspectItem={(itemId) => modals.openEditModal(itemId)}
      />
    </div>
  );
};
