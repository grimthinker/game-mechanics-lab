import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameApp } from './GameApp';
import { useCanvasInteraction } from './useCanvasInteraction';
import { useKeyboardControls } from './useKeyboardControls';
import { CreatureType, CreatureState, WeaponConfig, STANDARD_RADII, EquipSlot } from './ecs/types';

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
}

interface PlacementConfig {
  type: CreatureType;
  radius: number;
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

  const [obstaclesEnabled, setObstaclesEnabled] = useState(true);
  const [selectedStats, setSelectedStats] = useState<CreatureStats | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingSpawnType, setPendingSpawnType] = useState<CreatureType | null>(null);
  const [radius, setRadius] = useState<number>(24);
  const [mass, setMass] = useState<number>(10);
  const [maxSpeed, setMaxSpeed] = useState<number>(150);
  const [maxTurnSpeed, setMaxTurnSpeed] = useState<number>(270);
  const [runSpeedMultiplier, setRunSpeedMultiplier] = useState<number>(1.5);
  const [crouchSpeedMultiplier, setCrouchSpeedMultiplier] = useState<number>(0.5);
  const [crouchStealthMultiplier, setCrouchStealthMultiplier] = useState<number>(1.5);

  const [placementConfig, setPlacementConfig] = useState<PlacementConfig | null>(null);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRadius, setEditRadius] = useState<number>(24);
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

  const updateStats = useCallback(() => {
    const app = appRef.current;
    if (!app || !app.selectedCreature) {
      setSelectedStats(null);
      return;
    }

    const c = app.selectedCreature;
    const eq = c.equip;
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
    });
  }, []);

  const { syncPlayerControls } = useKeyboardControls({
    appRef,
    isModalOpen: isModalOpen || !!selectedWeaponForEdit,
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
      maxTurnSpeed: editMaxTurnSpeed,
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
    setSelectedWeaponForEdit(weapon);
    setEditWeaponName(w.name || '');
    setEditWeaponDamage(w.baseDamage ?? 25);
    setEditWeaponPrepTime(w.prepTime ?? 0.2);
    setEditWeaponRecoveryTime(w.recoveryTime ?? 0.3);
    setEditWeaponRange(w.range ?? w.length ?? 0);
    setEditWeaponRadius(w.radius ?? 0);
    setEditWeaponNumLines(w.numLines ?? w.lines ?? w.rayCount ?? 1);
    setEditWeaponAngle(w.angle !== undefined ? Math.round((w.angle * 180) / Math.PI) : 0);
    setEditWeaponPierceObstacles(!!w.pierceObstacles);
    setEditWeaponPiercePlayers(!!w.piercePlayers);
    setEditWeaponPierceBots(!!w.pierceBots);
  };

  const closeWeaponEditModal = () => {
    setSelectedWeaponForEdit(null);
  };

  const handleWeaponEditConfirm = () => {
    if (!selectedWeaponForEdit) return;
    const w = selectedWeaponForEdit as any;
    w.name = editWeaponName;
    w.baseDamage = editWeaponDamage;
    w.prepTime = editWeaponPrepTime;
    w.recoveryTime = editWeaponRecoveryTime;
    if (w.range !== undefined) w.range = editWeaponRange;
    if (w.length !== undefined) w.length = editWeaponRange;
    if (w.radius !== undefined) w.radius = editWeaponRadius;
    if (w.numLines !== undefined) w.numLines = editWeaponNumLines;
    if (w.lines !== undefined) w.lines = editWeaponNumLines;
    if (w.rayCount !== undefined) w.rayCount = editWeaponNumLines;
    if (w.angle !== undefined) w.angle = (editWeaponAngle * Math.PI) / 180;
    w.pierceObstacles = editWeaponPierceObstacles;
    w.piercePlayers = editWeaponPiercePlayers;
    w.pierceBots = editWeaponPierceBots;
    closeWeaponEditModal();
    updateStats();
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
        } else if (isEditModalOpen) {
          closeEditModal();
        } else if (isModalOpen) {
          closeSpawnModal();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isEditModalOpen, selectedWeaponForEdit]);

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
                Экипировка (клик по оружию для настройки):
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {selectedStats.equipSlots.map((slot, index) => {
                  const isWeapon = slot.type === 'weapon' && slot.item?.type === 'weapon';
                  return (
                    <div
                      key={`${slot.type}_${index}`}
                      onClick={() => {
                        if (isWeapon && slot.item?.type === 'weapon' && slot.item?.config) {
                          openWeaponEditModal((slot.item.config as WeaponConfig));
                        }
                      }}
                      style={{
                        backgroundColor: '#1e1e1e',
                        padding: '6px 8px',
                        borderRadius: '4px',
                        cursor: isWeapon ? 'pointer' : 'default',
                        fontSize: '12px',
                        border: '1px solid #444',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ color: '#aaa' }}>{getSlotTypeName(slot.type)}:</span>
                      <span>
                        {slot.item ? slot.item.name : 'Пусто'}
                        {isWeapon && (
                          <span style={{ color: '#f1c40f', marginLeft: '6px' }}>
                            ({(slot.item!.config as WeaponConfig).baseDamage} урона)
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
          <ul className="control-keys">
            <li><kbd>W</kbd> Движение вперед</li>
            <li><kbd>A</kbd> / <kbd>D</kbd> Поворот влево/вправо</li>
            <li><kbd>LShift</kbd> Бег (удержание)</li>
            <li><kbd>C</kbd> Полуприсяд (удержание)</li>
            <li><kbd>Пробел</kbd> Атака оружием</li>
          </ul>
        </div>
      </div>

      {isModalOpen && (
        <div
          className="modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeSpawnModal();
          }}
        >
          <div className="modal-backdrop" onClick={closeSpawnModal} />
          <div className="modal-dialog">
            <h3>Параметры нового существа</h3>
            <p className="modal-subtitle">
              Тип: {pendingSpawnType === 'player' ? 'Игрок' : 'Бот'}
            </p>
            <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
              <label>
                Радиус:
                <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}>
                  {STANDARD_RADII.map((r) => (
                    <option key={r} value={r}>
                      {r} px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Масса:
                <input
                  type="number"
                  value={mass}
                  min={1}
                  max={100}
                  onChange={(e) => setMass(Number(e.target.value))}
                />
              </label>
              <label>
                Макс. скорость:
                <input
                  type="number"
                  value={maxSpeed}
                  min={0}
                  max={1000}
                  step={10}
                  onChange={(e) => setMaxSpeed(Number(e.target.value))}
                />
              </label>
              <label>
                Макс. поворот (°/с):
                <input
                  type="number"
                  value={maxTurnSpeed}
                  min={0}
                  max={1080}
                  step={10}
                  onChange={(e) => setMaxTurnSpeed(Number(e.target.value))}
                />
              </label>
              <label>
                Множитель скорости бега:
                <input
                  type="number"
                  value={runSpeedMultiplier}
                  min={0.1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setRunSpeedMultiplier(Number(e.target.value))}
                />
              </label>
              <label>
                Множитель скорости присяда:
                <input
                  type="number"
                  value={crouchSpeedMultiplier}
                  min={0.1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setCrouchSpeedMultiplier(Number(e.target.value))}
                />
              </label>
              <label>
                Множитель скрытности присяда:
                <input
                  type="number"
                  value={crouchStealthMultiplier}
                  min={1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setCrouchStealthMultiplier(Number(e.target.value))}
                />
              </label>
            </form>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeSpawnModal}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSpawnConfirm}>
                Выбрать место
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div
          className="modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditModal();
          }}
        >
          <div className="modal-backdrop" onClick={closeEditModal} />
          <div className="modal-dialog">
            <h3>Изменить параметры существа</h3>
            <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
              <label>
                Радиус:
                <select value={editRadius} onChange={(e) => setEditRadius(Number(e.target.value))}>
                  {STANDARD_RADII.map((r) => (
                    <option key={r} value={r}>
                      {r} px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Текущее HP:
                <input
                  type="number"
                  value={editHp}
                  min={0}
                  max={editMaxHp}
                  onChange={(e) => setEditHp(Number(e.target.value))}
                />
              </label>
              <label>
                Макс. HP:
                <input
                  type="number"
                  value={editMaxHp}
                  min={1}
                  max={10000}
                  onChange={(e) => setEditMaxHp(Number(e.target.value))}
                />
              </label>
              <label>
                Макс. скорость:
                <input
                  type="number"
                  value={editMaxSpeed}
                  min={0}
                  max={1000}
                  step={10}
                  onChange={(e) => setEditMaxSpeed(Number(e.target.value))}
                />
              </label>
              <label>
                Макс. поворот (°/с):
                <input
                  type="number"
                  value={editMaxTurnSpeed}
                  min={0}
                  max={1080}
                  step={10}
                  onChange={(e) => setEditMaxTurnSpeed(Number(e.target.value))}
                />
              </label>
              <label>
                Множитель скорости бега:
                <input
                  type="number"
                  value={editRunSpeedMultiplier}
                  min={0.1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setEditRunSpeedMultiplier(Number(e.target.value))}
                />
              </label>
              <label>
                Множитель скорости присяда:
                <input
                  type="number"
                  value={editCrouchSpeedMultiplier}
                  min={0.1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setEditCrouchSpeedMultiplier(Number(e.target.value))}
                />
              </label>
              <label>
                Множитель скрытности присяда:
                <input
                  type="number"
                  value={editCrouchStealthMultiplier}
                  min={1}
                  max={10}
                  step={0.1}
                  onChange={(e) => setEditCrouchStealthMultiplier(Number(e.target.value))}
                />
              </label>
            </form>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeEditModal}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={handleEditConfirm}>
                Применить
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedWeaponForEdit && (
        <div
          className="modal"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeWeaponEditModal();
          }}
        >
          <div className="modal-backdrop" onClick={closeWeaponEditModal} />
          <div className="modal-dialog">
            <h3>Изменить параметры оружия</h3>
            <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
              <label>
                Название:
                <input
                  type="text"
                  value={editWeaponName}
                  onChange={(e) => setEditWeaponName(e.target.value)}
                />
              </label>
              <label>
                Базовый урон:
                <input
                  type="number"
                  value={editWeaponDamage}
                  min={0}
                  max={500}
                  onChange={(e) => setEditWeaponDamage(Number(e.target.value))}
                />
              </label>
              <label>
                Подготовка (сек):
                <input
                  type="number"
                  value={editWeaponPrepTime}
                  min={0.05}
                  max={5}
                  step={0.05}
                  onChange={(e) => setEditWeaponPrepTime(Number(e.target.value))}
                />
              </label>
              <label>
                Восстановление (сек):
                <input
                  type="number"
                  value={editWeaponRecoveryTime}
                  min={0.05}
                  max={5}
                  step={0.05}
                  onChange={(e) => setEditWeaponRecoveryTime(Number(e.target.value))}
                />
              </label>
              {(((selectedWeaponForEdit as any).range !== undefined) || ((selectedWeaponForEdit as any).length !== undefined)) && (
                <label>
                  Дальность / Длина:
                  <input
                    type="number"
                    value={editWeaponRange}
                    min={0}
                    max={2000}
                    step={10}
                    onChange={(e) => setEditWeaponRange(Number(e.target.value))}
                  />
                </label>
              )}
              {((selectedWeaponForEdit as any).radius !== undefined) && (
                <label>
                  Радиус:
                  <input
                    type="number"
                    value={editWeaponRadius}
                    min={0}
                    max={500}
                    step={5}
                    onChange={(e) => setEditWeaponRadius(Number(e.target.value))}
                  />
                </label>
              )}
              {(((selectedWeaponForEdit as any).numLines !== undefined) || ((selectedWeaponForEdit as any).lines !== undefined) || ((selectedWeaponForEdit as any).rayCount !== undefined)) && (
                <label>
                  Количество лучей / линий:
                  <input
                    type="number"
                    value={editWeaponNumLines}
                    min={1}
                    max={50}
                    step={1}
                    onChange={(e) => setEditWeaponNumLines(Number(e.target.value))}
                  />
                </label>
              )}
              {((selectedWeaponForEdit as any).angle !== undefined) && (
                <label>
                  Угол (°):
                  <input
                    type="number"
                    value={editWeaponAngle}
                    min={0}
                    max={360}
                    step={1}
                    onChange={(e) => setEditWeaponAngle(Number(e.target.value))}
                  />
                </label>
              )}
              {selectedWeaponForEdit && ['line', 'forward_line', 'shrapnel'].includes(selectedWeaponForEdit.zone.hitZoneType) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editWeaponPierceObstacles}
                      onChange={(e) => setEditWeaponPierceObstacles(e.target.checked)}
                    />
                    Пробивать препятствия
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editWeaponPiercePlayers}
                      onChange={(e) => setEditWeaponPiercePlayers(e.target.checked)}
                    />
                    Пробивать игроков
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={editWeaponPierceBots}
                      onChange={(e) => setEditWeaponPierceBots(e.target.checked)}
                    />
                    Пробивать ботов
                  </label>
                </div>
              )}
            </form>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeWeaponEditModal}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={handleWeaponEditConfirm}>
                Применить
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};