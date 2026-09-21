import React, { useState, useEffect, useRef } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { HitZoneType } from '../../ecs/types';
import { WeaponFormFields, WeaponFormValues } from '../modals/forms/FormFields';
import { DEFAULT_ZONE_PARAMS, ZoneTypeParams } from '../../Weapon';
import { rad2Deg, deg2Rad, Degrees } from '../../utils';
import { t } from '../../locales';

export interface WeaponInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const WeaponInspector: React.FC<WeaponInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const wStats = world.getComponent(targetId, 'weaponStats');
  const wZone = world.getComponent(targetId, 'weaponZone');
  const item = world.getComponent(targetId, 'item');
  const meta = world.getComponent(targetId, 'meta');

  const [weaponData, setWeaponData] = useState<WeaponFormValues | null>(null);

  const zoneParamsMapRef = useRef<Record<HitZoneType, ZoneTypeParams>>({
    angle: { ...DEFAULT_ZONE_PARAMS.angle },
    radius: { ...DEFAULT_ZONE_PARAMS.radius },
    forward_line: { ...DEFAULT_ZONE_PARAMS.forward_line },
    shrapnel: { ...DEFAULT_ZONE_PARAMS.shrapnel },
  });

  useEffect(() => {
    const s = world.getComponent(targetId, 'weaponStats');
    const z = world.getComponent(targetId, 'weaponZone');
    const it = world.getComponent(targetId, 'item');
    const m = world.getComponent(targetId, 'meta');

    if (s && z) {
      setWeaponData({
        name: m?.name ?? it?.name ?? 'Оружие',
        size: it?.size ?? 10,
        equipTypes: it?.equipTypes ?? [],
        equippable: it?.equippable ?? false,
        equipTimeMultiplier: it?.equipTimeMultiplier ?? 1.0,
        baseDamage: s.baseDamage.base,
        prepTime: s.prepTime.base,
        recoveryTime: s.recoveryTime.base,
        length: z.length ?? 4.5,
        radius: z.radius ?? 2.5,
        rayCount: z.rayCount ?? 5,
        angle: z.angle !== undefined ? (Math.round(rad2Deg(z.angle)) as Degrees) : (30 as Degrees),
        pierceObstacles: !!z.pierceObstacles,
        pierceCreatures: !!z.pierceCreatures,
        pierceItems: !!z.pierceItems,
        hitZoneType: z.hitZoneType,
      });
    } else {
      setWeaponData(null);
    }
  }, [targetId, world]);

  if (!wStats || !wZone || !weaponData) return null;

  const handleChange = (patch: Partial<WeaponFormValues>) => {
    const updated = { ...weaponData, ...patch };
    setWeaponData(updated);
    if (app) {
      app.updateEntityWeapon(targetId, updated);
      onCommit(t('history.weaponChange'));
    }
  };

  const handleZoneTypeChange = (newType: HitZoneType) => {
    zoneParamsMapRef.current[weaponData.hitZoneType] = {
      length: weaponData.length,
      radius: weaponData.radius,
      rayCount: weaponData.rayCount,
      angle: deg2Rad(weaponData.angle),
      pierceObstacles: weaponData.pierceObstacles,
      pierceCreatures: weaponData.pierceCreatures,
      pierceItems: weaponData.pierceItems,
    };
    const np = zoneParamsMapRef.current[newType] || DEFAULT_ZONE_PARAMS[newType];
    const updated: WeaponFormValues = {
      ...weaponData,
      hitZoneType: newType,
      length: np.length,
      radius: np.radius,
      rayCount: np.rayCount,
      angle: Math.round(rad2Deg(np.angle)) as Degrees,
      pierceObstacles: np.pierceObstacles,
      pierceCreatures: np.pierceCreatures,
      pierceItems: np.pierceItems,
    };
    setWeaponData(updated);
    if (app) {
      app.updateEntityWeapon(targetId, updated);
      onCommit(t('history.weaponChange'));
    }
  };

  return (
    <WeaponFormFields
      values={weaponData}
      onChange={handleChange}
      onZoneTypeChange={handleZoneTypeChange}
      isReadOnly={isReadOnly}
    />
  );
};
