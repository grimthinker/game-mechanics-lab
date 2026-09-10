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
  selectedEntityId: string | null;
  world: World | null | undefined;
  worldFileInputRef: React.RefObject<HTMLInputElement | null>;
  onNewWorld: () => void;
  onSaveWorld: () => void;
  onLoadWorldFile: (file: File) => void;
  openSpawnModal: (behavior?: string) => void;
  openItemSpawnModal: () => void;
  openZoneSpawnModal: () => void;
  openObstacleSpawnModal: () => void;
  openEditModal: (entityId?: string) => void;
  openSlotModal: (creatureId: string, slotId: string) => void;
  openAreaModal: (creatureId: string, areaId: string) => void;
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
  selectedEntityId,
  world,
  worldFileInputRef,
  onNewWorld,
  onSaveWorld,
  onLoadWorldFile,
  openSpawnModal,
  openItemSpawnModal,
  openZoneSpawnModal,
  openObstacleSpawnModal,
  openEditModal,
  openSlotModal,
  openAreaModal,
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
  const health =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'health') : undefined;
  const physicsStats =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'physicsStats') : undefined;
  const movementStats =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'movementStats') : undefined;
  const velocity =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'velocity') : undefined;
  const stealthStats =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'stealthStats') : undefined;
  const aiStats =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'aiStats') : undefined;
  const zoneTrigger =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'zoneTrigger') : undefined;
  const attachment =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'attachment') : undefined;
  const weaponStats =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'weaponStats') : undefined;
  const armorStats =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'armorStats') : undefined;
  const inventory =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'inventory') : undefined;
  const equip =
    selectedEntityId && world ? world.getComponent(selectedEntityId, 'equip') : undefined;
  const interactionAction =
    selectedEntityId && world
      ? world.getComponent(selectedEntityId, 'interactionAction')
      : undefined;

  const getPickupPhaseLabel = () => {
    if (!interactionAction || interactionAction.type !== 'pickup' || !interactionAction.phase) {
      return 'Нет';
    }
    switch (interactionAction.phase) {
      case 'reach':
        return 'Тянется к предмету';
      case 'lift':
        return 'Подъём предмета';
      case 'abort_reach':
      case 'abort_lift':
        return 'Отмена подбора';
      default:
        return 'Нет';
    }
  };

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
            <button
              className="btn"
              style={{ backgroundColor: '#2980b9', color: '#fff' }}
              onClick={goToEditor}
            >
              Редактор
            </button>
          )}
          {mode !== GameMode.SIMULATION && (
            <button
              className="btn"
              style={{ backgroundColor: '#27ae60', color: '#fff' }}
              onClick={goToSimulation}
            >
              Симуляция
            </button>
          )}
          {mode !== GameMode.GAME && (
            <button
              className="btn"
              style={{ backgroundColor: '#8e44ad', color: '#fff' }}
              onClick={goToGame}
            >
              Играть
            </button>
          )}
        </div>
      </div>

      {mode === GameMode.EDITOR && (
        <div className="tool-group" style={{ backgroundColor: TOOL_GROUP_THEME_COLORS[mode] }}>
          <h3>Управление спавном</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => openSpawnModal()}
            >
              Добавить Существо
            </button>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={openItemSpawnModal}
            >
              Добавить Предмет
            </button>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={openZoneSpawnModal}
            >
              Добавить Зону
            </button>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={openObstacleSpawnModal}
            >
              Добавить Препятствие
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
              {meta?.stance && (
                <div className="stat-row">
                  <dt>Положение:</dt>
                  <dd>{meta.stance === 'crouching' ? 'Присед' : 'Стоя'}</dd>
                </div>
              )}
              {meta?.movementMode && (
                <div className="stat-row">
                  <dt>Вид движения:</dt>
                  <dd>
                    {meta.movementMode === 'immobile'
                      ? 'Полная неподвижность'
                      : meta.movementMode === 'turning'
                        ? 'Поворот на месте'
                        : meta.movementMode === 'walking'
                          ? 'Спокойный шаг'
                          : meta.movementMode === 'jogging'
                            ? 'Обычное движение'
                            : 'Спринт'}
                  </dd>
                </div>
              )}
              {meta?.actionMode && (
                <div className="stat-row">
                  <dt>Активность:</dt>
                  <dd>
                    {meta.actionMode === 'idle'
                      ? 'Покой'
                      : meta.actionMode === 'attacking'
                        ? 'Атака'
                        : meta.actionMode === 'pickup'
                          ? 'Подбор предмета'
                          : 'Экипирование'}
                  </dd>
                </div>
              )}
              {meta?.directionMode && (
                <div className="stat-row">
                  <dt>Вид направления:</dt>
                  <dd>
                    {meta.directionMode === 'forward'
                      ? 'Вперед'
                      : meta.directionMode === 'strafe'
                        ? 'В сторону (Стрейф)'
                        : meta.directionMode === 'backward'
                          ? 'Назад'
                          : 'На месте'}
                  </dd>
                </div>
              )}
              {(tag?.archetype === 'creature' || meta?.entityType === 'creature') && (
                <div className="stat-row">
                  <dt>Состояние подбора:</dt>
                  <dd>{getPickupPhaseLabel()}</dd>
                </div>
              )}
              {aiStats && (
                <div className="stat-row">
                  <dt>Поведение:</dt>
                  <dd>
                    {BEHAVIOR_TREE_NAMES[aiStats.behavior.current] ?? aiStats.behavior.current}
                  </dd>
                </div>
              )}
              {zoneTrigger && (
                <>
                  <div className="stat-row">
                    <dt>Тип эффекта:</dt>
                    <dd>
                      {zoneTrigger.effect === 'damage'
                        ? 'Урон'
                        : zoneTrigger.effect === 'heal'
                          ? 'Лечение'
                          : zoneTrigger.effect === 'repel'
                            ? 'Отталкивание (Силовое поле)'
                            : 'Притягивание (Воронка)'}
                    </dd>
                  </div>
                  <div className="stat-row">
                    <dt>Сила эффекта:</dt>
                    <dd>
                      {zoneTrigger.valuePerSec}{' '}
                      {zoneTrigger.effect === 'damage' || zoneTrigger.effect === 'heal'
                        ? 'HP/с'
                        : 'px/с'}
                    </dd>
                  </div>
                  <div className="stat-row">
                    <dt>Радиус зоны:</dt>
                    <dd>{zoneTrigger.radius} px</dd>
                  </div>
                  {attachment && (
                    <div className="stat-row">
                      <dt>Привязана к:</dt>
                      <dd style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                        {attachment.parentId}
                      </dd>
                    </div>
                  )}
                </>
              )}
              {health && (
                <div className="stat-row">
                  <dt>Здоровье (HP):</dt>
                  <dd>
                    <span
                      style={{
                        color:
                          health.max.current > health.max.base
                            ? '#2ecc71'
                            : health.max.current < health.max.base
                              ? '#e74c3c'
                              : undefined,
                      }}
                    >
                      {Math.round(health.current)} / {Math.round(health.max.current)}
                    </span>
                    {health.max.current !== health.max.base && (
                      <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                        (база {health.max.base})
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {physicsStats && (
                <>
                  <div className="stat-row">
                    <dt>Радиус:</dt>
                    <dd>
                      <span
                        style={{
                          color:
                            physicsStats.radius.current > physicsStats.radius.base
                              ? '#2ecc71'
                              : physicsStats.radius.current < physicsStats.radius.base
                                ? '#e74c3c'
                                : undefined,
                        }}
                      >
                        {physicsStats.radius.current} px
                      </span>
                      {physicsStats.radius.current !== physicsStats.radius.base && (
                        <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                          (база {physicsStats.radius.base})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="stat-row">
                    <dt>Масса (Вес):</dt>
                    <dd>
                      <span
                        style={{
                          color:
                            physicsStats.weight.current > physicsStats.weight.base
                              ? '#2ecc71'
                              : physicsStats.weight.current < physicsStats.weight.base
                                ? '#e74c3c'
                                : undefined,
                        }}
                      >
                        {Number(physicsStats.weight.current.toFixed(1))}
                      </span>
                      {physicsStats.weight.current !== physicsStats.weight.base && (
                        <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                          (база {physicsStats.weight.base})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="stat-row">
                    <dt>Коллизия:</dt>
                    <dd>{physicsStats.isSolid ? 'Да' : 'Нет'}</dd>
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
                    <dd>
                      <span
                        style={{
                          color:
                            movementStats.maxSpeed.current > movementStats.maxSpeed.base
                              ? '#2ecc71'
                              : movementStats.maxSpeed.current < movementStats.maxSpeed.base
                                ? '#e74c3c'
                                : undefined,
                        }}
                      >
                        {Math.round(movementStats.maxSpeed.current)} px/с
                      </span>
                      {movementStats.maxSpeed.current !== movementStats.maxSpeed.base && (
                        <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                          (база {movementStats.maxSpeed.base})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="stat-row">
                    <dt>Макс. поворот:</dt>
                    <dd>
                      <span
                        style={{
                          color:
                            movementStats.maxTurnSpeed.current > movementStats.maxTurnSpeed.base
                              ? '#2ecc71'
                              : movementStats.maxTurnSpeed.current < movementStats.maxTurnSpeed.base
                                ? '#e74c3c'
                                : undefined,
                        }}
                      >
                        {Math.round(rad2Deg(movementStats.maxTurnSpeed.current))} °/с
                      </span>
                      {Math.round(rad2Deg(movementStats.maxTurnSpeed.current)) !==
                        Math.round(rad2Deg(movementStats.maxTurnSpeed.base)) && (
                        <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                          (база {Math.round(rad2Deg(movementStats.maxTurnSpeed.base))})
                        </span>
                      )}
                    </dd>
                  </div>
                </>
              )}
              {stealthStats && (
                <>
                  <div className="stat-row">
                    <dt>Скрытность:</dt>
                    <dd>
                      <span
                        style={{
                          color:
                            stealthStats.stealthPower.current > stealthStats.stealthPower.base
                              ? '#2ecc71'
                              : stealthStats.stealthPower.current < stealthStats.stealthPower.base
                                ? '#e74c3c'
                                : undefined,
                        }}
                      >
                        {Math.round(stealthStats.stealthPower.current)}
                      </span>
                      {stealthStats.stealthPower.current !== stealthStats.stealthPower.base && (
                        <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                          (база {stealthStats.stealthPower.base})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="stat-row">
                    <dt>Скрытность (присяд):</dt>
                    <dd>x{stealthStats.crouchStealthMultiplier.toFixed(1)}</dd>
                  </div>
                  <div className="stat-row">
                    <dt>Скрытность (бег):</dt>
                    <dd>x{stealthStats.runStealthMultiplier.toFixed(1)}</dd>
                  </div>
                </>
              )}
              {weaponStats && (
                <>
                  <div className="stat-row">
                    <dt>Базовый урон:</dt>
                    <dd>
                      <span
                        style={{
                          color:
                            weaponStats.baseDamage.current > weaponStats.baseDamage.base
                              ? '#2ecc71'
                              : weaponStats.baseDamage.current < weaponStats.baseDamage.base
                                ? '#e74c3c'
                                : undefined,
                        }}
                      >
                        {Math.round(weaponStats.baseDamage.current)}
                      </span>
                      {weaponStats.baseDamage.current !== weaponStats.baseDamage.base && (
                        <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                          (база {weaponStats.baseDamage.base})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="stat-row">
                    <dt>Подготовка / Восст.:</dt>
                    <dd>
                      {weaponStats.prepTime.current.toFixed(2)}с /{' '}
                      {weaponStats.recoveryTime.current.toFixed(2)}с
                    </dd>
                  </div>
                </>
              )}
              {armorStats && (
                <>
                  <div className="stat-row">
                    <dt>Защита:</dt>
                    <dd>
                      <span
                        style={{
                          color:
                            armorStats.defense.current > armorStats.defense.base
                              ? '#2ecc71'
                              : armorStats.defense.current < armorStats.defense.base
                                ? '#e74c3c'
                                : undefined,
                        }}
                      >
                        {armorStats.defense.current}
                      </span>
                      {armorStats.defense.current !== armorStats.defense.base && (
                        <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                          (база {armorStats.defense.base})
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="stat-row">
                    <dt>Поглощение:</dt>
                    <dd>
                      <span
                        style={{
                          color:
                            armorStats.flatReduction.current > armorStats.flatReduction.base
                              ? '#2ecc71'
                              : armorStats.flatReduction.current < armorStats.flatReduction.base
                                ? '#e74c3c'
                                : undefined,
                        }}
                      >
                        {armorStats.flatReduction.current}
                      </span>
                      {armorStats.flatReduction.current !== armorStats.flatReduction.base && (
                        <span style={{ color: '#888', marginLeft: '4px', fontSize: '11px' }}>
                          (база {armorStats.flatReduction.base})
                        </span>
                      )}
                    </dd>
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

            {equip && equip.interactionSlots.length > 0 && (
              <>
                <h4 style={{ marginTop: '12px', fontSize: '13px', color: '#bdc3c7' }}>
                  Ячейки взаимодействия:
                </h4>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}
                >
                  {equip.interactionSlots.map((slot) => {
                    const slotItem = slot.itemId ? world.getComponent(slot.itemId, 'item') : null;
                    return (
                      <div
                        key={`inter_${slot.id}`}
                        onClick={() => selectedEntityId && openSlotModal(selectedEntityId, slot.id)}
                        style={{
                          backgroundColor: slot.itemId ? '#243342' : '#1e1e1e',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          border: slot.itemId ? '1px solid #2980b9' : '1px solid #444',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        title="Нажмите для настройки параметров ячейки"
                      >
                        <span style={{ color: slot.itemId ? '#ecf0f1' : '#777' }}>
                          {slotItem ? slotItem.name : 'Пусто'}
                        </span>
                        <span style={{ color: '#888', fontSize: '11px' }}>⚙️</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {equip && equip.equipmentAreas.length > 0 && (
              <>
                <h4 style={{ marginTop: '12px', fontSize: '13px', color: '#bdc3c7' }}>
                  Области экипировки:
                </h4>
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}
                >
                  {equip.equipmentAreas.map((area) => {
                    const isOccupied = area.itemIds.length > 0;
                    return (
                      <div
                        key={`area_${area.id}`}
                        onClick={() => selectedEntityId && openAreaModal(selectedEntityId, area.id)}
                        style={{
                          backgroundColor: isOccupied ? '#1e3d29' : '#1e1e1e',
                          padding: '6px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px',
                          border: isOccupied ? '1px solid #27ae60' : '1px solid #444',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                        title="Нажмите для настройки области и списка надетых предметов"
                      >
                        <span style={{ color: isOccupied ? '#2ecc71' : '#aaa' }}>{area.name}</span>
                        <span style={{ color: '#888', fontSize: '11px' }}>
                          {isOccupied ? `(${area.itemIds.length})` : 'Пусто'}
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
            <li>
              <kbd>W</kbd> / <kbd>S</kbd> Движение вперед / назад
            </li>
            <li>
              <kbd>A</kbd> / <kbd>D</kbd> Стрейф влево / вправо
            </li>
            <li>
              <kbd>Мышь</kbd> Направление взгляда / прицеливание
            </li>
            <li>
              <kbd>Пробел</kbd> Атака оружием
            </li>
            <li>
              <kbd>LCtrl</kbd> + <kbd>ЛКМ</kbd> Подобрать предмет
            </li>
            <li>
              <kbd>LShift</kbd> Спринт (только вперед)
            </li>
            <li>
              <kbd>X</kbd> Шаг (переключатель)
            </li>
            <li>
              <kbd>C</kbd> Присед (удержание)
            </li>
          </ul>
        ) : mode === GameMode.SIMULATION ? (
          <ul className="control-keys">
            <li>
              <kbd>Пробел</kbd> Пауза / Возобновление симуляции
            </li>
            <li>
              <kbd>U</kbd> Дерево поведения (BT)
            </li>
          </ul>
        ) : (
          <ul className="control-keys">
            <li>
              <kbd>U</kbd> Дерево поведения (BT)
            </li>
            <li>
              <kbd>Ctrl+P</kbd> Быстрый спавн игрока
            </li>
            <li>
              <kbd>Ctrl+B</kbd> Быстрый спавн бота
            </li>
            <li>
              <kbd>Ctrl+I</kbd> Добавить предмет
            </li>
          </ul>
        )}
      </div>
    </div>
  );
};
