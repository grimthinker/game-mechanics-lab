import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameApp } from './GameApp';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { EntityConfig } from './ecs/types';
import { BTNodeDTO } from './ai/core';
import { LeftDock, DockTab } from './components/LeftDock/LeftDock';
import { PieMenu } from './components/PieMenu/PieMenu';
import { PieMenuState } from './components/PieMenu/types';
import { createRectanglePoints } from './utils';
import { Inspector } from './components/Inspector';
import { TopBar } from './components/TopBar';
import { HotkeysModal } from './components/HotkeysModal';
import { GameHUD } from './components/GameHUD';
import { CanvasHUD } from './components/CanvasHUD';
import { useDragDrop } from './dnd/DragDropContext';
import { DragGhostOverlay } from './dnd/DragGhostOverlay';
import { MultiSelectionDrawer } from './components/MultiSelectionDrawer';
import { PlacementMode, BlackboardPickingState } from './types';
import { GameMode } from './config/gameConfig';
import { GizmoTool } from './gizmos/types';
import { useGlobalShortcuts } from './hooks/useGlobalShortcuts';
import './editor.css';
import { createZoneConfig } from './ecs/archetypes';
import { saveWorldToStorage, loadWorldFromStorage } from './storage/autoSave';
import { EDITOR_CONFIG } from './config/editorConfig';
import { t } from './locales';
import { EventBus } from './core/EventBus';

export const App: React.FC = () => {
  const appRef = useRef<GameApp | null>(null);
  const worldFileInputRef = useRef<HTMLInputElement | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<GameMode>(GameMode.EDITOR);
  const [isEngineReady, setIsEngineReady] = useState<boolean>(false);
  const [snapshot, setSnapshot] = useState<any>(null);
  const snapshotRef = useRef<any>(null);
  snapshotRef.current = snapshot;
  const [renderMode, setRenderMode] = useState<'2d' | '3d'>('2d');
  const [showUIOverlays, setShowUIOverlays] = useState<boolean>(true);
  const [showAIDebug, setShowAIDebug] = useState<boolean>(false);
  const [gizmoTool, setGizmoTool] = useState<GizmoTool>('translate');
  const [leftDockTab, setLeftDockTab] = useState<DockTab>('hierarchy');
  const [pieMenuState, setPieMenuState] = useState<PieMenuState | null>(null);

  const applyGizmoTool = useCallback((tool: GizmoTool) => {
    setGizmoTool(tool);
    if (appRef.current) appRef.current.gizmo.setTool(tool);
  }, []);

  const closePieMenu = useCallback(() => {
    setPieMenuState(null);
  }, []);

  const modeRef = useRef(mode);

  const applyShowUIOverlays = useCallback((val: boolean) => {
    setShowUIOverlays(val);
    if (appRef.current) appRef.current.showUIOverlays = val;
  }, []);

  const applyShowAIDebug = useCallback((val: boolean) => {
    setShowAIDebug(val);
    if (appRef.current) appRef.current.showAIDebug = val;
  }, []);

  const applyGameMode = useCallback((m: GameMode) => {
    setMode(m);
    modeRef.current = m;
    setPieMenuState(null);
    if (appRef.current) appRef.current.gameMode = m;
  }, []);

  const applyGlobalTimeScale = useCallback((val: number) => {
    setGlobalTimeScale(val);
    if (appRef.current) appRef.current.globalTimeScale = val;
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
  const [isPaused, setIsPaused] = useState<boolean>(true);
  const [placementMode, setPlacementMode] = useState<PlacementMode | null>(null);
  const [bbPicking, setBbPicking] = useState<BlackboardPickingState | null>(null);
  const [globalTimeScale, setGlobalTimeScale] = useState<number>(1.0);

  const [btData, setBtData] = useState<BTNodeDTO | null>(null);
  const [btBlackboard, setBtBlackboard] = useState<Record<string, any> | null>(null);
  const [btSchema, setBtSchema] = useState<Record<string, any> | null>(null);
  const [isHotkeysOpen, setIsHotkeysOpen] = useState(false);

  const { setApp } = useDragDrop();

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

  const { syncPlayerControls } = useKeyboardControls({
    isModalOpen: isPaused,
    isEditModalOpen: false,
    mode,
  });

  // Подписка на события движка через EventBus
  useEffect(() => {
    const unsubSelection = EventBus.on(
      'selection:changed',
      ({ selectedEntityId: sId, selectedEntityIds: sIds }) => {
        setSelectedEntityId((prev) => (prev !== sId ? sId : prev));
        setSelectedEntityIds((prev) => {
          if (prev.length === sIds.length && prev.every((id, idx) => id === sIds[idx])) {
            return prev;
          }
          return sIds;
        });
      }
    );

    const unsubBT = EventBus.on(
      'bt:updated',
      ({ btData: data, btBlackboard: bb, btSchema: schema }) => {
        setBtData(data);
        setBtBlackboard(bb);
        setBtSchema(schema);
      }
    );

    const unsubPlayerDied = EventBus.on('game:playerDied', () => {
      applyGameMode(GameMode.SIMULATION);
      if (appRef.current) appRef.current.isPaused = true;
      setIsPaused(true);
    });

    const unsubWorld = EventBus.on('world:updated', () => {
      syncPlayerControls();
    });

    return () => {
      unsubSelection();
      unsubBT();
      unsubPlayerDied();
      unsubWorld();
    };
  }, [applyGameMode, syncPlayerControls]);

  const updateStats = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    app.selection.emitSelectionChanged();
    app.updateBTData(true);
  }, []);

  const {
    containerRef,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleContextMenu,
    cursorWorldPos,
  } = useCanvasInteraction({
    appRef,
    placementMode,
    setPlacementMode,
    syncPlayerControls,
    updateStats,
    mode,
    typeFilters,
    onOpenPieMenu: setPieMenuState,
    onClosePieMenu: closePieMenu,
    bbPicking,
    setBbPicking,
  });

  const handleResetCamera = useCallback(() => {
    closePieMenu();
    const app = appRef.current;
    const canvas = app?.canvas;
    if (!app || !canvas) return;
    app.camera.resetZoomAndRotation(canvas);
    updateStats();
    saveWorldToStorage(app, snapshotRef.current);
  }, [closePieMenu, updateStats]);

  const createNewWorld = useCallback(() => {
    closePieMenu();
    setSnapshot(null);
    snapshotRef.current = null;
    const app = appRef.current;
    if (!app) return;

    const canvas = app.canvas;
    const spawnPos = {
      x: canvas ? canvas.width / 2 : 300,
      y: canvas ? canvas.height / 2 : 300,
    };

    app.initDefaultWorld(spawnPos);
    saveWorldToStorage(app);
    syncPlayerControls();
    updateStats();
  }, [closePieMenu, syncPlayerControls, updateStats]);

  // Инициализация движка строго 1 раз при монтировании контейнера
  useEffect(() => {
    if (!containerRef.current) return;
    const app = new GameApp(containerRef.current);
    appRef.current = app;
    setApp(app);

    app.gameMode = modeRef.current;
    app.isPaused = true;
    setIsPaused(true);
    app.globalTimeScale = globalTimeScale;

    app.start();

    // Восстановление мира из автосохранения либо создание дефолтного мира
    const autoSave = loadWorldFromStorage();
    if (autoSave && autoSave.world) {
      app.deserializeWorld(autoSave.world);
      if (autoSave.camera) {
        app.camera.deserialize(autoSave.camera);
      }
    } else {
      const canvas = app.canvas;
      const spawnPos = {
        x: canvas ? canvas.width / 2 : 300,
        y: canvas ? canvas.height / 2 : 300,
      };
      app.initDefaultWorld(spawnPos);
      saveWorldToStorage(app);
    }

    app.selection.emitSelectionChanged();
    app.updateBTData(true);
    setIsEngineReady(true);

    return () => {
      setApp(null);
      app.destroy();
      appRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setApp]);

  // Автосохранение при закрытии/скрытии вкладки браузера
  useEffect(() => {
    const handleSave = () => {
      if (appRef.current) {
        saveWorldToStorage(appRef.current, snapshotRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleSave();
      }
    };

    window.addEventListener('beforeunload', handleSave);
    window.addEventListener('pagehide', handleSave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleSave);
      window.removeEventListener('pagehide', handleSave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const togglePause = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    if (modeRef.current === GameMode.EDITOR || modeRef.current === GameMode.GAME) {
      return;
    }

    const nextState = !app.isPaused;
    app.isPaused = nextState;
    setIsPaused(nextState);
  }, []);

  const goToEditor = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    app.clearPlayerAim();
    if (snapshot) {
      app.deserializeWorld(snapshot);
      setSnapshot(null);
      snapshotRef.current = null;
    }
    applyGameMode(GameMode.EDITOR);
    app.isPaused = true;
    setIsPaused(true);
    app.selection.clear();
    saveWorldToStorage(app);
  }, [snapshot, applyGameMode]);

  const goToSimulation = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    app.clearPlayerAim();
    let currentSnapshot = snapshot;
    if (modeRef.current === GameMode.EDITOR) {
      currentSnapshot = app.serializeWorld();
      setSnapshot(currentSnapshot);
      snapshotRef.current = currentSnapshot;
    }
    applyGameMode(GameMode.SIMULATION);
    app.isPaused = false;
    setIsPaused(false);
    app.selection.clear();
    saveWorldToStorage(app, currentSnapshot);
  }, [applyGameMode, snapshot]);

  const goToGame = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    let currentSnapshot = snapshot;
    if (modeRef.current === GameMode.EDITOR) {
      currentSnapshot = app.serializeWorld();
      setSnapshot(currentSnapshot);
      snapshotRef.current = currentSnapshot;
    }
    applyGlobalTimeScale(1.0); // Возвращаем нормальную скорость времени для игры
    applyGameMode(GameMode.GAME);
    app.isPaused = false;
    setIsPaused(false);
    saveWorldToStorage(app, currentSnapshot);
  }, [applyGameMode, applyGlobalTimeScale, snapshot]);

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
    const name = type === 'player' ? t('palette.player') : t('palette.attacker');
    setPlacementMode({
      kind: 'modular',
      behavior,
      name,
    });
  }, []);

  const handleSelectSpawnPreset = useCallback((config: EntityConfig) => {
    setPlacementMode({
      kind: 'entity',
      config,
    });
  }, []);

  const handleFocusEntity = useCallback((id: string) => {
    const app = appRef.current;
    if (!app || !app.canvas) return;
    const transform = app.world.getComponent(id, 'transform');
    if (transform) {
      app.camera.lookAt(transform.x, transform.y, app.canvas);
    }
  }, []);

  const handleCancelGizmo = useCallback(() => {
    const app = appRef.current;
    if (app && app.gizmo.isDragging()) {
      app.gizmo.cancelDrag(true);
      updateStats();
      return true;
    }
    return false;
  }, [updateStats]);

  const handleClosePieMenuViaShortcut = useCallback(() => {
    if (pieMenuState !== null) {
      setPieMenuState(null);
      return true;
    }
    return false;
  }, [pieMenuState]);

  const handleCommitHistory = useCallback((desc: string) => {
    const app = appRef.current;
    if (!app) return;
    app.commitHistory(desc);
    app.updateBTData(true);
  }, []);

  const handleStartBBPicking = useCallback(
    (key: string) => {
      if (!selectedEntityId) return;
      setBbPicking({ entityId: selectedEntityId, key });
    },
    [selectedEntityId]
  );

  const handleCancelPicker = useCallback(() => {
    if (bbPicking) {
      setBbPicking(null);
      return true;
    }
    return false;
  }, [bbPicking]);

  useGlobalShortcuts({
    mode,
    isPaused,
    togglePause,
    handleDeleteEntity,
    onQuickSpawn: handleQuickSpawn,
    onUndo: handleUndo,
    onRedo: handleRedo,
    onExitGame: goToEditor,
    onSetGizmoTool: applyGizmoTool,
    onCancelGizmo: handleCancelGizmo,
    onClosePieMenu: handleClosePieMenuViaShortcut,
    onCancelPicker: handleCancelPicker,
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
                  snapshotRef.current = null;
                  app.deserializeWorld(data);
                  app.commandHistory.clear();
                  saveWorldToStorage(app);
                  syncPlayerControls();
                  updateStats();
                }
              } catch {
                alert(t('app.jsonReadError'));
              }
            };
            reader.readAsText(file);
          }}
          isPaused={isPaused}
          togglePause={togglePause}
          globalTimeScale={globalTimeScale}
          setGlobalTimeScale={applyGlobalTimeScale}
          canUndo={appRef.current?.commandHistory.canUndo() ?? false}
          canRedo={appRef.current?.commandHistory.canRedo() ?? false}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onOpenHotkeys={() => setIsHotkeysOpen(true)}
          renderMode={renderMode}
          onToggleRenderMode={() => {
            const nextMode = renderMode === '2d' ? '3d' : '2d';
            setRenderMode(nextMode);
            if (appRef.current) {
              appRef.current.setRendererMode(nextMode);
            }
          }}
          showUIOverlays={showUIOverlays}
          setShowUIOverlays={applyShowUIOverlays}
          showAIDebug={showAIDebug}
          setShowAIDebug={applyShowAIDebug}
        />
      )}

      {/* Основная рабочая область (Flex-контейнер) */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* Левый док (Иерархия, Палитра, BT) */}
        {mode !== GameMode.GAME && (
          <LeftDock
            app={appRef.current}
            world={appRef.current?.world}
            selectedEntityId={selectedEntityId}
            onSelectEntity={(id) => {
              appRef.current?.selection.selectEntity(id, true);
            }}
            onFocusEntity={handleFocusEntity}
            onSelectSpawnPreset={handleSelectSpawnPreset}
            onSelectModular={(behavior, name) =>
              setPlacementMode({ kind: 'modular', behavior, name })
            }
            btData={btData}
            btBlackboard={btBlackboard}
            btSchema={btSchema}
            activeTab={leftDockTab}
            onTabChange={setLeftDockTab}
            onStartPicking={handleStartBBPicking}
            pickingKey={bbPicking?.key ?? null}
          />
        )}

        {/* Область отображения холста */}
        <div
          id="canvas-container"
          ref={(node) => {
            canvasWrapperRef.current = node;
            containerRef.current = node;
          }}
          style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={handleContextMenu}
        >
          {/* Статус-бар холста (зум, координаты, сброс вида, выбор манипулятора) */}
          {mode !== GameMode.GAME && (
            <CanvasHUD
              camera={appRef.current?.camera}
              cursorWorldPos={cursorWorldPos}
              onResetCamera={handleResetCamera}
              gizmoTool={gizmoTool}
              onSelectGizmoTool={applyGizmoTool}
            />
          )}

          {/* Внутриигровой интерфейс HUD */}
          {mode === GameMode.GAME && (
            <GameHUD world={appRef.current?.world} onExitToEditor={goToEditor} />
          )}

          {/* Нижняя панель группового выделения (Drawer) */}
          {mode !== GameMode.GAME && (
            <MultiSelectionDrawer
              selectedEntityIds={selectedEntityIds}
              selectedEntityId={selectedEntityId}
              world={appRef.current?.world}
              typeFilters={typeFilters}
              onToggleFilter={(type) =>
                setTypeFilters((prev) => ({
                  ...prev,
                  [type]: prev[type] === false ? true : false,
                }))
              }
              onSelectEntity={(id) => {
                appRef.current?.selection.selectEntity(id, false);
              }}
              onDeselectEntity={(id) => {
                appRef.current?.selection.deselectEntity(id);
              }}
              onClearSelection={() => {
                appRef.current?.selection.clear();
              }}
              onDeleteSelected={handleDeleteEntity}
            />
          )}

          {/* Плашка режима размещения */}
          {placementMode && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.stopPropagation()}
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
              <span>{t('app.placementPrompt')}</span>
              <button
                className="btn btn-sm"
                style={{ backgroundColor: '#c0392b' }}
                onClick={() => setPlacementMode(null)}
              >
                {t('common.cancel')}
              </button>
            </div>
          )}

          {/* Плашка режима выбора сущности для Blackboard */}
          {bbPicking && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              onMouseMove={(e) => e.stopPropagation()}
              onMouseUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => e.stopPropagation()}
              style={{
                position: 'absolute',
                top: 20,
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(142, 68, 173, 0.95)',
                padding: '10px 20px',
                borderRadius: '8px',
                display: 'flex',
                gap: '15px',
                alignItems: 'center',
                zIndex: 50,
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                color: '#fff',
                fontSize: '12px',
              }}
            >
              <span>🎯 {t('dock.blackboardPickingPrompt', { key: bbPicking.key })}</span>
              <button
                className="btn btn-sm"
                style={{ backgroundColor: '#c0392b', color: '#fff' }}
                onClick={() => setBbPicking(null)}
              >
                {t('common.cancel')}
              </button>
            </div>
          )}

          {/* Радиальное контекстное меню (Pie Menu) */}
          {pieMenuState && mode === GameMode.EDITOR && (
            <PieMenu
              position={pieMenuState.screenPos}
              title={
                pieMenuState.targetEntityId
                  ? appRef.current?.world.getComponent(pieMenuState.targetEntityId, 'meta')?.name ||
                    pieMenuState.targetEntityId
                  : t('app.pieQuickSpawn')
              }
              onClose={closePieMenu}
              items={
                pieMenuState.targetEntityId
                  ? [
                      {
                        id: 'clone',
                        label:
                          pieMenuState.targetEntityIds.length > 1
                            ? t('pieMenu.cloneCount', {
                                count: pieMenuState.targetEntityIds.length,
                              })
                            : t('pieMenu.clone'),
                        icon: '📑',
                        color: '#27ae60',
                        onSelect: () => {
                          const app = appRef.current;
                          if (!app) return;
                          const idsToClone =
                            pieMenuState.targetEntityIds.length > 0
                              ? pieMenuState.targetEntityIds
                              : [pieMenuState.targetEntityId!];
                          app.duplicateEntities(idsToClone, EDITOR_CONFIG.cloneOffset);
                          syncPlayerControls();
                          updateStats();
                        },
                      },
                      {
                        id: 'focus',
                        label: t('pieMenu.focus'),
                        icon: '🎯',
                        color: '#3498db',
                        onSelect: () => {
                          if (pieMenuState.targetEntityId) {
                            handleFocusEntity(pieMenuState.targetEntityId);
                          }
                        },
                      },
                      {
                        id: 'inspect_bt',
                        label: t('pieMenu.inspectBt'),
                        icon: '🧠',
                        color: '#9b59b6',
                        onSelect: () => {
                          if (pieMenuState.targetEntityId) {
                            appRef.current?.selection.selectEntity(
                              pieMenuState.targetEntityId,
                              true
                            );
                            setLeftDockTab('bt');
                          }
                        },
                      },
                      {
                        id: 'delete',
                        label:
                          pieMenuState.targetEntityIds.length > 1
                            ? t('pieMenu.deleteCount', {
                                count: pieMenuState.targetEntityIds.length,
                              })
                            : t('pieMenu.delete'),
                        icon: '🗑️',
                        danger: true,
                        onSelect: () => {
                          handleDeleteEntity();
                        },
                      },
                    ]
                  : [
                      {
                        id: 'spawn_player',
                        label: t('pieMenu.player'),
                        icon: '🎮',
                        onSelect: () => {
                          const app = appRef.current;
                          if (!app) return;
                          app.executeTransaction(t('history.spawnPlayer'), () => {
                            const id = app.entityFactory.spawnModularHumanoid(
                              app.world,
                              app.physics,
                              app.aiSystem,
                              pieMenuState.worldPos,
                              'PlayerTree',
                              t('palette.player')
                            );
                            app.selection.selectEntity(id, true);
                            return id;
                          });
                          syncPlayerControls();
                        },
                      },
                      {
                        id: 'spawn_attacker',
                        label: t('pieMenu.attacker'),
                        icon: '⚔️',
                        onSelect: () => {
                          const app = appRef.current;
                          if (!app) return;
                          app.executeTransaction(t('history.spawnAttacker'), () => {
                            const id = app.entityFactory.spawnModularHumanoid(
                              app.world,
                              app.physics,
                              app.aiSystem,
                              pieMenuState.worldPos,
                              'AttackerTree',
                              t('palette.attacker')
                            );
                            app.selection.selectEntity(id, true);
                            return id;
                          });
                          syncPlayerControls();
                        },
                      },
                      {
                        id: 'spawn_wall',
                        label: t('pieMenu.wall'),
                        icon: '🧱',
                        onSelect: () => {
                          const app = appRef.current;
                          if (!app) return;
                          app.executeTransaction(t('history.spawnWall'), () => {
                            const id = app.spawnEntity(
                              {
                                tag: { archetype: 'obstacle' },
                                meta: {
                                  name: t('palette.wall'),
                                  entityType: 'obstacle',
                                  destructible: false,
                                },
                                physics: {
                                  radius: 54,
                                  weight: 1000,
                                  isSolid: true,
                                  points: createRectanglePoints(100, 40),
                                },
                              },
                              pieMenuState.worldPos
                            );
                            app.selection.selectEntity(id, true);
                            return id;
                          });
                          syncPlayerControls();
                        },
                      },
                      {
                        id: 'spawn_crate',
                        label: t('pieMenu.crate'),
                        icon: '📦',
                        onSelect: () => {
                          const app = appRef.current;
                          if (!app) return;
                          app.executeTransaction(t('history.spawnCrate'), () => {
                            const id = app.spawnEntity(
                              {
                                tag: { archetype: 'obstacle' },
                                meta: {
                                  name: t('palette.crate'),
                                  entityType: 'obstacle',
                                  destructible: true,
                                },
                                health: { hp: 100, maxHp: 100 },
                                physics: {
                                  radius: 42,
                                  weight: 50,
                                  isSolid: true,
                                  points: createRectanglePoints(60, 60),
                                },
                              },
                              pieMenuState.worldPos
                            );
                            app.selection.selectEntity(id, true);
                            return id;
                          });
                          syncPlayerControls();
                        },
                      },
                      {
                        id: 'spawn_fire_zone',
                        label: t('pieMenu.fireZone'),
                        icon: '🔥',
                        onSelect: () => {
                          const app = appRef.current;
                          if (!app) return;
                          app.executeTransaction(t('history.spawnFireZone'), () => {
                            const id = app.spawnEntity(
                              createZoneConfig('damage', 70, 15, t('palette.zoneFire')),
                              pieMenuState.worldPos
                            );
                            app.selection.selectEntity(id, true);
                            return id;
                          });
                          syncPlayerControls();
                        },
                      },
                      {
                        id: 'spawn_spear',
                        label: t('pieMenu.spear'),
                        icon: '🗡️',
                        onSelect: () => {
                          const app = appRef.current;
                          if (!app) return;
                          app.executeTransaction(t('history.spawnSpear'), () => {
                            const id = app.spawnEntity(
                              {
                                tag: { archetype: 'item', subType: 'weapon' },
                                item: {
                                  name: t('palette.spear'),
                                  type: 'weapon',
                                  maxStack: 1,
                                  size: 10,
                                  equipTypes: [],
                                  equippable: false,
                                  equipTimeMultiplier: 1.0,
                                },
                                physics: { radius: 16, weight: 1, isSolid: true },
                                weaponStats: { baseDamage: 25, prepTime: 0.2, recoveryTime: 0.3 },
                                weaponZone: { hitZoneType: 'forward_line', length: 150 },
                              },
                              pieMenuState.worldPos
                            );
                            app.selection.selectEntity(id, true);
                            return id;
                          });
                          syncPlayerControls();
                        },
                      },
                    ]
              }
            />
          )}
        </div>

        {/* Правый док (Живой Инспектор) */}
        {mode !== GameMode.GAME && (
          <Inspector
            app={appRef.current}
            mode={mode}
            selectedEntityId={selectedEntityId}
            world={appRef.current?.world}
            onCommitHistory={handleCommitHistory}
            handleDeleteEntity={handleDeleteEntity}
          />
        )}
      </div>

      <HotkeysModal isOpen={isHotkeysOpen} onClose={() => setIsHotkeysOpen(false)} />
      <DragGhostOverlay />
    </div>
  );
};
