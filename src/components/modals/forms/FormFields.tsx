import React from 'react';
import { HitZoneType } from '../../../ecs/types';
import { HIT_ZONE_LABELS } from '../../../Weapon';

export interface WeaponFormValues {
  name: string;
  weight: number;
  baseDamage: number;
  prepTime: number;
  recoveryTime: number;
  range: number;
  radius: number;
  numLines: number;
  angle: number;
  pierceObstacles: boolean;
  piercePlayers: boolean;
  pierceBots: boolean;
  hitZoneType: HitZoneType;
}

export const WeaponFormFields: React.FC<{
  values: WeaponFormValues;
  onChange: (v: Partial<WeaponFormValues>) => void;
  onZoneTypeChange?: (newType: HitZoneType) => void;
  isReadOnly?: boolean;
}> = ({ values, onChange, onZoneTypeChange, isReadOnly }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <label>
      Название:
      <input
        disabled={isReadOnly}
        type="text"
        value={values.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
    </label>
    <label>
      Вид зоны поражения:
      <select
        disabled={isReadOnly}
        value={values.hitZoneType}
        onChange={(e) => {
          const newType = e.target.value as HitZoneType;
          if (onZoneTypeChange) {
            onZoneTypeChange(newType);
          } else {
            onChange({ hitZoneType: newType });
          }
        }}
      >
        <option value="angle">{HIT_ZONE_LABELS.angle}</option>
        <option value="radius">{HIT_ZONE_LABELS.radius}</option>
        <option value="forward_line">{HIT_ZONE_LABELS.forward_line}</option>
        <option value="shrapnel">{HIT_ZONE_LABELS.shrapnel}</option>
      </select>
    </label>
    <label>
      Вес:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.weight}
        min={0}
        max={100}
        onChange={(e) => onChange({ weight: Number(e.target.value) })}
      />
    </label>
    <label>
      Базовый урон:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.baseDamage}
        min={0}
        max={500}
        onChange={(e) => onChange({ baseDamage: Number(e.target.value) })}
      />
    </label>
    <label>
      Подготовка (сек):
      <input
        disabled={isReadOnly}
        type="number"
        value={values.prepTime}
        min={0.05}
        max={5}
        step={0.05}
        onChange={(e) => onChange({ prepTime: Number(e.target.value) })}
      />
    </label>
    <label>
      Восстановление (сек):
      <input
        disabled={isReadOnly}
        type="number"
        value={values.recoveryTime}
        min={0.05}
        max={5}
        step={0.05}
        onChange={(e) => onChange({ recoveryTime: Number(e.target.value) })}
      />
    </label>

    {/* Специфические поля для зоны */}
    {['forward_line', 'angle', 'shrapnel'].includes(values.hitZoneType) && (
      <label>
        Дальность / Длина:
        <input
          disabled={isReadOnly}
          type="number"
          value={values.range}
          min={0}
          max={2000}
          step={10}
          onChange={(e) => onChange({ range: Number(e.target.value) })}
        />
      </label>
    )}
    {values.hitZoneType === 'radius' && (
      <label>
        Радиус:
        <input
          disabled={isReadOnly}
          type="number"
          value={values.radius}
          min={0}
          max={500}
          step={5}
          onChange={(e) => onChange({ radius: Number(e.target.value) })}
        />
      </label>
    )}
    {values.hitZoneType === 'shrapnel' && (
      <label>
        Количество лучей:
        <input
          disabled={isReadOnly}
          type="number"
          value={values.numLines}
          min={1}
          max={50}
          onChange={(e) => onChange({ numLines: Number(e.target.value) })}
        />
      </label>
    )}
    {['angle', 'shrapnel'].includes(values.hitZoneType) && (
      <label>
        Угол (°):
        <input
          disabled={isReadOnly}
          type="number"
          value={values.angle}
          min={0}
          max={360}
          onChange={(e) => onChange({ angle: Number(e.target.value) })}
        />
      </label>
    )}
    {['forward_line', 'shrapnel'].includes(values.hitZoneType) && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            disabled={isReadOnly}
            type="checkbox"
            checked={values.pierceObstacles}
            onChange={(e) => onChange({ pierceObstacles: e.target.checked })}
          />
          Пробивать препятствия
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            disabled={isReadOnly}
            type="checkbox"
            checked={values.piercePlayers}
            onChange={(e) => onChange({ piercePlayers: e.target.checked })}
          />
          Пробивать игроков
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            disabled={isReadOnly}
            type="checkbox"
            checked={values.pierceBots}
            onChange={(e) => onChange({ pierceBots: e.target.checked })}
          />
          Пробивать ботов
        </label>
      </div>
    )}
  </div>
);

export interface ArmorFormValues {
  name: string;
  defense: number;
  flatReduction: number;
  weight: number;
}

export const ArmorFormFields: React.FC<{
  values: ArmorFormValues;
  onChange: (v: Partial<ArmorFormValues>) => void;
  isReadOnly?: boolean;
}> = ({ values, onChange, isReadOnly }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <label>
      Название:
      <input
        disabled={isReadOnly}
        type="text"
        value={values.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
    </label>
    <label>
      Вес:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.weight}
        min={0}
        max={100}
        onChange={(e) => onChange({ weight: Number(e.target.value) })}
      />
    </label>
    <label>
      Защита:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.defense}
        min={0}
        max={100}
        onChange={(e) => onChange({ defense: Number(e.target.value) })}
      />
    </label>
    <label>
      Поглощение урона:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.flatReduction}
        min={0}
        max={100}
        onChange={(e) => onChange({ flatReduction: Number(e.target.value) })}
      />
    </label>
  </div>
);

export interface BagFormValues {
  name: string;
  width: number;
  height: number;
  weight: number;
}

export const BagFormFields: React.FC<{
  values: BagFormValues;
  onChange: (v: Partial<BagFormValues>) => void;
  isReadOnly?: boolean;
  isBagInventoryEmpty?: boolean;
}> = ({ values, onChange, isReadOnly, isBagInventoryEmpty = true }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <label>
      Название:
      <input
        disabled={isReadOnly}
        type="text"
        value={values.name}
        onChange={(e) => onChange({ name: e.target.value })}
      />
    </label>
    <label>
      Вес:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.weight}
        min={0}
        max={100}
        onChange={(e) => onChange({ weight: Number(e.target.value) })}
      />
    </label>
    <label>
      Ширина инвентаря (ячейки):
      <input
        disabled={!isBagInventoryEmpty || isReadOnly}
        type="number"
        value={values.width}
        min={1}
        max={12}
        onChange={(e) => onChange({ width: Number(e.target.value) })}
      />
    </label>
    <label>
      Высота инвентаря (ячейки):
      <input
        disabled={!isBagInventoryEmpty || isReadOnly}
        type="number"
        value={values.height}
        min={1}
        max={12}
        onChange={(e) => onChange({ height: Number(e.target.value) })}
      />
    </label>
    {!isBagInventoryEmpty && !isReadOnly && (
      <p style={{ fontSize: '12px', color: '#e74c3c', margin: '4px 0' }}>
        Размер инвентаря можно изменить только когда сумка пуста
      </p>
    )}
  </div>
);