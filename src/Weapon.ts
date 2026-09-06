import { HitZoneType, HitZoneConfig, WeaponCombatConfig, StandardRadius } from './ecs/types';
import { deg2Rad, Radians } from './utils';

export const HIT_ZONE_LABELS: Record<HitZoneType, string> = {
  angle: 'Сектор',
  radius: 'Аура',
  forward_line: 'Прямая линия',
  shrapnel: 'Шрапнель',
};

export interface ZoneTypeParams {
  length: number;
  radius: number;
  angle: Radians;
  rayCount: number;
  pierceObstacles: boolean;
  piercePlayers: boolean;
  pierceBots: boolean;
}

export const DEFAULT_ZONE_PARAMS: Record<HitZoneType, ZoneTypeParams> = {
  angle: {
    length: 100,
    radius: 50,
    angle: deg2Rad(30),
    rayCount: 5,
    pierceObstacles: false,
    piercePlayers: false,
    pierceBots: false,
  },
  radius: {
    length: 100,
    radius: 50,
    angle: deg2Rad(30),
    rayCount: 5,
    pierceObstacles: false,
    piercePlayers: false,
    pierceBots: false,
  },
  forward_line: {
    length: 150,
    radius: 50,
    angle: deg2Rad(30),
    rayCount: 5,
    pierceObstacles: false,
    piercePlayers: false,
    pierceBots: false,
  },
  shrapnel: {
    length: 120,
    radius: 50,
    angle: deg2Rad(60),
    rayCount: 5,
    pierceObstacles: false,
    piercePlayers: false,
    pierceBots: false,
  },
};

export interface WeaponPreset {
  name: string;
  weight: number;
  radius: StandardRadius;
  isSolid: boolean;
  combat: WeaponCombatConfig;
  zone: HitZoneConfig;
}

export function createDefaultWeaponPresets(): WeaponPreset[] {
  const presets: WeaponPreset[] = [
    {
      name: 'Прямая линия',
      weight: 1,
      radius: 16,
      isSolid: true,
      combat: {
        baseDamage: 25,
        prepTime: 0.2,
        castTime: 0,
        recoveryTime: 0.3,
        prepTurnSlow: 0.5,
        recoveryTurnSlow: 0.8,
        prepMoveSlow: 0.5,
        recoveryMoveSlow: 0.8,
        castMoveSlow: 0.5,
        minMultiplier: 0.8,
        maxMultiplier: 1.2,
        critChance: 0.15,
        critMultiplier: 2.0,
      },
      zone: {
        hitZoneType: 'forward_line',
        length: 150,
      },
    },
    {
      name: 'Сектор',
      weight: 1,
      radius: 16,
      isSolid: true,
      combat: {
        baseDamage: 20,
        prepTime: 0.25,
        castTime: 0,
        recoveryTime: 0.35,
        prepTurnSlow: 0.4,
        recoveryTurnSlow: 0.7,
        prepMoveSlow: 0.4,
        recoveryMoveSlow: 0.7,
        castMoveSlow: 0.4,
        minMultiplier: 0.9,
        maxMultiplier: 1.1,
        critChance: 0.1,
        critMultiplier: 1.8,
      },
      zone: {
        hitZoneType: 'angle',
        length: 100,
        angle: deg2Rad(30),
      },
    },
    {
      name: 'Аура',
      weight: 1,
      radius: 16,
      isSolid: true,
      combat: {
        baseDamage: 30,
        prepTime: 0.3,
        castTime: 0,
        recoveryTime: 0.4,
        prepTurnSlow: 0.6,
        recoveryTurnSlow: 0.9,
        prepMoveSlow: 0.6,
        recoveryMoveSlow: 0.9,
        castMoveSlow: 0.6,
        minMultiplier: 0.8,
        maxMultiplier: 1.3,
        critChance: 0.1,
        critMultiplier: 2.5,
      },
      zone: {
        hitZoneType: 'radius',
        radius: 50,
      },
    },
    {
      name: 'Шрапнель',
      weight: 1,
      radius: 16,
      isSolid: true,
      combat: {
        baseDamage: 15,
        prepTime: 0.4,
        castTime: 0,
        recoveryTime: 0.5,
        prepTurnSlow: 0.3,
        recoveryTurnSlow: 0.6,
        prepMoveSlow: 0.3,
        recoveryMoveSlow: 0.6,
        castMoveSlow: 0.3,
        minMultiplier: 0.7,
        maxMultiplier: 1.5,
        critChance: 0.25,
        critMultiplier: 2.0,
      },
      zone: {
        hitZoneType: 'shrapnel',
        length: 120,
        angle: deg2Rad(60),
        rayCount: 5,
      },
    },
  ];

  for (let i = presets.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [presets[i], presets[j]] = [presets[j], presets[i]];
  }

  return presets;
}

export function createRandomWeaponPreset(): WeaponPreset {
  const all = createDefaultWeaponPresets();
  return all[0];
}