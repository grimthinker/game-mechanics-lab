import React from 'react';
import { HitZoneType } from '../../../ecs/types';
import { HIT_ZONE_LABELS } from '../../../Weapon';
import { Degrees } from '../../../utils';

export interface WeaponFormValues {
  name: string;
  size: number;
  equipType: string | null;
  equippable: boolean;
  equipTimeMultiplier: number;
  baseDamage: number;
  prepTime: number;
  recoveryTime: number;
  length: number;
  radius: number;
  rayCount: number;
  angle: Degrees;
  pierceObstacles: boolean;
  pierceCreatures: boolean;
  pierceItems: boolean;
  hitZoneType: HitZoneType;
}

export const CommonItemFormFields: React.FC<{
  values: {
    size: number;
    equipType: string | null;
    equippable: boolean;
    equipTimeMultiplier: number;
  };
  onChange: (
    v: Partial<{
      size: number;
      equipType: string | null;
      equippable: boolean;
      equipTimeMultiplier: number;
    }>
  ) => void;
  isReadOnly?: boolean;
}> = ({ values, onChange, isReadOnly }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
    <label>
      Размер предмета (size):
      <input
        disabled={isReadOnly}
        type="number"
        value={values.size}
        min={1}
        max={100}
        onChange={(e) => onChange({ size: Number(e.target.value) })}
      />
    </label>
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <input
        disabled={isReadOnly}
        type="checkbox"
        checked={values.equippable}
        onChange={(e) => onChange({ equippable: e.target.checked })}
      />
      Можно помещать в области экипировки
    </label>
    {values.equippable && (
      <label>
        Тип экипировки (напр. torso, head):
        <input
          disabled={isReadOnly}
          type="text"
          value={values.equipType || ''}
          onChange={(e) => onChange({ equipType: e.target.value || null })}
        />
      </label>
    )}
    <label>
      Множитель времени экипирования:
      <input
        disabled={isReadOnly}
        type="number"
        value={values.equipTimeMultiplier}
        min={0.1}
        max={10}
        step={0.1}
        onChange={(e) => onChange({ equipTimeMultiplier: Number(e.target.value) })}
      />
    </label>
  </div>
);

export const WeaponFormFields: React.FC<{
  values: WeaponFormValues;
  onChange: (v: Partial<WeaponFormValues>) => void;
  onZoneTypeChange?: (newType: HitZoneType) => void;
  isReadOnly?: boolean;
}> = ({ values, onChange, onZoneTypeChange, isReadOnly }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <CommonItemFormFields values={values} onChange={onChange} isReadOnly={isReadOnly} />
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
          value={values.length}
          min={0}
          max={2000}
          step={10}
          onChange={(e) => onChange({ length: Number(e.target.value) })}
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
          value={values.rayCount}
          min={1}
          max={50}
          onChange={(e) => onChange({ rayCount: Number(e.target.value) })}
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
          onChange={(e) => onChange({ angle: Number(e.target.value) as Degrees })}
        />
      </label>
    )}
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
          checked={values.pierceCreatures}
          onChange={(e) => onChange({ pierceCreatures: e.target.checked })}
        />
        Пробивать существ
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
        <input
          disabled={isReadOnly}
          type="checkbox"
          checked={values.pierceItems}
          onChange={(e) => onChange({ pierceItems: e.target.checked })}
        />
        Пробивать предметы
      </label>
    </div>
  </div>
);

export interface ArmorFormValues {
  name: string;
  size: number;
  equipType: string | null;
  equippable: boolean;
  equipTimeMultiplier: number;
  defense: number;
  flatReduction: number;
}

export const ArmorFormFields: React.FC<{
  values: ArmorFormValues;
  onChange: (v: Partial<ArmorFormValues>) => void;
  isReadOnly?: boolean;
}> = ({ values, onChange, isReadOnly }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <CommonItemFormFields values={values} onChange={onChange} isReadOnly={isReadOnly} />
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
  size: number;
  equipType: string | null;
  equippable: boolean;
  equipTimeMultiplier: number;
  width: number;
  height: number;
}

export const BagFormFields: React.FC<{
  values: BagFormValues;
  onChange: (v: Partial<BagFormValues>) => void;
  isReadOnly?: boolean;
  isBagInventoryEmpty?: boolean;
}> = ({ values, onChange, isReadOnly, isBagInventoryEmpty = true }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <CommonItemFormFields values={values} onChange={onChange} isReadOnly={isReadOnly} />
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
