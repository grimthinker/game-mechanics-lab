import React, { useState } from 'react';
import { ItemData, STANDARD_RADII, StandardRadius, WeaponConfig } from '../../ecs/types';
import { WeaponFormFields, ArmorFormFields, BagFormFields, WeaponFormValues, ArmorFormValues, BagFormValues } from './forms/FormFields';
import { createRandomWeaponItem } from '../../Weapon';

export interface ItemSpawnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (itemData: ItemData, isSolid: boolean, radius: StandardRadius) => void;
}

const createInitialWeaponState = () => {
    const w = createRandomWeaponItem();
    const cfg = w.config as WeaponConfig;
    const values: WeaponFormValues = {
      name: w.name,
      weight: cfg.weight ?? 1,
      baseDamage: cfg.baseDamage,
      prepTime: cfg.prepTime,
      recoveryTime: cfg.recoveryTime,
      length: cfg.zone.length ?? 150,
      radius: cfg.zone.radius ?? 50,
      rayCount: cfg.zone.rayCount ?? 5,
      angle: cfg.zone.angle !== undefined ? Math.round((cfg.zone.angle * 180) / Math.PI) : 30,
      pierceObstacles: !!cfg.zone.pierceObstacles,
      piercePlayers: !!cfg.zone.piercePlayers,
      pierceBots: !!cfg.zone.pierceBots,
      hitZoneType: cfg.zone.hitZoneType,
    };
    return { draft: w, values };
  };

export const ItemSpawnModal: React.FC<ItemSpawnModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [type, setType] = useState<'weapon' | 'armor' | 'bag'>('weapon');
  const [isSolid, setIsSolid] = useState(true);
  const [radius, setRadius] = useState<StandardRadius>(16);

  const [initialWeapon] = useState(createInitialWeaponState);
  const [weaponDraft] = useState<ItemData>(initialWeapon.draft);
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
    const id = `item_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    let finalData: ItemData;

    if (type === 'weapon') {
        const wcfg: WeaponConfig = JSON.parse(JSON.stringify(weaponDraft.config));
        wcfg.id = `wcfg_${Date.now()}`;
        wcfg.name = weaponValues.name;
        wcfg.weight = weaponValues.weight;
        wcfg.baseDamage = weaponValues.baseDamage;
        wcfg.prepTime = weaponValues.prepTime;
        wcfg.recoveryTime = weaponValues.recoveryTime;
        wcfg.isSolid = isSolid;
        wcfg.radius = radius;
  
        const zoneType = weaponValues.hitZoneType;
        if (zoneType === 'radius') {
          wcfg.zone = {
            hitZoneType: 'radius',
            radius: weaponValues.radius,
          };
        } else if (zoneType === 'angle') {
          wcfg.zone = {
            hitZoneType: 'angle',
            length: weaponValues.length,
            angle: (weaponValues.angle * Math.PI) / 180,
          };
        } else if (zoneType === 'forward_line') {
          wcfg.zone = {
            hitZoneType: 'forward_line',
            length: weaponValues.length,
            pierceObstacles: weaponValues.pierceObstacles,
            piercePlayers: weaponValues.piercePlayers,
            pierceBots: weaponValues.pierceBots,
          };
        } else {
          wcfg.zone = {
            hitZoneType: 'shrapnel',
            length: weaponValues.length,
            angle: (weaponValues.angle * Math.PI) / 180,
            rayCount: weaponValues.rayCount,
            pierceObstacles: weaponValues.pierceObstacles,
            piercePlayers: weaponValues.piercePlayers,
            pierceBots: weaponValues.pierceBots,
          };
        }
  
        finalData = { ...weaponDraft, id, name: weaponValues.name, config: wcfg } as ItemData;
      } else if (type === 'armor') {
      finalData = {
        id,
        name: armorValues.name,
        type: 'armor',
        maxStack: 1,
        config: {
          id: `armor_cfg_${Math.random().toString(36).substring(2, 5)}`,
          name: armorValues.name,
          weight: armorValues.weight,
          radius,
          isSolid,
          defense: armorValues.defense,
          flat_reduction: armorValues.flatReduction,
        },
      } as ItemData;
    } else {
      finalData = {
        id,
        name: bagValues.name,
        type: 'bag',
        maxStack: 1,
        config: {
          id: `bag_cfg_${Math.random().toString(36).substring(2, 5)}`,
          name: bagValues.name,
          weight: bagValues.weight,
          radius,
          isSolid,
          size: { width: bagValues.width, height: bagValues.height },
        },
      } as ItemData;
    }

    onConfirm(finalData, isSolid, radius);
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
            <select value={type} onChange={(e) => setType(e.target.value as 'weapon' | 'armor' | 'bag')}>
              <option value="weapon">Оружие</option>
              <option value="armor">Броня</option>
              <option value="bag">Сумка</option>
            </select>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: '8px 0' }}>
            <input type="checkbox" checked={isSolid} onChange={(e) => setIsSolid(e.target.checked)} />
            Участвует в коллизии
          </label>

          {isSolid && (
            <label>
              Радиус тела:
              <select value={radius} onChange={(e) => setRadius(Number(e.target.value) as StandardRadius)}>
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
              <WeaponFormFields values={weaponValues} onChange={(v) => setWeaponValues({ ...weaponValues, ...v })} />
            )}
            {type === 'armor' && (
              <ArmorFormFields values={armorValues} onChange={(v) => setArmorValues({ ...armorValues, ...v })} />
            )}
            {type === 'bag' && (
              <BagFormFields values={bagValues} onChange={(v) => setBagValues({ ...bagValues, ...v })} />
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