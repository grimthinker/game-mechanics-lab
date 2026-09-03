import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameApp } from './GameApp';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { ItemData, StandardRadius } from './ecs/types';
import { BTNodeDTO } from './ai/core';
import { createDefaultCreatureConfig } from './Creature';
import { serializeBTNode } from './ai/serializer';
import { SpawnModal, CreatureEditModal, ItemSpawnModal, ItemEditModal } from './components/modals';
import { useBTPanelState } from './hooks/useBTPanelState';
import { useGameModals } from './hooks/useGameModals';
import { BTPanel } from './components/BTPanel';
import { Toolbar } from './components/Toolbar';
import { CreatureStats, PlacementMode } from './types';
import { EntityAdapter } from './EntityAdapter';
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
  const [selectedStats, setSelectedStats] = useState<CreatureStats | null>(null);
  const [selectedItemData, setSelectedItemData] = useState<{ id: string; data: ItemData } | null>(null);
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

  const modals = useGameModals({ appRef, updateStats: () => updateStats() });

  const updateStats = useCallback(() => {
    const app = appRef.current;
    if (!app) return;

    const currentMode = modeRef.current;

    if (currentMode === GameMode.GAME) {
      const isAnyPlayerAlive = app.world.getAllEntities().some(([_, comp]) => 
        (comp.stats?.behavior?.current ?? comp.meta?.config?.behavior) === 'PlayerTree' && comp.health?.isAlive
      );
      if (!isAnyPlayerAlive) {
        setModeSync(GameMode.SIMULATION);
        app.isPaused = true;
        setIsPaused(true);
      }
    }

    let targetId = app.selectedCreature?.id;

    if (targetId) {
      const c = new EntityAdapter(targetId, app.world);
      const eq = c.equip;

      setSelectedStats({
        id: c.id,
        behavior: c.behavior,
        radius: c.radius,
        weight: c.weight,
        currentSpeed: c.currentSpeed,
        currentTurnSpeed: (c.currentTurnSpeed * 180) / Math.PI,
        maxSpeed: c.maxSpeed,
        maxTurnSpeed: (c.maxTurnSpeed * 180) / Math.PI,
        hp: c.hp,
        maxHp: c.maxHp,
        state: c.state,
        equipSlots: eq ? eq.slots.map((s) => ({
             type: s.type,
             item: s.itemId ? (app.world.getComponent(s.itemId, 'item') ?? null) : null,
        })) : [],
      });
      setSelectedItemData(null);
      setBtData(!c.brain || !c.brain.root_node ? null : serializeBTNode(c.brain.root_node));
      setBtBlackboard(!c.brain ? null : c.brain.blackboard.getData());
    } else if (app.selectedItem) {
      setSelectedItemData({ id: app.selectedItem.id, data: JSON.parse(JSON.stringify(app.selectedItem.data)) });
      setSelectedStats(null);
      setBtData(null);
      setBtBlackboard(null);
    } else {
      setSelectedStats(null);
      setSelectedItemData(null);
      setBtData(null);
      setBtBlackboard(null);
    }
  }, [setModeSync]);

  const { syncPlayerControls } = useKeyboardControls({
    isModalOpen:
      modals.isModalOpen ||
      modals.isItemSpawnModalOpen ||
      !!modals.selectedItemForEdit ||
      isPaused,
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

  useEffect(() => {
    if (!canvasRef.current) return;
    const app = new GameApp(canvasRef.current);
    appRef.current = app;

    app.gameMode = modeRef.current;
    app.isPaused = true;
    setIsPaused(true);

    app.start();
    app.onFrame = updateStats;
    app.spawnCreature(createDefaultCreatureConfig('PlayerTree'));
    updateStats();

    return () => {
      app.destroy();
      appRef.current = null;
    };
  }, [canvasRef, updateStats]);

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

  const goToGame = useCallback(
    () => {
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
    },
    [updateStats, setShowBTPanel, setModeSync]
  );

  const handleSpawnConfirm = () => {
    if (!modals.pendingSpawnBehavior) return;
    setPlacementMode({
      kind: 'creature',
      config: {
        behavior: modals.pendingSpawnBehavior,
        radius: modals.radius,
        weight: modals.weight,
        isSolid: true,
        maxSpeed: modals.maxSpeed,
        maxTurnSpeed: modals.maxTurnSpeed,
        runSpeedMultiplier: modals.runSpeedMultiplier,
        crouchSpeedMultiplier: modals.crouchSpeedMultiplier,
        crouchStealthMultiplier: modals.crouchStealthMultiplier,
        runTurnMultiplier: modals.runTurnMultiplier,
        crouchTurnMultiplier: modals.crouchTurnMultiplier,
        hp: 100,
        maxHp: 100,
      },
    });
    modals.closeSpawnModal();
  };

  const handleItemSpawnConfirm = (itemData: ItemData, isSolid: boolean, radius: StandardRadius) => {
    setPlacementMode({
      kind: 'item',
      itemData,
      isSolid,
      radius,
    });
    modals.closeItemSpawnModal();
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
    setShowBTPanel
  });
  
  const selectedItemEntityId = modals.selectedItemForEdit?.id;
  const bagInventory = selectedItemEntityId ? appRef.current?.world.getComponent(selectedItemEntityId, 'inventory') : undefined;

  const isBagInventoryEmpty =
    !bagInventory ||
    bagInventory.slots.every((row) => row.every((cell) => !cell.itemId));

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
            <button className="btn btn-sm" style={{ backgroundColor: '#c0392b' }} onClick={() => setPlacementMode(null)}>
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
        selectedStats={selectedStats}
        selectedItemData={selectedItemData}
        fileInputRef={fileInputRef}
        worldFileInputRef={worldFileInputRef}
        onNewWorld={() => {
          appRef.current?.clearWorld();
          syncPlayerControls();
          updateStats();
        }}
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
        openEditModal={modals.openEditModal}
        handleDeleteEntity={handleDeleteEntity}
        openItemEditModal={modals.openItemEditModal}
        isPaused={isPaused}
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
        onClose={modals.closeSpawnModal}
        onConfirm={handleSpawnConfirm}
      />

      <ItemSpawnModal
        isOpen={modals.isItemSpawnModalOpen}
        onClose={modals.closeItemSpawnModal}
        onConfirm={handleItemSpawnConfirm}
      />

<CreatureEditModal
        isOpen={modals.isEditModalOpen}
        isReadOnly={isReadOnly}
        editBehavior={modals.editBehavior}
        setEditBehavior={modals.setEditBehavior}
        editIsSolid={modals.editIsSolid}
        setEditIsSolid={modals.setEditIsSolid}
        editRadius={modals.editRadius}
        setEditRadius={modals.setEditRadius}
        editBaseRadius={modals.editBaseRadius}
        setEditBaseRadius={modals.setEditBaseRadius}
        editWeight={modals.editWeight}
        setEditWeight={modals.setEditWeight}
        editBaseWeight={modals.editBaseWeight}
        setEditBaseWeight={modals.setEditBaseWeight}
        editHp={modals.editHp}
        setEditHp={modals.setEditHp}
        editMaxHp={modals.editMaxHp}
        setEditMaxHp={modals.setEditMaxHp}
        editMaxSpeed={modals.editMaxSpeed}
        setEditMaxSpeed={modals.setEditMaxSpeed}
        editMaxTurnSpeed={modals.editMaxTurnSpeed}
        setEditMaxTurnSpeed={modals.setEditMaxTurnSpeed}
        editRunSpeedMultiplier={modals.editRunSpeedMultiplier}
        setEditRunSpeedMultiplier={modals.setEditRunSpeedMultiplier}
        editCrouchSpeedMultiplier={modals.editCrouchSpeedMultiplier}
        setEditCrouchSpeedMultiplier={modals.setEditCrouchSpeedMultiplier}
        editCrouchStealthMultiplier={modals.editCrouchStealthMultiplier}
        setEditCrouchStealthMultiplier={modals.setEditCrouchStealthMultiplier}
        editRunTurnMultiplier={modals.editRunTurnMultiplier}
        setEditRunTurnMultiplier={modals.setEditRunTurnMultiplier}
        editCrouchTurnMultiplier={modals.editCrouchTurnMultiplier}
        setEditCrouchTurnMultiplier={modals.setEditCrouchTurnMultiplier}
        onClose={modals.closeEditModal}
        onConfirm={modals.handleEditConfirm}
      />

      <ItemEditModal
        item={modals.selectedItemForEdit}
        isReadOnly={isReadOnly}
        isBagInventoryEmpty={isBagInventoryEmpty}
        inventorySlots={bagInventory?.slots.map((row) => row.map((cell) => ({
          count: cell.count,
          item: cell.itemId ? (appRef.current?.world.getComponent(cell.itemId, 'item') ?? null) : null
        })))}
        inventorySize={bagInventory?.size}
        onItemClick={modals.openItemEditModal}
        onClose={modals.closeItemEditModal}
        onConfirm={modals.handleItemEditConfirm}
      />
    </div>
  );
};