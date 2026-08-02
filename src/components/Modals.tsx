import React from 'react';
import {
  CreatureType,
  WeaponConfig,
  ArmorConfig,
  InventoryConfig,
  ItemData,
  STANDARD_RADII,
  StandardRadius,
} from '../ecs/types';

export interface SpawnModalProps {
  isOpen: boolean;
  pendingSpawnType: CreatureType | null;
  radius: number;
  setRadius: (val: StandardRadius) => void;
  mass: number;
  setMass: (val: number) => void;
  maxSpeed: number;
  setMaxSpeed: (val: number) => void;
  maxTurnSpeed: number;
  setMaxTurnSpeed: (val: number) => void;
  runSpeedMultiplier: number;
  setRunSpeedMultiplier: (val: number) => void;
  crouchSpeedMultiplier: number;
  setCrouchSpeedMultiplier: (val: number) => void;
  crouchStealthMultiplier: number;
  setCrouchStealthMultiplier: (val: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const SpawnModal: React.FC<SpawnModalProps> = ({
  isOpen,
  pendingSpawnType,
  radius,
  setRadius,
  mass,
  setMass,
  maxSpeed,
  setMaxSpeed,
  maxTurnSpeed,
  setMaxTurnSpeed,
  runSpeedMultiplier,
  setRunSpeedMultiplier,
  crouchSpeedMultiplier,
  setCrouchSpeedMultiplier,
  crouchStealthMultiplier,
  setCrouchStealthMultiplier,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>Параметры нового существа</h3>
        <p className="modal-subtitle">
          Тип: {pendingSpawnType === 'player' ? 'Игрок' : 'Бот'}
        </p>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Радиус:
            <select value={radius} onChange={(e) => {
                const val = Number(e.target.value);
                if ((STANDARD_RADII as readonly number[]).includes(val)) {
                  setRadius(val as StandardRadius);
                }
              }}>
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
            Макс. скорость поворота (°/с):
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
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Выбрать место
          </button>
        </div>
      </div>
    </div>
  );
};

export interface CreatureEditModalProps {
  isOpen: boolean;
  editRadius: number;
  setEditRadius: (val: StandardRadius) => void;
  editHp: number;
  setEditHp: (val: number) => void;
  editMaxHp: number;
  setEditMaxHp: (val: number) => void;
  editMaxSpeed: number;
  setEditMaxSpeed: (val: number) => void;
  editMaxTurnSpeed: number;
  setEditMaxTurnSpeed: (val: number) => void;
  editRunSpeedMultiplier: number;
  setEditRunSpeedMultiplier: (val: number) => void;
  editCrouchSpeedMultiplier: number;
  setEditCrouchSpeedMultiplier: (val: number) => void;
  editCrouchStealthMultiplier: number;
  setEditCrouchStealthMultiplier: (val: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const CreatureEditModal: React.FC<CreatureEditModalProps> = ({
  isOpen,
  editRadius,
  setEditRadius,
  editHp,
  setEditHp,
  editMaxHp,
  setEditMaxHp,
  editMaxSpeed,
  setEditMaxSpeed,
  editMaxTurnSpeed,
  setEditMaxTurnSpeed,
  editRunSpeedMultiplier,
  setEditRunSpeedMultiplier,
  editCrouchSpeedMultiplier,
  setEditCrouchSpeedMultiplier,
  editCrouchStealthMultiplier,
  setEditCrouchStealthMultiplier,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>Изменить параметры существа</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Радиус:
            <select value={editRadius} onChange={(e) => setEditRadius(Number(e.target.value) as StandardRadius)}>
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
            Макс. скорость поворота (°/с):
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
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};

export interface WeaponEditModalProps {
  selectedWeaponForEdit: WeaponConfig | null;
  editWeaponName: string;
  setEditWeaponName: (val: string) => void;
  editWeaponDamage: number;
  setEditWeaponDamage: (val: number) => void;
  editWeaponPrepTime: number;
  setEditWeaponPrepTime: (val: number) => void;
  editWeaponRecoveryTime: number;
  setEditWeaponRecoveryTime: (val: number) => void;
  editWeaponRange: number;
  setEditWeaponRange: (val: number) => void;
  editWeaponRadius: number;
  setEditWeaponRadius: (val: number) => void;
  editWeaponNumLines: number;
  setEditWeaponNumLines: (val: number) => void;
  editWeaponAngle: number;
  setEditWeaponAngle: (val: number) => void;
  editWeaponPierceObstacles: boolean;
  setEditWeaponPierceObstacles: (val: boolean) => void;
  editWeaponPiercePlayers: boolean;
  setEditWeaponPiercePlayers: (val: boolean) => void;
  editWeaponPierceBots: boolean;
  setEditWeaponPierceBots: (val: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const WeaponEditModal: React.FC<WeaponEditModalProps> = ({
  selectedWeaponForEdit,
  editWeaponName,
  setEditWeaponName,
  editWeaponDamage,
  setEditWeaponDamage,
  editWeaponPrepTime,
  setEditWeaponPrepTime,
  editWeaponRecoveryTime,
  setEditWeaponRecoveryTime,
  editWeaponRange,
  setEditWeaponRange,
  editWeaponRadius,
  setEditWeaponRadius,
  editWeaponNumLines,
  setEditWeaponNumLines,
  editWeaponAngle,
  setEditWeaponAngle,
  editWeaponPierceObstacles,
  setEditWeaponPierceObstacles,
  editWeaponPiercePlayers,
  setEditWeaponPiercePlayers,
  editWeaponPierceBots,
  setEditWeaponPierceBots,
  onClose,
  onConfirm,
}) => {
  if (!selectedWeaponForEdit) return null;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
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
          {(((selectedWeaponForEdit as any).zone.range !== undefined) ||
            ((selectedWeaponForEdit as any).zone.length !== undefined)) && (
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
          {((selectedWeaponForEdit as any).zone.radius !== undefined) && (
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
          {(((selectedWeaponForEdit as any).zone.numLines !== undefined) ||
            ((selectedWeaponForEdit as any).zone.lines !== undefined) ||
            ((selectedWeaponForEdit as any).zone.rayCount !== undefined)) && (
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
          {((selectedWeaponForEdit as any).zone.angle !== undefined) && (
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
          {['line', 'forward_line', 'shrapnel'].includes(selectedWeaponForEdit.zone.hitZoneType) && (
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
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};

export interface ArmorEditModalProps {
  selectedArmorForEdit: ArmorConfig | null;
  editArmorName: string;
  setEditArmorName: (val: string) => void;
  editArmorDefense: number;
  setEditArmorDefense: (val: number) => void;
  editArmorFlatReduction: number;
  setEditArmorFlatReduction: (val: number) => void;
  editArmorWeight: number;
  setEditArmorWeight: (val: number) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const ArmorEditModal: React.FC<ArmorEditModalProps> = ({
  selectedArmorForEdit,
  editArmorName,
  setEditArmorName,
  editArmorDefense,
  setEditArmorDefense,
  editArmorFlatReduction,
  setEditArmorFlatReduction,
  editArmorWeight,
  setEditArmorWeight,
  onClose,
  onConfirm,
}) => {
  if (!selectedArmorForEdit) return null;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>Изменить параметры брони</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Название:
            <input
              type="text"
              value={editArmorName}
              onChange={(e) => setEditArmorName(e.target.value)}
            />
          </label>
          <label>
            Защита:
            <input
              type="number"
              value={editArmorDefense}
              min={0}
              max={100}
              onChange={(e) => setEditArmorDefense(Number(e.target.value))}
            />
          </label>
          <label>
            Поглощение урона:
            <input
              type="number"
              value={editArmorFlatReduction}
              min={0}
              max={100}
              onChange={(e) => setEditArmorFlatReduction(Number(e.target.value))}
            />
          </label>
          <label>
            Вес:
            <input
              type="number"
              value={editArmorWeight}
              min={0}
              max={100}
              onChange={(e) => setEditArmorWeight(Number(e.target.value))}
            />
          </label>
        </form>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};

export interface BagEditModalProps {
  selectedBagForEdit: InventoryConfig | null;
  editBagName: string;
  setEditBagName: (val: string) => void;
  editBagWidth: number;
  setEditBagWidth: (val: number) => void;
  editBagHeight: number;
  setEditBagHeight: (val: number) => void;
  editBagWeight: number;
  setEditBagWeight: (val: number) => void;
  isBagInventoryEmpty: boolean;
  inventorySlots?: { item: ItemData | null; count: number }[][];
  inventorySize?: { width: number; height: number };
  onItemClick: (item: ItemData) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const BagEditModal: React.FC<BagEditModalProps> = ({
  selectedBagForEdit,
  editBagName,
  setEditBagName,
  editBagWidth,
  setEditBagWidth,
  editBagHeight,
  setEditBagHeight,
  editBagWeight,
  setEditBagWeight,
  isBagInventoryEmpty,
  inventorySlots,
  inventorySize,
  onItemClick,
  onClose,
  onConfirm,
}) => {
  if (!selectedBagForEdit) return null;

  const currentSlots =
    inventorySlots ||
    Array.from({ length: editBagHeight }, () =>
      Array.from({ length: editBagWidth }, () => ({ item: null, count: 0 }))
    );

  const gridWidth = inventorySize?.width || editBagWidth;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>Изменить параметры сумки</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Название:
            <input
              type="text"
              value={editBagName}
              onChange={(e) => setEditBagName(e.target.value)}
            />
          </label>
          <label>
            Ширина инвентаря (ячейки):
            <input
              type="number"
              value={editBagWidth}
              min={1}
              max={12}
              disabled={!isBagInventoryEmpty}
              onChange={(e) => setEditBagWidth(Number(e.target.value))}
            />
          </label>
          <label>
            Высота инвентаря (ячейки):
            <input
              type="number"
              value={editBagHeight}
              min={1}
              max={12}
              disabled={!isBagInventoryEmpty}
              onChange={(e) => setEditBagHeight(Number(e.target.value))}
            />
          </label>
          {!isBagInventoryEmpty && (
            <p style={{ fontSize: '12px', color: '#e74c3c', margin: '4px 0' }}>
              Размер инвентаря можно изменить только когда сумка пуста
            </p>
          )}
          <label>
            Вес:
            <input
              type="number"
              value={editBagWeight}
              min={0}
              max={100}
              onChange={(e) => setEditBagWeight(Number(e.target.value))}
            />
          </label>
        </form>

        <div style={{ marginTop: '12px' }}>
          <h4 style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '8px' }}>
            Инвентарь сумки (нажмите на предмет для настройки):
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridWidth}, 38px)`,
              gap: '4px',
              justifyContent: 'center',
              backgroundColor: '#111',
              padding: '10px',
              borderRadius: '6px',
              border: '1px solid #333',
              maxHeight: '260px',
              overflowY: 'auto',
            }}
          >
            {currentSlots.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const item = cell.item;
                return (
                  <div
                    key={`${rIdx}_${cIdx}`}
                    onClick={() => {
                      if (item) onItemClick(item);
                    }}
                    title={item ? `${item.name} (${item.type})` : 'Пустая ячейка'}
                    style={{
                      width: '38px',
                      height: '38px',
                      backgroundColor: item ? '#2980b9' : '#222',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: item ? 'pointer' : 'default',
                      fontSize: '10px',
                      color: '#fff',
                      textAlign: 'center',
                      padding: '2px',
                      overflow: 'hidden',
                      userSelect: 'none',
                    }}
                  >
                    {item ? item.name.substring(0, 5) : ''}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={onConfirm}>
            Применить
          </button>
        </div>
      </div>
    </div>
  );
};