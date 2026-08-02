import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameApp } from './GameApp';
import { useCanvasInteraction } from './useCanvasInteraction';
import { useKeyboardControls } from './useKeyboardControls';
import {
  SpawnModal,
  CreatureEditModal,
  WeaponEditModal,
  ArmorEditModal,
  BagEditModal,
} from './components/Modals';
import {
  CreatureType,
  CreatureState,
  WeaponConfig,
  ArmorConfig,
  InventoryConfig,
  ItemData,
  EquipSlot,
  StandardRadius,
} from './ecs/types';
import { BTNodeDTO } from './ai/core';
import { BTGraph } from './components/BTGraph';

interface CreatureStats {
  type: CreatureType;
  radius: number;
  mass: number;
  currentSpeed: number;
  currentTurnSpeed: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  hp: number;
  maxHp: number;
  state: CreatureState;
  equipSlots: EquipSlot[];
  inventory?: {
    size: { width: number; height: number };
    slots: { item: ItemData | null; count: number }[][];
  };
}

interface PlacementConfig {
  type: CreatureType;
  radius: StandardRadius;
  mass: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  crouchStealthMultiplier: number;
}

export const App: React.FC = () => {
  const appRef = useRef<GameApp | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const worldFileInputRef = useRef<HTMLInputElement | null>(null);

  const [obstaclesEnabled, setObstaclesEnabled] = useState(true);
  const [selectedStats, setSelectedStats] = useState<CreatureStats | null>(null);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingSpawnType, setPendingSpawnType] = useState<CreatureType | null>(null);
  const [radius, setRadius] = useState<StandardRadius>(24);
  const [mass, setMass] = useState<number>(10);
  const [maxSpeed, setMaxSpeed] = useState<number>(150);
  const [maxTurnSpeed, setMaxTurnSpeed] = useState<number>(270);
  const [runSpeedMultiplier, setRunSpeedMultiplier] = useState<number>(1.5);
  const [crouchSpeedMultiplier, setCrouchSpeedMultiplier] = useState<number>(0.5);
  const [crouchStealthMultiplier, setCrouchStealthMultiplier] = useState<number>(1.5);

  const [placementConfig, setPlacementConfig] = useState<PlacementConfig | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRadius, setEditRadius] = useState<StandardRadius>(24);
  const [editMaxSpeed, setEditMaxSpeed] = useState<number>(150);
  const [editMaxTurnSpeed, setEditMaxTurnSpeed] = useState<number>(270);
  const [editHp, setEditHp] = useState<number>(100);
  const [editMaxHp, setEditMaxHp] = useState<number>(100);
  const [editRunSpeedMultiplier, setEditRunSpeedMultiplier] = useState<number>(1.5);
  const [editCrouchSpeedMultiplier, setEditCrouchSpeedMultiplier] = useState<number>(0.5);
  const [editCrouchStealthMultiplier, setEditCrouchStealthMultiplier] = useState<number>(1.5);

  const [selectedWeaponForEdit, setSelectedWeaponForEdit] = useState<WeaponConfig | null>(null);
  const [editWeaponName, setEditWeaponName] = useState<string>('');
  const [editWeaponDamage, setEditWeaponDamage] = useState<number>(25);
  const [editWeaponPrepTime, setEditWeaponPrepTime] = useState<number>(0.2);
  const [editWeaponRecoveryTime, setEditWeaponRecoveryTime] = useState<number>(0.3);
  const [editWeaponRange, setEditWeaponRange] = useState<number>(0);
  const [editWeaponRadius, setEditWeaponRadius] = useState<number>(0);
  const [editWeaponNumLines, setEditWeaponNumLines] = useState<number>(1);
  const [editWeaponAngle, setEditWeaponAngle] = useState<number>(0);
  const [editWeaponPierceObstacles, setEditWeaponPierceObstacles] = useState<boolean>(false);
  const [editWeaponPiercePlayers, setEditWeaponPiercePlayers] = useState<boolean>(false);
  const [editWeaponPierceBots, setEditWeaponPierceBots] = useState<boolean>(false);

  const [selectedArmorForEdit, setSelectedArmorForEdit] = useState<ArmorConfig | null>(null);
  const [editArmorName, setEditArmorName] = useState<string>('');
  const [editArmorDefense, setEditArmorDefense] = useState<number>(15);
  const [editArmorFlatReduction, setEditArmorFlatReduction] = useState<number>(3);
  const [editArmorWeight, setEditArmorWeight] = useState<number>(3);

  const [selectedBagForEdit, setSelectedBagForEdit] = useState<InventoryConfig | null>(null);
  const [editBagName, setEditBagName] = useState<string>('');
  const [editBagWidth, setEditBagWidth] = useState<number>(6);
  const [editBagHeight, setEditBagHeight] = useState<number>(4);
  const [editBagWeight, setEditBagWeight] = useState<number>(1);
  
  const [showBTPanel, setShowBTPanel] = useState<boolean>(false);
  const [btData, setBtData] = useState<BTNodeDTO | null>(null);

  const updateStats = useCallback(() => {
    const app = appRef.current;
    if (!app || !app.selectedCreature) {
      setSelectedStats(null);
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
    setBtData(app.getSelectedCreatureBT());
  }, []);

  const { syncPlayerControls } = useKeyboardControls({
    appRef,
    isModalOpen:
      isModalOpen ||
      !!selectedWeaponForEdit ||
      !!selectedArmorForEdit ||
      !!selectedBagForEdit ||
      isPaused,
    isEditModalOpen,
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
    const nextState = !app.isPaused;
    app.isPaused = nextState;
    setIsPaused(nextState);
  }, []);

  const openSpawnModal = (type: CreatureType) => {
    setPendingSpawnType(type);
    setIsModalOpen(true);
  };

  const closeSpawnModal = () => {
    setPendingSpawnType(null);
    setIsModalOpen(false);
  };

  const handleSpawnConfirm = () => {
    if (!pendingSpawnType) return;
    setPlacementConfig({
      type: pendingSpawnType,
      radius,
      mass,
      maxSpeed,
      maxTurnSpeed,
      runSpeedMultiplier,
      crouchSpeedMultiplier,
      crouchStealthMultiplier,
    });
    closeSpawnModal();
  };

  const openEditModal = () => {
    const c = appRef.current?.selectedCreature;
    if (!c) return;
    setEditRadius(c.radius);
    setEditMaxSpeed(c.maxSpeed);
    setEditMaxTurnSpeed(Math.round((c.maxTurnSpeed * 180) / Math.PI));
    setEditHp(c.hp);
    setEditMaxHp(c.maxHp);
    setEditRunSpeedMultiplier(c.runSpeedMultiplier);
    setEditCrouchSpeedMultiplier(c.crouchSpeedMultiplier);
    setEditCrouchStealthMultiplier(c.crouchStealthMultiplier);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
  };

  const handleEditConfirm = () => {
    const c = appRef.current?.selectedCreature;
    if (!c) return;
    c.updateParams({
      radius: editRadius,
      maxSpeed: editMaxSpeed,
      maxTurnSpeed: (editMaxTurnSpeed * Math.PI) / 180,
      hp: editHp,
      maxHp: editMaxHp,
      runSpeedMultiplier: editRunSpeedMultiplier,
      crouchSpeedMultiplier: editCrouchSpeedMultiplier,
      crouchStealthMultiplier: editCrouchStealthMultiplier,
    });
    closeEditModal();
    updateStats();
  };

  const openWeaponEditModal = (weapon: WeaponConfig) => {
    const w = weapon as any;
    const zone = w.zone || {};
    setSelectedWeaponForEdit(weapon);
    setEditWeaponName(w.name || '');
    setEditWeaponDamage(w.baseDamage ?? 25);
    setEditWeaponPrepTime(w.prepTime ?? 0.2);
    setEditWeaponRecoveryTime(w.recoveryTime ?? 0.3);
    setEditWeaponRange(zone.length ?? zone.range ?? 0);
    setEditWeaponRadius(zone.radius ?? zone.offsetDistance ?? 0);
    setEditWeaponNumLines(zone.rayCount ?? zone.numLines ?? zone.lines ?? 1);
    setEditWeaponAngle(zone.angle !== undefined ? Math.round((zone.angle * 180) / Math.PI) : 0);
    setEditWeaponPierceObstacles(!!zone.pierceObstacles);
    setEditWeaponPiercePlayers(!!zone.piercePlayers);
    setEditWeaponPierceBots(!!zone.pierceBots);
  };

  const closeWeaponEditModal = () => {
    setSelectedWeaponForEdit(null);
  };

  const handleWeaponEditConfirm = () => {
    if (!selectedWeaponForEdit) return;
    const w = selectedWeaponForEdit as any;
    if (!w.zone) w.zone = {};

    w.name = editWeaponName;
    w.baseDamage = editWeaponDamage;
    w.prepTime = editWeaponPrepTime;
    w.recoveryTime = editWeaponRecoveryTime;

    if (w.zone.length !== undefined || w.zone.range !== undefined || editWeaponRange > 0) {
      if (w.zone.length !== undefined) w.zone.length = editWeaponRange;
      if (w.zone.range !== undefined) w.zone.range = editWeaponRange;
      if (w.zone.length === undefined && w.zone.range === undefined) w.zone.length = editWeaponRange;
    }

    if (w.zone.radius !== undefined) {
      w.zone.radius = editWeaponRadius;
    } else if (w.zone.offsetDistance !== undefined && w.zone.hitZoneType === 'offset_radius') {
      w.zone.radius = editWeaponRadius;
    }

    if (w.zone.rayCount !== undefined) w.zone.rayCount = editWeaponNumLines;
    if (w.zone.numLines !== undefined) w.zone.numLines = editWeaponNumLines;
    if (w.zone.lines !== undefined) w.zone.lines = editWeaponNumLines;

    if (w.zone.angle !== undefined) {
      w.zone.angle = (editWeaponAngle * Math.PI) / 180;
    }

    w.zone.pierceObstacles = editWeaponPierceObstacles;
    w.zone.piercePlayers = editWeaponPiercePlayers;
    w.zone.pierceBots = editWeaponPierceBots;

    closeWeaponEditModal();
    updateStats();
  };

  const openArmorEditModal = (armor: ArmorConfig) => {
    setSelectedArmorForEdit(armor);
    setEditArmorName(armor.name || '');
    setEditArmorDefense(armor.defense ?? 15);
    setEditArmorFlatReduction(armor.flat_reduction ?? 3);
    setEditArmorWeight(armor.invWeight ?? 3);
  };

  const closeArmorEditModal = () => {
    setSelectedArmorForEdit(null);
  };

  const handleArmorEditConfirm = () => {
    if (!selectedArmorForEdit) return;
    selectedArmorForEdit.name = editArmorName;
    selectedArmorForEdit.defense = editArmorDefense;
    selectedArmorForEdit.flat_reduction = editArmorFlatReduction;
    selectedArmorForEdit.invWeight = editArmorWeight;
    closeArmorEditModal();
    updateStats();
  };

  const openBagEditModal = (bag: InventoryConfig) => {
    setSelectedBagForEdit(bag);
    setEditBagName(bag.name || '');
    setEditBagWidth(bag.size?.width ?? 6);
    setEditBagHeight(bag.size?.height ?? 4);
    setEditBagWeight(bag.invWeight ?? 1);
  };

  const closeBagEditModal = () => {
    setSelectedBagForEdit(null);
  };

  const handleBagEditConfirm = () => {
    if (!selectedBagForEdit) return;
    selectedBagForEdit.name = editBagName;
    selectedBagForEdit.invWeight = editBagWeight;

    const c = appRef.current?.selectedCreature;
    const isInventoryEmpty =
      !c?.inventory ||
      c.inventory.slots.every((row) => row.every((cell) => !cell.item));

    if (
      isInventoryEmpty &&
      (selectedBagForEdit.size.width !== editBagWidth ||
        selectedBagForEdit.size.height !== editBagHeight)
    ) {
      selectedBagForEdit.size = { width: editBagWidth, height: editBagHeight };
      if (c) {
        c.updateInventorySize(editBagWidth, editBagHeight);
      }
    }

    closeBagEditModal();
    updateStats();
  };

  const openItemEditModal = (item: ItemData) => {
    if (!item.config) return;
    if (item.type === 'weapon') {
      closeArmorEditModal();
      closeBagEditModal();
      openWeaponEditModal(item.config as WeaponConfig);
    } else if (item.type === 'armor') {
      closeWeaponEditModal();
      closeBagEditModal();
      openArmorEditModal(item.config as ArmorConfig);
    } else if (item.type === 'bag') {
      closeWeaponEditModal();
      closeArmorEditModal();
      openBagEditModal(item.config as InventoryConfig);
    }
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
        if (selectedWeaponForEdit) {
          closeWeaponEditModal();
        } else if (selectedArmorForEdit) {
          closeArmorEditModal();
        } else if (selectedBagForEdit) {
          closeBagEditModal();
        } else if (isEditModalOpen) {
          closeEditModal();
        } else if (isModalOpen) {
          closeSpawnModal();
        }
      } else if (e.key === 'Enter' || e.code === 'Enter') {
        if (isModalOpen) {
          e.preventDefault();
          handleSpawnConfirm();
        } else if (isEditModalOpen) {
          e.preventDefault();
          handleEditConfirm();
        } else if (selectedWeaponForEdit) {
          e.preventDefault();
          handleWeaponEditConfirm();
        } else if (selectedArmorForEdit) {
          e.preventDefault();
          handleArmorEditConfirm();
        } else if (selectedBagForEdit) {
          e.preventDefault();
          handleBagEditConfirm();
        }
      } else if (e.code === 'Space' || e.key === ' ') {
        if (
          isModalOpen ||
          isEditModalOpen ||
          selectedWeaponForEdit ||
          selectedArmorForEdit ||
          selectedBagForEdit
        ) {
          return;
        }

        const app = appRef.current;
        const hasSelected = !!app?.selectedCreature;

        if (!hasSelected) {
          e.preventDefault();
          togglePause();
        } else if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          togglePause();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isModalOpen,
    isEditModalOpen,
    selectedWeaponForEdit,
    selectedArmorForEdit,
    selectedBagForEdit,
    togglePause,
    closeSpawnModal,
    closeEditModal,
    closeWeaponEditModal,
    closeArmorEditModal,
    closeBagEditModal,
    handleSpawnConfirm,
    handleEditConfirm,
    handleWeaponEditConfirm,
    handleArmorEditConfirm,
    handleBagEditConfirm,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'KeyU' || e.key.toLowerCase() === 'u') {
        setShowBTPanel((prev) => !prev);
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getSlotTypeName = (type: string) => {
    switch (type) {
      case 'armor':
        return 'Броня';
      case 'bag':
        return 'Сумка';
      case 'weapon':
        return 'Оружие';
      default:
        return type;
    }
  };

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
        {isPaused && (
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(231, 76, 60, 0.9)',
              color: '#fff',
              padding: '8px 20px',
              borderRadius: '8px',
              fontWeight: 'bold',
              zIndex: 50,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              pointerEvents: 'none',
              letterSpacing: '1px',
            }}
          >
            ПАУЗА
          </div>
        )}
        {placementConfig && (
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
              onClick={() => setPlacementConfig(null)}
            >
              Отмена
            </button>
          </div>
        )}
      </div>

      <div id="toolbar">
        <div className="tool-group">
          <h3>Мир</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="btn"
              onClick={() => {
                const app = appRef.current;
                if (!app) return;
                app.clearWorld();
                syncPlayerControls();
                updateStats();
              }}
            >
              Новый мир
            </button>
            <button
              className="btn"
              onClick={() => {
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
            >
              Сохранить мир
            </button>
            <input
              type="file"
              ref={worldFileInputRef}
              style={{ display: 'none' }}
              accept=".json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
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
                e.target.value = '';
              }}
            />
            <button className="btn" onClick={() => worldFileInputRef.current?.click()}>
              Загрузить мир
            </button>
          </div>
        </div>

        <div className="tool-group">
          <h3>Управление спавном</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => openSpawnModal('player')}>
              Добавить Игрока
            </button>
            <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => openSpawnModal('ai')}>
              Добавить Бота
            </button>
          </div>
        </div>

        <div className="tool-group">
          <h3>Препятствия</h3>
          <label>
            Включить коллизии
            <input
              type="checkbox"
              checked={obstaclesEnabled}
              onChange={(e) => {
                setObstaclesEnabled(e.target.checked);
                appRef.current?.physics.setObstaclesEnabled(e.target.checked);
              }}
            />
          </label>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".json"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (evt) => {
                try {
                  const data = JSON.parse(evt.target?.result as string);
                  if (Array.isArray(data)) {
                    appRef.current?.loadObstaclesFromData(data);
                  }
                } catch {
                  alert('Ошибка при чтении JSON файла!');
                }
              };
              reader.readAsText(file);
            }}
          />
          <button className="btn" onClick={() => fileInputRef.current?.click()}>
            Загрузить JSON препятствий
          </button>
        </div>

        <div className="tool-group">
          <h3>Выбранное существо</h3>
          {selectedStats ? (
            <div className="stats-list">
              <dl className="stats-list">
                <div className="stat-row"><dt>Тип:</dt><dd>{selectedStats.type === 'player' ? 'Игрок' : 'Бот'}</dd></div>
                <div className="stat-row"><dt>Состояние:</dt><dd>{selectedStats.state}</dd></div>
                <div className="stat-row"><dt>Радиус:</dt><dd>{selectedStats.radius} px</dd></div>
                <div className="stat-row"><dt>Масса:</dt><dd>{selectedStats.mass}</dd></div>
                <div className="stat-row"><dt>Здоровье (HP):</dt><dd>{selectedStats.hp} / {selectedStats.maxHp}</dd></div>
                <div className="stat-row"><dt>Текущая скорость:</dt><dd>{selectedStats.currentSpeed.toFixed(0)} px/с</dd></div>
                <div className="stat-row"><dt>Текущий поворот:</dt><dd>{selectedStats.currentTurnSpeed.toFixed(0)} °/с</dd></div>
                <div className="stat-row"><dt>Макс. скорость:</dt><dd>{selectedStats.maxSpeed} px/с</dd></div>
                <div className="stat-row"><dt>Макс. поворот:</dt><dd>{selectedStats.maxTurnSpeed} °/с</dd></div>
              </dl>

              <h4 style={{ marginTop: '12px', fontSize: '13px', color: '#bdc3c7' }}>
                Экипировка (клик по предмету для настройки):
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {selectedStats.equipSlots.map((slot, index) => {
                  const item = slot.item;
                  const hasEditableItem =
                    item && ['weapon', 'armor', 'bag'].includes(item.type) && !!item.config;
                  const isWeapon = item?.type === 'weapon';
                  const isArmor = item?.type === 'armor';
                  const isBag = item?.type === 'bag';

                  return (
                    <div
                      key={`${slot.type}_${index}`}
                      onClick={() => {
                        if (hasEditableItem && item) {
                          openItemEditModal(item);
                        }
                      }}
                      style={{
                        backgroundColor: '#1e1e1e',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        cursor: hasEditableItem ? 'pointer' : 'default',
                        fontSize: '12px',
                        border: '1px solid #444',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: '#aaa' }}>{getSlotTypeName(slot.type)}:</span>
                      <span>
                        {item ? item.name : 'Пусто'}
                        {isWeapon && item?.config && (
                          <span style={{ color: '#f1c40f', marginLeft: '6px' }}>
                            ({(item.config as WeaponConfig).baseDamage} урона)
                          </span>
                        )}
                        {isArmor && item?.config && (
                          <span style={{ color: '#3498db', marginLeft: '6px' }}>
                            ({(item.config as ArmorConfig).defense} защиты)
                          </span>
                        )}
                        {isBag && item?.config && (
                          <span style={{ color: '#2ecc71', marginLeft: '6px' }}>
                            ({(item.config as InventoryConfig).size.width}x{(item.config as InventoryConfig).size.height})
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={openEditModal}>
                  Изменить
                </button>
                <button className="btn" style={{ flex: 1, backgroundColor: '#c0392b' }} onClick={handleDeleteCreature}>
                  Удалить
                </button>
              </div>
            </div>
          ) : (
            <p className="selection-hint">Существо не выбрано</p>
          )}
        </div>

        <div className="tool-group">
          <h3>Управление</h3>
          {selectedStats ? (
            <ul className="control-keys">
              <li><kbd>W</kbd> Движение вперед</li>
              <li><kbd>A</kbd> / <kbd>D</kbd> Поворот влево/вправо</li>
              <li><kbd>LShift</kbd> Бег (удержание)</li>
              <li><kbd>C</kbd> Полуприсяд (удержание)</li>
              <li><kbd>Пробел</kbd> Атака оружием</li>
              <li><kbd>LCtrl</kbd> + <kbd>Пробел</kbd> Пауза / Возобновление</li>
            </ul>
          ) : (
            <ul className="control-keys">
              <li><kbd>Пробел</kbd> Пауза / Возобновление симуляции</li>
            </ul>
          )}
        </div>
      </div>
      {showBTPanel && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '440px',
            height: 'calc(100vh - 32px)',
            backgroundColor: 'rgba(20, 20, 20, 0.95)',
            border: '2px solid #ffcc00', // Желтая рамка
            borderRadius: '8px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: '#1a1a1a',
              borderBottom: '1px solid #333',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#fff',
              fontWeight: 'bold',
              fontSize: '14px',
            }}
          >
            <span>🌳 Дерево поведения (BT)</span>
            <button
              onClick={() => setShowBTPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              ✕
            </button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', position: 'relative', padding: '10px' }}>
            {btData ? (
              <BTGraph tree={btData} showStatus={true} />
            ) : (
              <div style={{ color: '#aaa', padding: '20px', textAlign: 'center', fontSize: '13px' }}>
                У выбранного существа нет дерева поведения
              </div>
            )}
          </div>
        </div>
      )}
      <SpawnModal
        isOpen={isModalOpen}
        pendingSpawnType={pendingSpawnType}
        radius={radius}
        setRadius={setRadius}
        mass={mass}
        setMass={setMass}
        maxSpeed={maxSpeed}
        setMaxSpeed={setMaxSpeed}
        maxTurnSpeed={maxTurnSpeed}
        setMaxTurnSpeed={setMaxTurnSpeed}
        runSpeedMultiplier={runSpeedMultiplier}
        setRunSpeedMultiplier={setRunSpeedMultiplier}
        crouchSpeedMultiplier={crouchSpeedMultiplier}
        setCrouchSpeedMultiplier={setCrouchSpeedMultiplier}
        crouchStealthMultiplier={crouchStealthMultiplier}
        setCrouchStealthMultiplier={setCrouchStealthMultiplier}
        onClose={closeSpawnModal}
        onConfirm={handleSpawnConfirm}
      />

      <CreatureEditModal
        isOpen={isEditModalOpen}
        editRadius={editRadius}
        setEditRadius={setEditRadius}
        editHp={editHp}
        setEditHp={setEditHp}
        editMaxHp={editMaxHp}
        setEditMaxHp={setEditMaxHp}
        editMaxSpeed={editMaxSpeed}
        setEditMaxSpeed={setEditMaxSpeed}
        editMaxTurnSpeed={editMaxTurnSpeed}
        setEditMaxTurnSpeed={setEditMaxTurnSpeed}
        editRunSpeedMultiplier={editRunSpeedMultiplier}
        setEditRunSpeedMultiplier={setEditRunSpeedMultiplier}
        editCrouchSpeedMultiplier={editCrouchSpeedMultiplier}
        setEditCrouchSpeedMultiplier={setEditCrouchSpeedMultiplier}
        editCrouchStealthMultiplier={editCrouchStealthMultiplier}
        setEditCrouchStealthMultiplier={setEditCrouchStealthMultiplier}
        onClose={closeEditModal}
        onConfirm={handleEditConfirm}
      />

      <WeaponEditModal
        selectedWeaponForEdit={selectedWeaponForEdit}
        editWeaponName={editWeaponName}
        setEditWeaponName={setEditWeaponName}
        editWeaponDamage={editWeaponDamage}
        setEditWeaponDamage={setEditWeaponDamage}
        editWeaponPrepTime={editWeaponPrepTime}
        setEditWeaponPrepTime={setEditWeaponPrepTime}
        editWeaponRecoveryTime={editWeaponRecoveryTime}
        setEditWeaponRecoveryTime={setEditWeaponRecoveryTime}
        editWeaponRange={editWeaponRange}
        setEditWeaponRange={setEditWeaponRange}
        editWeaponRadius={editWeaponRadius}
        setEditWeaponRadius={setEditWeaponRadius}
        editWeaponNumLines={editWeaponNumLines}
        setEditWeaponNumLines={setEditWeaponNumLines}
        editWeaponAngle={editWeaponAngle}
        setEditWeaponAngle={setEditWeaponAngle}
        editWeaponPierceObstacles={editWeaponPierceObstacles}
        setEditWeaponPierceObstacles={setEditWeaponPierceObstacles}
        editWeaponPiercePlayers={editWeaponPiercePlayers}
        setEditWeaponPiercePlayers={setEditWeaponPiercePlayers}
        editWeaponPierceBots={editWeaponPierceBots}
        setEditWeaponPierceBots={setEditWeaponPierceBots}
        onClose={closeWeaponEditModal}
        onConfirm={handleWeaponEditConfirm}
      />

      <ArmorEditModal
        selectedArmorForEdit={selectedArmorForEdit}
        editArmorName={editArmorName}
        setEditArmorName={setEditArmorName}
        editArmorDefense={editArmorDefense}
        setEditArmorDefense={setEditArmorDefense}
        editArmorFlatReduction={editArmorFlatReduction}
        setEditArmorFlatReduction={setEditArmorFlatReduction}
        editArmorWeight={editArmorWeight}
        setEditArmorWeight={setEditArmorWeight}
        onClose={closeArmorEditModal}
        onConfirm={handleArmorEditConfirm}
      />

      <BagEditModal
        selectedBagForEdit={selectedBagForEdit}
        editBagName={editBagName}
        setEditBagName={setEditBagName}
        editBagWidth={editBagWidth}
        setEditBagWidth={setEditBagWidth}
        editBagHeight={editBagHeight}
        setEditBagHeight={setEditBagHeight}
        editBagWeight={editBagWeight}
        setEditBagWeight={setEditBagWeight}
        isBagInventoryEmpty={isBagInventoryEmpty}
        inventorySlots={selectedStats?.inventory?.slots}
        inventorySize={selectedStats?.inventory?.size}
        onItemClick={openItemEditModal}
        onClose={closeBagEditModal}
        onConfirm={handleBagEditConfirm}
      />
    </div>
  );
};