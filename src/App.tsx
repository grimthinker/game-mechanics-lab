import React, { useCallback, useEffect, useRef, useState } from 'react';
import { GameApp } from './GameApp';
import { CreatureType, STANDARD_RADII } from './types';
import { useCanvasInteraction } from './useCanvasInteraction';
import { useKeyboardControls } from './useKeyboardControls';

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
}

interface PlacementConfig {
  type: CreatureType;
  radius: number;
  mass: number;
  maxSpeed: number;
  maxTurnSpeed: number;
}

export const App: React.FC = () => {
  const appRef = useRef<GameApp | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [obstaclesEnabled, setObstaclesEnabled] = useState(true);
  const [selectedStats, setSelectedStats] = useState<CreatureStats | null>(null);

  // Модальные окна
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingSpawnType, setPendingSpawnType] = useState<CreatureType | null>(null);
  const [radius, setRadius] = useState<number>(24);
  const [mass, setMass] = useState<number>(10);
  const [maxSpeed, setMaxSpeed] = useState<number>(150);
  const [maxTurnSpeed, setMaxTurnSpeed] = useState<number>(270);

  // Режим выбора места
  const [placementConfig, setPlacementConfig] = useState<PlacementConfig | null>(null);

  // Модальное окно редактирования
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRadius, setEditRadius] = useState<number>(24);
  const [editMaxSpeed, setEditMaxSpeed] = useState<number>(150);
  const [editMaxTurnSpeed, setEditMaxTurnSpeed] = useState<number>(270);
  const [editHp, setEditHp] = useState<number>(100);
  const [editMaxHp, setEditMaxHp] = useState<number>(100);

  const updateStats = useCallback(() => {
    const app = appRef.current;
    if (!app || !app.selectedCreature) {
      setSelectedStats(null);
      return;
    }

    const c = app.selectedCreature;
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
    });
  }, []);

  // Хуки клавиатуры и мыши
  const { syncPlayerControls } = useKeyboardControls({
    appRef,
    isModalOpen,
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

  // Инициализация при старте
  useEffect(() => {
    if (!canvasRef.current) return;

    const app = new GameApp(canvasRef.current);
    appRef.current = app;

    app.onFrame = () => {
      updateStats();
    };

    app.start();
    app.spawnCreature('player');
    updateStats();
  }, [canvasRef, updateStats]);

  const handleObstaclesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setObstaclesEnabled(checked);
    appRef.current?.physics.setObstaclesEnabled(checked);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (Array.isArray(data) && appRef.current) {
          appRef.current.loadObstaclesFromData(data);
        }
      } catch {
        alert('Ошибка при чтении JSON файла!');
      }
    };
    reader.readAsText(file);
  };

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
    });

    updateStats();
    closeEditModal();
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
      </div>

      <aside id="toolbar">
        <h2>Панель управления</h2>

        <section className="tool-group">
          <h3>Препятствия</h3>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={obstaclesEnabled}
              onChange={handleObstaclesChange}
            />
            Включить препятствия
          </label>
          <div className="file-input-wrapper">
            <button className="btn" onClick={() => fileInputRef.current?.click()}>
              Загрузить JSON препятствий
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>
        </section>

        <section className="tool-group">
          <h3>Добавить существо</h3>
          {placementConfig ? (
            <>
              <p className="selection-hint">Выберите место</p>
              <button
                className="btn"
                onClick={() => {
                  setPlacementConfig(null);
                  appRef.current?.endPan();
                }}
              >
                Отмена
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-primary" onClick={() => openSpawnModal('player')}>
                + Игрок (Player)
              </button>
              <button className="btn btn-secondary" onClick={() => openSpawnModal('ai')}>
                + ИИ (AI)
              </button>
            </>
          )}
        </section>

        <section className="tool-group">
          <h3>Выбранное существо</h3>
          {!selectedStats ? (
            <p className="selection-hint">Кликните по существу на поле</p>
          ) : (
            <>
              <dl className="stats-list">
                <div className="stat-row">
                  <dt>Тип</dt>
                  <dd>{selectedStats.type === 'player' ? 'Игрок' : 'ИИ'}</dd>
                </div>
                <div className="stat-row">
                  <dt>Радиус</dt>
                  <dd>{selectedStats.radius} px</dd>
                </div>
                <div className="stat-row">
                  <dt>Масса</dt>
                  <dd>{selectedStats.mass}</dd>
                </div>
                <div className="stat-row">
                  <dt>Жизни (HP)</dt>
                  <dd>{selectedStats.hp} / {selectedStats.maxHp}</dd>
                </div>
                <div className="stat-row">
                  <dt>Макс. скорость</dt>
                  <dd>{selectedStats.maxSpeed.toFixed(0)} px/с</dd>
                </div>
                <div className="stat-row">
                  <dt>Макс. поворот</dt>
                  <dd>{selectedStats.maxTurnSpeed.toFixed(0)} °/с</dd>
                </div>
                <div className="stat-row">
                  <dt>Текущая скорость</dt>
                  <dd>{selectedStats.currentSpeed.toFixed(0)} px/с</dd>
                </div>
                <div className="stat-row">
                  <dt>Текущий поворот</dt>
                  <dd>{selectedStats.currentTurnSpeed.toFixed(0)} °/с</dd>
                </div>
              </dl>
              <button className="btn btn-sm" onClick={openEditModal}>
                Изменить
              </button>
            </>
          )}
        </section>

        <section className="tool-group">
          <h3>Управление игроком</h3>
          <p className="control-hint">Выберите существо-игрока на поле</p>
          <ul className="control-keys">
            <li><kbd>W</kbd> — вперёд</li>
            <li><kbd>A</kbd> — поворот влево</li>
            <li><kbd>D</kbd> — поворот вправо</li>
          </ul>
        </section>
      </aside>

      {isModalOpen && (
        <div className="modal">
          <div className="modal-backdrop" onClick={closeSpawnModal} />
          <div className="modal-dialog" role="dialog" aria-labelledby="spawn-modal-title">
            <h3 id="spawn-modal-title">Параметры нового существа</h3>
            <p className="modal-subtitle">
              Тип: {pendingSpawnType === 'player' ? 'Игрок' : 'ИИ'}
            </p>
            <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
              <label>
                Радиус (Размер):
                <select
                  value={radius}
                  onChange={(e) => setRadius(Number(e.target.value))}
                >
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
            </form>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={closeSpawnModal}>
                Отмена
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSpawnConfirm}>
                Создать
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="modal">
          <div className="modal-backdrop" onClick={closeEditModal} />
          <div className="modal-dialog" role="dialog" aria-labelledby="edit-modal-title">
            <h3 id="edit-modal-title">Редактировать существо</h3>
            <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
              <label>
                Радиус:
                <select
                  value={editRadius}
                  onChange={(e) => setEditRadius(Number(e.target.value))}
                >
                  {STANDARD_RADII.map((r) => (
                    <option key={r} value={r}>
                      {r} px
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Текущие HP:
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
    </div>
  );
};