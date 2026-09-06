import React from 'react';
import { World } from '../ecs/World';
import { GameMode, THEME_COLORS, TOOL_GROUP_THEME_COLORS } from '../constants';
import { BEHAVIOR_TREE_NAMES } from '../ai/trees_library';
import { rad2Deg } from '../utils';

interface ToolbarProps {
  mode: GameMode;
  goToEditor: () => void;
  goToSimulation: () => void;
  goToGame: () => void;
  obstaclesEnabled: boolean;
  setObstaclesEnabled: (val: boolean) => void;
  setObstaclesData: (data: any[]) => void;
  selectedEntityId: string | null;
  world: World | null | undefined;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  worldFileInputRef: React.RefObject<HTMLInputElement | null>;
  onNewWorld: () => void;
  onSaveWorld: () => void;
  onLoadWorldFile: (file: File) => void;
  openSpawnModal: (behavior?: string) => void;
  openItemSpawnModal: () => void;
  openEditModal: (entityId?: string) => void;
  handleDeleteEntity: () => void;
  isPaused: boolean;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  goToEditor,
  goToSimulation,
  goToGame,
  obstaclesEnabled,
  setObstaclesEnabled,
  setObstaclesData,
  selectedEntityId,
  world,
  fileInputRef,
  worldFileInputRef,
  onNewWorld,
  onSaveWorld,
  onLoadWorldFile,
  openSpawnModal,
  openItemSpawnModal,
  openEditModal,
  handleDeleteEntity,
  isPaused,
}) => {
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

  const tag = selectedEntityId && world ? world.getComponent(selectedEntityId, 'tag') : undefined;
  const meta = selectedEntityId && world ? world.getComponent(selectedEntityId, 'meta') : undefined;
  const item = selectedEntityId && world ? world.getComponent(selectedEntityId, 'item') : undefined;
  const healthStats = selectedEntityId && world ? world.getComponent(selectedEntityId, 'healthStats') : undefined;
  const physicsStats = selectedEntityId && world ? world.getComponent(selectedEntityId, 'physicsStats') : undefined;
  const movementStats = selectedEntityId && world ? world.getComponent(selectedEntityId, 'movementStats') : undefined;
  const velocity = selectedEntityId && world ? world.getComponent(selectedEntityId, 'velocity') : undefined;
  const stealthStats = selectedEntityId && world ? world.getComponent(selectedEntityId, 'stealthStats') : undefined;
  const aiStats = selectedEntityId && world ? world.getComponent(selectedEntityId, 'aiStats') : undefined;
  const zoneTrigger = selectedEntityId && world ? world.getComponent(selectedEntityId, 'zoneTrigger') : undefined;
  const weaponStats = selectedEntityId && world ? world.getComponent(selectedEntityId, 'weaponStats') : undefined;
  const armorStats = selectedEntityId && world ? world.getComponent(selectedEntityId, 'armorStats') : undefined;
  const inventory = selectedEntityId && world ? world.getComponent(selectedEntityId, 'inventory') : undefined;
  const equip = selectedEntityId && world ? world.getComponent(selectedEntityId, 'equip') : undefined;

  const getCardTitle = () => {
    switch (tag?.archetype) {
      case 'creature':
        return 'Выбранное существо';
      case 'item':
        return `Выбранный предмет (${item?.type ? getSlotTypeName(item.type) : ''})`;
      case 'marker':
        return 'Служебный объект (Маркер)';
      case 'zone':
        return 'Триггерная зона';
      case 'projectile':
        return 'Снаряд';
      default:
        return 'Выбранный объект';
    }
  };

  return (
    <div id="toolbar" style={{ backgroundColor: THEME_COLORS[mode] }}>
      <div className="tool-group" style={{ backgroundColor: TOOL_GROUP_THEME_COLORS[mode] }}>
        <h3>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              position: 'relative',
              width: '100%',
            }}
          >
            <span>Мир</span>
            {isPaused && mode !== GameMode.GAME && (
              <span
                style={{
                  color: '#e74c3c',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  padding: '2px 8px',
                  border: '1px solid #e74c3c',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(231, 76, 60, 0.1)',
                  position: 'absolute',
                  right: 0,
                }}
              >
                ПАУЗА
              </span>
            )}
          </div>
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {mode === GameMode.EDITOR && (
            <>
              <button className="btn" onClick={onNewWorld}>
                Новый мир
              </button>
              <button className="btn" onClick={onSaveWorld}>
                Сохранить мир
              </button>
              <input
                type="file"
                ref={worldFileInputRef}
                style={{ display: 'none' }}
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onLoadWorldFile(file);
                  e.target.value = '';
                }}
              />
              <button className="btn" onClick={() => worldFileInputRef.current?.click()}>
                Загрузить мир
              </button>
            </>
          )}
          {mode !== GameMode.EDITOR && (
            <button className="btn" style={{ backgroundColor: '#2980b9', color: '#fff' }} onClick={goToEditor}>
              Редактор
            </button>
          )}
          {mode !== GameMode.SIMULATION && (
            <button className="btn" style={{ backgroundColor: '#27ae60', color: '#fff' }} onClick={goToSimulation}>
              Симуляция
            </button>
          )}
          {mode !== GameMode.GAME && (
            <button className="btn" style={{ backgroundColor: '#8e44ad', color: '#fff' }} onClick={goToGame}>
              Играть
            </button>
          )}
        </div>
      </div>

      {mode === GameMode.EDITOR && (
        <div className="tool-group" style={{ backgroundColor: TOOL_GROUP_THEME_COLORS[mode] }}>
          <h3>Управление спавном</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => openSpawnModal()}>
              Добавить Существо
            </button>
            <button className="btn btn-primary" style={{ width: '100%' }} onClick={openItemSpawnModal}>
              Добавить Предмет
            </button>
          </div>
        </div>
      )}

      <div className="tool-group" style={{ backgroundColor: TOOL_GROUP_THEME_COLORS[mode] }}>
        <h3>Препятствия</h3>
        <label>
          Включить коллизии
          <input
            type="checkbox"
            checked={obstaclesEnabled}
            onChange={(e) => setObstaclesEnabled(e.target.checked)}
          />
        </label>
        {mode === GameMode.EDITOR && (
          <>
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
                      setObstaclesData(data);
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
          </>
        )}
      </div>

      <div className="tool-group" style={{ backgroundColor: TOOL_GROUP_THEME_COLORS[mode] }}>
        <h3>{selectedEntityId ? getCardTitle() : 'Выбранный объект'}</h3>
        {selectedEntityId && world ? (
          <div className="stats-list">
            <dl className="stats-list">
              {meta && (
                <div className="stat-row">
                  <dt>Название:</dt>
                  <dd>{meta.name}</dd>
                </div>
              )}
              {item && !meta && (
                <div className="stat-row">
                  <dt>Название:</dt>
                  <dd>{item.name}</dd>
                </div>
              )}
              {meta?.state && (
                <div className="stat-row">
                  <dt>Состояние:</dt>
                  <dd>{meta.state}</dd>
                </div>
              )}
              {aiStats && (
                <div className="stat-row">
                  <dt>Поведение:</dt>
                  <dd>{BEHAVIOR_TREE_NAMES[aiStats.behavior.current] ?? aiStats.behavior.current}</dd>
                </div>
              )}
              {zoneTrigger && (
                <>
                  <div className="stat-row">
                    <dt>Тип эффекта:</dt>
                    <dd>{zoneTrigger.effect === 'damage' ? 'Урон' : 'Лечение'}</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Сила эффекта:</dt>
                    <dd>{zoneTrigger.valuePerSec} HP/с</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Радиус зоны:</dt>
                    <dd>{zoneTrigger.radius} px</dd>
                  </div>
                </>
              )}
              {healthStats && (
                <div className="stat-row">
                  <dt>Здоровье (HP):</dt>
                  <dd>
                    {Math.round(healthStats.hp.current)} / {healthStats.maxHp.current}
                  </dd>
                </div>
              )}
              {physicsStats && (
                <>
                  <div className="stat-row">
                    <dt>Радиус:</dt>
                    <dd>{physicsStats.radius.current} px</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Масса (Вес):</dt>
                    <dd>{physicsStats.weight.current}</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Коллизия:</dt>
                    <dd>{physicsStats.isSolid.current ? 'Да' : 'Нет'}</dd>
                  </div>
                </>
              )}
              {movementStats && (
                <>
                  <div className="stat-row">
                    <dt>Текущая скорость:</dt>
                    <dd>{(velocity?.currentSpeed ?? 0).toFixed(0)} px/с</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Текущий поворот:</dt>
                    <dd>{rad2Deg(velocity?.currentTurnSpeed ?? 0).toFixed(0)} °/с</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Макс. скорость:</dt>
                    <dd>{movementStats.maxSpeed.current} px/с</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Макс. поворот:</dt>
                    <dd>{Math.round(rad2Deg(movementStats.maxTurnSpeed.current))} °/с</dd>
                  </div>
                </>
              )}
              {stealthStats && (
                <>
                  <div className="stat-row">
                    <dt>Скрытность:</dt>
                    <dd>{stealthStats.stealthPower.current}</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Скрытность (присяд):</dt>
                    <dd>x{stealthStats.crouchStealthMultiplier.current}</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Скрытность (бег):</dt>
                    <dd>x{stealthStats.runStealthMultiplier.current}</dd>
                  </div>
                </>
              )}
              {weaponStats && (
                <>
                  <div className="stat-row">
                    <dt>Базовый урон:</dt>
                    <dd>{weaponStats.baseDamage.current}</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Подготовка / Восст.:</dt>
                    <dd>
                      {weaponStats.prepTime.current}с / {weaponStats.recoveryTime.current}с
                    </dd>
                  </div>
                </>
              )}
              {armorStats && (
                <>
                  <div className="stat-row">
                    <dt>Защита:</dt>
                    <dd>{armorStats.defense.current}</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Поглощение:</dt>
                    <dd>{armorStats.flatReduction.current}</dd>
                  </div>
                </>
              )}
              {inventory && (
                <div className="stat-row">
                  <dt>Размер инвентаря:</dt>
                  <dd>
                    {inventory.size.width}x{inventory.size.height}
                  </dd>
                </div>
              )}
            </dl>

            {equip && equip.slots.length > 0 && (
              <>
                <h4 style={{ marginTop: '12px', fontSize: '13px', color: '#bdc3c7' }}>Экипировка:</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                  {equip.slots.map((slot, index) => {
                    const slotItem = slot.itemId ? world.getComponent(slot.itemId, 'item') : null;
                    const slotWeapon = slot.itemId ? world.getComponent(slot.itemId, 'weaponStats') : null;
                    const slotArmor = slot.itemId ? world.getComponent(slot.itemId, 'armorStats') : null;
                    const slotInv = slot.itemId ? world.getComponent(slot.itemId, 'inventory') : null;

                    return (
                      <div
                        key={`${slot.type}_${index}`}
                        onClick={() => {
                          if (slot.itemId) openEditModal(slot.itemId);
                        }}
                        style={{
                          backgroundColor: '#1e1e1e',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          cursor: slot.itemId ? 'pointer' : 'default',
                          fontSize: '12px',
                          border: '1px solid #444',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <span style={{ color: '#aaa' }}>{getSlotTypeName(slot.type)}:</span>
                        <span>
                          {slotItem ? slotItem.name : 'Пусто'}
                          {slotWeapon && (
                            <span style={{ color: '#f1c40f', marginLeft: '6px' }}>
                              ({slotWeapon.baseDamage.current} урона)
                            </span>
                          )}
                          {slotArmor && (
                            <span style={{ color: '#3498db', marginLeft: '6px' }}>
                              ({slotArmor.defense.current} защиты)
                            </span>
                          )}
                          {slotInv && (
                            <span style={{ color: '#2ecc71', marginLeft: '6px' }}>
                              ({slotInv.size.width}x{slotInv.size.height})
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              {mode === GameMode.EDITOR && (
                <>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => openEditModal(selectedEntityId)}
                  >
                    Изменить
                  </button>
                  <button
                    className="btn"
                    style={{ flex: 1, backgroundColor: '#c0392b' }}
                    onClick={handleDeleteEntity}
                  >
                    Удалить
                  </button>
                </>
              )}
              {mode === GameMode.SIMULATION && (
                <button
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  onClick={() => openEditModal(selectedEntityId)}
                >
                  Осмотреть
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="selection-hint">Ничего не выбрано</p>
        )}
      </div>

      <div className="tool-group" style={{ backgroundColor: TOOL_GROUP_THEME_COLORS[mode] }}>
        <h3>Управление</h3>
        {mode === GameMode.GAME ? (
          <ul className="control-keys">
            <li><kbd>W</kbd> Движение вперед</li>
            <li><kbd>A</kbd> / <kbd>D</kbd> Поворот влево/вправо</li>
            <li><kbd>LShift</kbd> Бег (удержание)</li>
            <li><kbd>C</kbd> Полуприсяд (удержание)</li>
            <li><kbd>Пробел</kbd> Атака оружием</li>
          </ul>
        ) : mode === GameMode.SIMULATION ? (
          <ul className="control-keys">
            <li><kbd>Пробел</kbd> Пауза / Возобновление симуляции</li>
            <li><kbd>U</kbd> Дерево поведения (BT)</li>
          </ul>
        ) : (
          <ul className="control-keys">
            <li><kbd>U</kbd> Дерево поведения (BT)</li>
            <li><kbd>Ctrl+P</kbd> Быстрый спавн игрока</li>
            <li><kbd>Ctrl+B</kbd> Быстрый спавн бота</li>
            <li><kbd>Ctrl+I</kbd> Добавить предмет</li>
          </ul>
        )}
      </div>
    </div>
  );
};