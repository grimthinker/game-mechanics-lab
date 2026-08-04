import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameApp } from './GameApp';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useKeyboardControls } from './hooks/useKeyboardControls';
import { CreatureType, CreatureState, EquipSlot, ItemData, StandardRadius } from './ecs/types';
import { BTNodeDTO } from './ai/core';
import { serializeBTNode } from './ai/serializer';
import { SpawnModal, CreatureEditModal, WeaponEditModal, ArmorEditModal, BagEditModal } from './components/modals';
import { useBTPanelState } from './hooks/useBTPanelState';
import { useGameModals } from './hooks/useGameModals';
import { BTPanel } from './components/BTPanel';
import { Toolbar } from './components/Toolbar';
import { CreatureStats, PlacementConfig } from './types';


export const App: React.FC = () => {
  const appRef = useRef<GameApp | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const worldFileInputRef = useRef<HTMLInputElement | null>(null);

  const [obstaclesEnabled, setObstaclesEnabled] = useState(true);
  const [selectedStats, setSelectedStats] = useState<CreatureStats | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [placementConfig, setPlacementConfig] = useState<PlacementConfig | null>(null);

  const [btData, setBtData] = useState<BTNodeDTO | null>(null);
  const [btBlackboard, setBtBlackboard] = useState<Record<string, any> | null>(null);

  const {
    showBTPanel, setShowBTPanel,
    btPanelWidth, isResizingBT, setIsResizingBT,
    blackboardHeight, isResizingBB, setIsResizingBB,
  } = useBTPanelState();

  const modals = useGameModals({ appRef, updateStats: () => updateStats() });

  const updateStats = useCallback(() => {
    const app = appRef.current;
    if (!app || !app.selectedCreature) {
      setSelectedStats(null);
      setBtData(null);
      setBtBlackboard(null);
      return;
    }

    const c = app.selectedCreature;
    const eq = c.equip;
    const inv = c.inventory;

    setSelectedStats({
      type: c.type,
      radius: c.radius,
      mass: c.mass,
      currentSpeed: c.currentSpeed,
      currentTurnSpeed: (c.currentTurnSpeed * 180) / Math.PI,
      maxSpeed: c.maxSpeed,
      maxTurnSpeed: (c.maxTurnSpeed * 180) / Math.PI,
      hp: c.hp,
      maxHp: c.maxHp,
      state: c.state,
      equipSlots: eq ? eq.slots.map((s) => ({ ...s })) : [],
      inventory: inv
        ? {
            size: { ...inv.size },
            slots: inv.slots.map((row) => row.map((cell) => ({ ...cell }))),
          }
        : undefined,
    });

    setBtData((!c.brain || !c.brain.root_node) ? null : serializeBTNode(c.brain.root_node));
    setBtBlackboard((!c.brain) ? null : c.brain.blackboard.getData());
  }, []);

  const { syncPlayerControls } = useKeyboardControls({
    appRef,
    isModalOpen:
      modals.isModalOpen ||
      !!modals.selectedWeaponForEdit ||
      !!modals.selectedArmorForEdit ||
      !!modals.selectedBagForEdit ||
      isPaused,
    isEditModalOpen: modals.isEditModalOpen,
    updateStats,
  });

  const { canvasRef, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave } =
    useCanvasInteraction({
      appRef,
      placementConfig,
      setPlacementConfig,
      syncPlayerControls,
      updateStats,
    });

  useEffect(() => {
    if (!canvasRef.current) return;
    const app = new GameApp(canvasRef.current);
    appRef.current = app;
    app.start();
    app.onFrame = updateStats;
    app.spawnCreature('player');
    updateStats();

    return () => {
      app.destroy();
      appRef.current = null;
    };
  }, [canvasRef, updateStats]);

  const togglePause = useCallback(() => {
    const app = appRef.current;
    if (!app) return;
    
    // Если снимаем с паузы и в этот момент перетаскивали существо — отменяем перетаскивание
    if (!app.isPaused && app.isDraggingCreature()) {
      app.cancelCreatureDrag();
      updateStats();
    }

    const nextState = !app.isPaused;
    app.isPaused = nextState;
    setIsPaused(nextState);
  }, [updateStats]);

  const handleSpawnConfirm = () => {
    if (!modals.pendingSpawnType) return;
    setPlacementConfig({
      type: modals.pendingSpawnType,
      radius: modals.radius,
      mass: modals.mass,
      maxSpeed: modals.maxSpeed,
      maxTurnSpeed: modals.maxTurnSpeed,
      runSpeedMultiplier: modals.runSpeedMultiplier,
      crouchSpeedMultiplier: modals.crouchSpeedMultiplier,
      crouchStealthMultiplier: modals.crouchStealthMultiplier,
    });
    modals.closeSpawnModal();
  };

  const handleDeleteCreature = () => {
    const app = appRef.current;
    if (!app) return;
    app.deleteSelectedCreature();
    syncPlayerControls();
    updateStats();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        if (modals.selectedWeaponForEdit) modals.closeWeaponEditModal();
        else if (modals.selectedArmorForEdit) modals.closeArmorEditModal();
        else if (modals.selectedBagForEdit) modals.closeBagEditModal();
        else if (modals.isEditModalOpen) modals.closeEditModal();
        else if (modals.isModalOpen) modals.closeSpawnModal();
      } else if (e.key === 'Enter' || e.code === 'Enter') {
        if (modals.isModalOpen) { e.preventDefault(); handleSpawnConfirm(); }
        else if (modals.isEditModalOpen) { e.preventDefault(); modals.handleEditConfirm(); }
        else if (modals.selectedWeaponForEdit) { e.preventDefault(); modals.handleWeaponEditConfirm(); }
        else if (modals.selectedArmorForEdit) { e.preventDefault(); modals.handleArmorEditConfirm(); }
        else if (modals.selectedBagForEdit) { e.preventDefault(); modals.handleBagEditConfirm(); }
      } else if (e.code === 'Space' || e.key === ' ') {
        if (
          modals.isModalOpen ||
          modals.isEditModalOpen ||
          modals.selectedWeaponForEdit ||
          modals.selectedArmorForEdit ||
          modals.selectedBagForEdit
        ) {
          return;
        }

        const app = appRef.current;
        const hasSelected = !!app?.selectedCreature;

        if (!hasSelected || e.ctrlKey || e.metaKey) {
          e.preventDefault();
          togglePause();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modals, togglePause, handleSpawnConfirm]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'KeyU' || e.key.toLowerCase() === 'u') {
        setShowBTPanel((prev) => !prev);
        e.preventDefault();
      } else if (e.ctrlKey && (e.code === 'KeyB' || e.key.toLowerCase() === 'b')) {
        modals.setPendingSpawnType('ai');
        modals.openSpawnModal('ai');
        e.preventDefault();
      } else if (e.ctrlKey && (e.code === 'KeyP' || e.key.toLowerCase() === 'p')) {
        modals.setPendingSpawnType('player');
        modals.openSpawnModal('player');
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modals, setShowBTPanel]);

  const isBagInventoryEmpty =
    !selectedStats?.inventory ||
    selectedStats.inventory.slots.every((row) => row.every((cell) => !cell.item));

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
        {placementConfig && (
          <div
            style={{
              position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
              backgroundColor: 'rgba(41, 128, 185, 0.9)', padding: '10px 20px', borderRadius: '8px',
              display: 'flex', gap: '15px', alignItems: 'center', zIndex: 50, boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <span>Выберите место для спавна на поле</span>
            <button className="btn btn-sm" style={{ backgroundColor: '#c0392b' }} onClick={() => setPlacementConfig(null)}>
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
        obstaclesEnabled={obstaclesEnabled}
        setObstaclesEnabled={(val) => {
          setObstaclesEnabled(val);
          appRef.current?.physics.setObstaclesEnabled(val);
        }}
        setObstaclesData={(data) => appRef.current?.loadObstaclesFromData(data)}
        selectedStats={selectedStats}
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
        openEditModal={modals.openEditModal}
        handleDeleteCreature={handleDeleteCreature}
        openItemEditModal={modals.openItemEditModal}
        isPaused={isPaused} // <--- Передаем состояние паузы в Toolbar
      />

      <SpawnModal
        isOpen={modals.isModalOpen}
        pendingSpawnType={modals.pendingSpawnType}
        radius={modals.radius} setRadius={modals.setRadius}
        mass={modals.mass} setMass={modals.setMass}
        maxSpeed={modals.maxSpeed} setMaxSpeed={modals.setMaxSpeed}
        maxTurnSpeed={modals.maxTurnSpeed} setMaxTurnSpeed={modals.setMaxTurnSpeed}
        runSpeedMultiplier={modals.runSpeedMultiplier} setRunSpeedMultiplier={modals.setRunSpeedMultiplier}
        crouchSpeedMultiplier={modals.crouchSpeedMultiplier} setCrouchSpeedMultiplier={modals.setCrouchSpeedMultiplier}
        crouchStealthMultiplier={modals.crouchStealthMultiplier} setCrouchStealthMultiplier={modals.setCrouchStealthMultiplier}
        runTurnMultiplier={modals.runTurnMultiplier} setRunTurnMultiplier={modals.setRunTurnMultiplier}
        crouchTurnMultiplier={modals.crouchTurnMultiplier} setCrouchTurnMultiplier={modals.setCrouchTurnMultiplier}
        onClose={modals.closeSpawnModal}
        onConfirm={handleSpawnConfirm}
      />

      <CreatureEditModal
        isOpen={modals.isEditModalOpen}
        editRadius={modals.editRadius} setEditRadius={modals.setEditRadius}
        editHp={modals.editHp} setEditHp={modals.setEditHp}
        editMaxHp={modals.editMaxHp} setEditMaxHp={modals.setEditMaxHp}
        editMaxSpeed={modals.editMaxSpeed} setEditMaxSpeed={modals.setEditMaxSpeed}
        editMaxTurnSpeed={modals.editMaxTurnSpeed} setEditMaxTurnSpeed={modals.setEditMaxTurnSpeed}
        editRunSpeedMultiplier={modals.editRunSpeedMultiplier} setEditRunSpeedMultiplier={modals.setEditRunSpeedMultiplier}
        editCrouchSpeedMultiplier={modals.editCrouchSpeedMultiplier} setEditCrouchSpeedMultiplier={modals.setEditCrouchSpeedMultiplier}
        editCrouchStealthMultiplier={modals.editCrouchStealthMultiplier} setEditCrouchStealthMultiplier={modals.setEditCrouchStealthMultiplier}
        editRunTurnMultiplier={modals.editRunTurnMultiplier} setEditRunTurnMultiplier={modals.setEditRunTurnMultiplier}
        editCrouchTurnMultiplier={modals.editCrouchTurnMultiplier} setEditCrouchTurnMultiplier={modals.setEditCrouchTurnMultiplier}
        onClose={modals.closeEditModal}
        onConfirm={modals.handleEditConfirm}
      />

      <WeaponEditModal
        selectedWeaponForEdit={modals.selectedWeaponForEdit}
        editWeaponName={modals.editWeaponName} setEditWeaponName={modals.setEditWeaponName}
        editWeaponDamage={modals.editWeaponDamage} setEditWeaponDamage={modals.setEditWeaponDamage}
        editWeaponPrepTime={modals.editWeaponPrepTime} setEditWeaponPrepTime={modals.setEditWeaponPrepTime}
        editWeaponRecoveryTime={modals.editWeaponRecoveryTime} setEditWeaponRecoveryTime={modals.setEditWeaponRecoveryTime}
        editWeaponRange={modals.editWeaponRange} setEditWeaponRange={modals.setEditWeaponRange}
        editWeaponRadius={modals.editWeaponRadius} setEditWeaponRadius={modals.setEditWeaponRadius}
        editWeaponNumLines={modals.editWeaponNumLines} setEditWeaponNumLines={modals.setEditWeaponNumLines}
        editWeaponAngle={modals.editWeaponAngle} setEditWeaponAngle={modals.setEditWeaponAngle}
        editWeaponPierceObstacles={modals.editWeaponPierceObstacles} setEditWeaponPierceObstacles={modals.setEditWeaponPierceObstacles}
        editWeaponPiercePlayers={modals.editWeaponPiercePlayers} setEditWeaponPiercePlayers={modals.setEditWeaponPiercePlayers}
        editWeaponPierceBots={modals.editWeaponPierceBots} setEditWeaponPierceBots={modals.setEditWeaponPierceBots}
        onClose={modals.closeWeaponEditModal}
        onConfirm={modals.handleWeaponEditConfirm}
      />

      <ArmorEditModal
        selectedArmorForEdit={modals.selectedArmorForEdit}
        editArmorName={modals.editArmorName} setEditArmorName={modals.setEditArmorName}
        editArmorDefense={modals.editArmorDefense} setEditArmorDefense={modals.setEditArmorDefense}
        editArmorFlatReduction={modals.editArmorFlatReduction} setEditArmorFlatReduction={modals.setEditArmorFlatReduction}
        editArmorWeight={modals.editArmorWeight} setEditArmorWeight={modals.setEditArmorWeight}
        onClose={modals.closeArmorEditModal}
        onConfirm={modals.handleArmorEditConfirm}
      />

      <BagEditModal
        selectedBagForEdit={modals.selectedBagForEdit}
        editBagName={modals.editBagName} setEditBagName={modals.setEditBagName}
        editBagWidth={modals.editBagWidth} setEditBagWidth={modals.setEditBagWidth}
        editBagHeight={modals.editBagHeight} setEditBagHeight={modals.setEditBagHeight}
        editBagWeight={modals.editBagWeight} setEditBagWeight={modals.setEditBagWeight}
        isBagInventoryEmpty={isBagInventoryEmpty}
        inventorySlots={selectedStats?.inventory?.slots}
        inventorySize={selectedStats?.inventory?.size}
        onItemClick={modals.openItemEditModal}
        onClose={modals.closeBagEditModal}
        onConfirm={modals.handleBagEditConfirm}
      />
    </div>
  );
};