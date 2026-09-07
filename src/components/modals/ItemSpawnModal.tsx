import React, { useState } from 'react';
import { EntityConfig, STANDARD_RADII, StandardRadius, HitZoneConfig } from '../../ecs/types';
import {
  WeaponFormFields,
  ArmorFormFields,
  BagFormFields,
  WeaponFormValues,
  ArmorFormValues,
  BagFormValues,
} from './forms/FormFields';
import { createRandomWeaponPreset } from '../../Weapon';
import { deg2Rad, rad2Deg, Degrees } from '../../utils';

export interface ItemSpawnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: EntityConfig) => void;
}

const createInitialWeaponState = () => {
  const preset = createRandomWeaponPreset();
  const values: WeaponFormValues = {
    name: preset.name,
    weight: preset.weight,
    baseDamage: preset.combat.baseDamage,
    prepTime: preset.combat.prepTime,
    recoveryTime: preset.combat.recoveryTime,
    length: preset.zone.length ?? 150,
    radius: preset.zone.radius ?? 50,
    rayCount: preset.zone.rayCount ?? 5,
    angle:
      preset.zone.angle !== undefined
        ? (Math.round(rad2Deg(preset.zone.angle)) as Degrees)
        : (30 as Degrees),
    pierceObstacles: !!preset.zone.pierceObstacles,
    piercePlayers: !!preset.zone.piercePlayers,
    pierceBots: !!preset.zone.pierceBots,
    hitZoneType: preset.zone.hitZoneType,
  };
  return { preset, values };
};

export const ItemSpawnModal: React.FC<ItemSpawnModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [type, setType] = useState<'weapon' | 'armor' | 'bag'>('weapon');
  const [isSolid, setIsSolid] = useState(true);
  const [radius, setRadius] = useState<StandardRadius>(16);

  const [initialWeapon] = useState(createInitialWeaponState);
  const [weaponValues, setWeaponValues] = useState<WeaponFormValues>(initialWeapon.values);

  const [armorValues, setArmorValues] = useState<ArmorFormValues>({
    name: 'Новая броня',
    defense: 15,
    flatReduction: 3,
    weight: 3,
  });

  const [bagValues, setBagValues] = useState<BagFormValues>({
    name: 'Новый рюкзак',
    width: 6,
    height: 4,
    weight: 1,
  });

  if (!isOpen) return null;

  const handleConfirm = () => {
    let config: EntityConfig;

    if (type === 'weapon') {
      const zoneType = weaponValues.hitZoneType;
      let zone: HitZoneConfig;
      if (zoneType === 'radius') {
        zone = {
          hitZoneType: 'radius',
          radius: weaponValues.radius,
        };
      } else if (zoneType === 'angle') {
        zone = {
          hitZoneType: 'angle',
          length: weaponValues.length,
          angle: deg2Rad(weaponValues.angle),
        };
      } else if (zoneType === 'forward_line') {
        zone = {
          hitZoneType: 'forward_line',
          length: weaponValues.length,
          pierceObstacles: weaponValues.pierceObstacles,
          piercePlayers: weaponValues.piercePlayers,
          pierceBots: weaponValues.pierceBots,
        };
      } else {
        zone = {
          hitZoneType: 'shrapnel',
          length: weaponValues.length,
          angle: deg2Rad(weaponValues.angle),
          rayCount: weaponValues.rayCount,
          pierceObstacles: weaponValues.pierceObstacles,
          piercePlayers: weaponValues.piercePlayers,
          pierceBots: weaponValues.pierceBots,
        };
      }

      config = {
        item: { name: weaponValues.name, type: 'weapon', maxStack: 1 },
        physics: { radius, weight: weaponValues.weight, isSolid },
        weaponStats: {
          baseDamage: weaponValues.baseDamage,
          prepTime: weaponValues.prepTime,
          recoveryTime: weaponValues.recoveryTime,
        },
        weaponZone: zone,
      };
    } else if (type === 'armor') {
      config = {
        item: { name: armorValues.name, type: 'armor', maxStack: 1 },
        physics: { radius, weight: armorValues.weight, isSolid },
        armorStats: {
          defense: armorValues.defense,
          flatReduction: armorValues.flatReduction,
        },
      };
    } else {
      config = {
        item: { name: bagValues.name, type: 'bag', maxStack: 1 },
        physics: { radius, weight: bagValues.weight, isSolid },
        inventory: {
          size: { width: bagValues.width, height: bagValues.height },
        },
      };
    }

    onConfirm(config);
  };

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>Параметры нового предмета</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Тип предмета:
            <select
              value={type}
              onChange={(e) => setType(e.target.value as 'weapon' | 'armor' | 'bag')}
            >
              <option value="weapon">Оружие</option>
              <option value="armor">Броня</option>
              <option value="bag">Сумка</option>
            </select>
          </label>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              margin: '8px 0',
            }}
          >
            <input
              type="checkbox"
              checked={isSolid}
              onChange={(e) => setIsSolid(e.target.checked)}
            />
            Участвует в коллизии
          </label>

          {isSolid && (
            <label>
              Радиус тела:
              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value) as StandardRadius)}
              >
                {STANDARD_RADII.map((r) => (
                  <option key={r} value={r}>
                    {r} px
                  </option>
                ))}
              </select>
            </label>
          )}

          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #333' }}>
            {type === 'weapon' && (
              <WeaponFormFields
                values={weaponValues}
                onChange={(v) => setWeaponValues({ ...weaponValues, ...v })}
              />
            )}
            {type === 'armor' && (
              <ArmorFormFields
                values={armorValues}
                onChange={(v) => setArmorValues({ ...armorValues, ...v })}
              />
            )}
            {type === 'bag' && (
              <BagFormFields
                values={bagValues}
                onChange={(v) => setBagValues({ ...bagValues, ...v })}
              />
            )}
          </div>
        </form>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            Выбрать место
          </button>
        </div>
      </div>
    </div>
  );
};
