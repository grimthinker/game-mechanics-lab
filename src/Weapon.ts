import { WeaponConfig, ItemData, HitZoneType } from './ecs/types';

export const HIT_ZONE_LABELS: Record<HitZoneType, string> = {
  angle: 'Сектор',
  radius: 'Аура',
  forward_line: 'Прямая линия',
  shrapnel: 'Шрапнель',
};

export interface ZoneTypeParams {
  range: number;
  radius: number;
  angle: number;
  numLines: number;
  pierceObstacles: boolean;
  piercePlayers: boolean;
  pierceBots: boolean;
}

export const DEFAULT_ZONE_PARAMS: Record<HitZoneType, ZoneTypeParams> = {
  angle: {
    range: 100,
    radius: 50,
    angle: 30,
    numLines: 5,
    pierceObstacles: false,
    piercePlayers: false,
    pierceBots: false,
  },
  radius: {
    range: 100,
    radius: 50,
    angle: 30,
    numLines: 5,
    pierceObstacles: false,
    piercePlayers: false,
    pierceBots: false,
  },
  forward_line: {
    range: 150,
    radius: 50,
    angle: 30,
    numLines: 5,
    pierceObstacles: false,
    piercePlayers: false,
    pierceBots: false,
  },
  shrapnel: {
    range: 120,
    radius: 50,
    angle: 60,
    numLines: 5,
    pierceObstacles: false,
    piercePlayers: false,
    pierceBots: false,
  },
};

// Глобальное состояние последнего добавленного оружия и параметров для каждого типа зоны
export const lastAddedWeaponConfigState: {
  config: WeaponConfig | null;
  zoneParamsMap: Record<HitZoneType, ZoneTypeParams>;
} = {
  config: null,
  zoneParamsMap: {
    angle: { ...DEFAULT_ZONE_PARAMS.angle },
    radius: { ...DEFAULT_ZONE_PARAMS.radius },
    forward_line: { ...DEFAULT_ZONE_PARAMS.forward_line },
    shrapnel: { ...DEFAULT_ZONE_PARAMS.shrapnel },
  },
};

export function createDefaultWeapons(): WeaponConfig[] {
  const weapons: WeaponConfig[] = [
    {
      id: `weapon_forward_line_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Прямая линия',
      prepTime: 0.2,
      recoveryTime: 0.3,
      prepTurnSlow: 0.5,
      recoveryTurnSlow: 0.8,
      prepMoveSlow: 0.5,
      recoveryMoveSlow: 0.8,
      baseDamage: 25,
      minMultiplier: 0.8,
      maxMultiplier: 1.2,
      critChance: 0.15,
      critMultiplier: 2.0,
      zone: {
        hitZoneType: 'forward_line',
        length: 150,
      },
      invWeight: 1,
      radius: 16,
      isSolid: true,
    },
    {
      id: `weapon_angle_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Сектор',
      prepTime: 0.25,
      recoveryTime: 0.35,
      prepTurnSlow: 0.4,
      recoveryTurnSlow: 0.7,
      prepMoveSlow: 0.4,
      recoveryMoveSlow: 0.7,
      baseDamage: 20,
      minMultiplier: 0.9,
      maxMultiplier: 1.1,
      critChance: 0.1,
      critMultiplier: 1.8,
      zone: {
        hitZoneType: 'angle',
        length: 100,
        angle: Math.PI / 6,
      },
      invWeight: 1,
      radius: 16,
      isSolid: true,
    },
    {
      id: `weapon_radius_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Аура',
      prepTime: 0.3,
      recoveryTime: 0.4,
      prepTurnSlow: 0.6,
      recoveryTurnSlow: 0.9,
      prepMoveSlow: 0.6,
      recoveryMoveSlow: 0.9,
      baseDamage: 30,
      minMultiplier: 0.8,
      maxMultiplier: 1.3,
      critChance: 0.1,
      critMultiplier: 2.5,
      zone: {
        hitZoneType: 'radius',
        radius: 50,
      },
      invWeight: 1,
      radius: 16,
      isSolid: true,
    },
    {
      id: `weapon_shrapnel_${Math.random().toString(36).substring(2, 6)}`,
      name: 'Шрапнель',
      prepTime: 0.4,
      recoveryTime: 0.5,
      prepTurnSlow: 0.3,
      recoveryTurnSlow: 0.6,
      prepMoveSlow: 0.3,
      recoveryMoveSlow: 0.6,
      baseDamage: 15,
      minMultiplier: 0.7,
      maxMultiplier: 1.5,
      critChance: 0.25,
      critMultiplier: 2.0,
      zone: {
        hitZoneType: 'shrapnel',
        length: 120,
        angle: Math.PI / 3,
        rayCount: 5,
      },
      invWeight: 1,
      radius: 16,
      isSolid: true,
    },
  ];

  for (let i = weapons.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [weapons[i], weapons[j]] = [weapons[j], weapons[i]];
  }

  return weapons;
}

export function createRandomWeaponItem(): ItemData {
  const allWeapons = createDefaultWeapons();
  const w = allWeapons[0];
  return {
    id: w.id,
    name: w.name,
    type: 'weapon',
    maxStack: 1,
    config: w,
  };
}