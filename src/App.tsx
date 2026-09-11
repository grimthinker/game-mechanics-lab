import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameApp } from './GameApp';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { EntityConfig } from './ecs/types';
import { BTLogicComponent, BTNodeDTO } from './ai/core';
import { serializeBTNode } from './ai/serializer';
import { createDefaultCreatureConfig } from './Creature';
import { LeftDock } from './components/LeftDock/LeftDock';
import { Inspector } from './components/Inspector';
import { TopBar } from './components/TopBar';
import { HotkeysModal } from './components/HotkeysModal';
import { GameHUD } from './components/GameHUD';
import { SelectionBottomPanel } from './components/SelectionBottomPanel';
import { PlacementMode } from './types';
import { GameMode } from './constants';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';

export const App: React.FC = () => {
  const appRef = useRef<GameApp | null>(null);
  const worldFileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

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
  const [isHotkeysOpen, setIsHotkeysOpen] = useState(false);

  const lastBTUpdateRef = useRef<number>(0);
  const lastUIUpdateRef = useRef<number>(0);
  const lastSelectedEntityIdRef = useRef<string | null>(null);

  // Синхронизация реального размера Canvas с Flex-контейнером
  useEffect(() => {
    if (!canvasWrapperRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        appRef.current?.resizeCanvas(width, height);
      }
    });
    observer.observe(canvasWrapperRef.current);
    return () => observer.disconnect();
  }, []);

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
      if (isEntityChanged || app.isPaused || now - lastBTUpdateRef.current >= 100) {
        lastBTUpdateRef.current = now;
        setBtData(!brain || !brain.root_node ? null : serializeBTNode(brain.root_node));
        setBtBlackboard(!brain ? null : { ...brain.blackboard.getData() });
      }
    } else {
      setBtData(null);
      setBtBlackboard(null);
    }
  }, [setModeSync]);

  const updateStatsRef = useRef(updateStats);
  updateStatsRef.current = updateStats;

  const { syncPlayerControls } = useKeyboardControls({
    isModalOpen: isPaused,
    isEditModalOpen: false,
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
    updateStats();
  }, [updateStats, setModeSync]);

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

  const handleQuickSpawn = useCallback((type: 'player' | 'attacker') => {
    const behavior = type === 'player' ? 'PlayerTree' : 'AttackerTree';
    setPlacementMode({
      kind: 'entity',
      config: createDefaultCreatureConfig(behavior),
    });
  }, []);

  const handleSelectSpawnPreset = useCallback((config: EntityConfig) => {
    setPlacementMode({
      kind: 'entity',
      config,
    });
  }, []);

  const handleFocusEntity = useCallback(
    (id: string) => {
      const app = appRef.current;
      if (!app || !canvasRef.current) return;
      const transform = app.world.getComponent(id, 'transform');
      if (transform) {
        app.camera.lookAt(transform.x, transform.y, canvasRef.current);
      }
    },
    [canvasRef]
  );

  useGlobalShortcuts({
    mode,
    isPaused,
    togglePause,
    handleDeleteEntity,
    onQuickSpawn: handleQuickSpawn,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onExitGame: goToEditor,
  });

  return (
    <div
      id="app"
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}
    >
      {/* Верхняя панель управления скрывается в режиме игры */}
      {mode !== GameMode.GAME && (
        <TopBar
          mode={mode}
          goToEditor={goToEditor}
          goToSimulation={goToSimulation}
          goToGame={goToGame}
          obstaclesEnabled={obstaclesEnabled}
          setObstaclesEnabled={(val) => {
            setObstaclesEnabled(val);
            appRef.current?.physics.setObstaclesEnabled(val);
          }}
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
          isPaused={isPaused}
          togglePause={togglePause}
          canUndo={appRef.current?.history.canUndo() ?? false}
          canRedo={appRef.current?.history.canRedo() ?? false}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onOpenHotkeys={() => setIsHotkeysOpen(true)}
        />
      )}

      {/* Основная рабочая область (Flex-контейнер) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Левый док (Иерархия, Палитра, BT) */}
        {mode !== GameMode.GAME && (
          <LeftDock
            world={appRef.current?.world}
            selectedEntityId={selectedEntityId}
            onSelectEntity={(id) => {
              appRef.current?.selectEntity(id, true);
              updateStats();
            }}
            onFocusEntity={handleFocusEntity}
            onSelectSpawnPreset={handleSelectSpawnPreset}
            btData={btData}
            btBlackboard={btBlackboard}
          />
        )}

        {/* Область отображения холста */}
        <div
          id="canvas-container"
          ref={canvasWrapperRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        >
          <canvas
            id="game-canvas"
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onContextMenu={(e) => e.preventDefault()}
          />

          {/* Внутриигровой интерфейс HUD */}
          {mode === GameMode.GAME && (
            <GameHUD world={appRef.current?.world} onExitToEditor={goToEditor} />
          )}

          {/* Нижняя панель группового выделения (Drawer) */}
          {mode !== GameMode.GAME && (
            <SelectionBottomPanel
              selectedEntityIds={selectedEntityIds}
              selectedEntityId={selectedEntityId}
              world={appRef.current?.world}
              typeFilters={typeFilters}
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
            />
          )}

          {/* Плашка режима размещения */}
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

        {/* Правый док (Живой Инспектор) */}
        {mode !== GameMode.GAME && (
          <Inspector
            mode={mode}
            selectedEntityId={selectedEntityId}
            world={appRef.current?.world}
            physics={appRef.current?.physics}
            aiSystem={appRef.current?.aiSystem}
            onCommitHistory={(desc) => {
              appRef.current?.commitHistory(desc);
              updateStats();
            }}
            onUpdateStats={updateStats}
            handleDeleteEntity={handleDeleteEntity}
          />
        )}
      </div>

      <HotkeysModal isOpen={isHotkeysOpen} onClose={() => setIsHotkeysOpen(false)} />
    </div>
  );
};
