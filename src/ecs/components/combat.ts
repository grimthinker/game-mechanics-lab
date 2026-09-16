import { EntityId } from './base';
import { StatValue } from './stats';
import { Radians } from '../../utils';

export interface HealthComponent {
  current: number;
  max: StatValue<number>;
  isAlive: boolean;
  destructible: boolean;
  hitFlashTimer: number;
  healFlashTimer?: number;
  healthBarTimer?: number;
}

export interface HealthConfig {
  maxHp: number;
  hp?: number;
  destructible?: boolean;
}

export interface FunctionalHealthComponent {
  current: number;
  max: StatValue<number>;
  isFunctional: boolean;
}

export interface FunctionalHealthConfig {
  maxHp: number;
  hp?: number;
}

export interface ArmorCombatConfig {
  defense: number;
  flatReduction: number;
}

export interface ArmorStatsComponent {
  defense: StatValue<number>;
  flatReduction: StatValue<number>;
}

export type HitZoneType = 'radius' | 'angle' | 'forward_line' | 'shrapnel';

export type HitZoneConfig = {
  hitZoneType: HitZoneType;
  radius?: number;
  angle?: Radians;
  length?: number;
  rayCount?: number;
  pierceObstacles?: boolean;
  pierceCreatures?: boolean;
  pierceItems?: boolean;
};

export interface WeaponCombatConfig {
  baseDamage: number;
  prepTime: number;
  castTime: number;
  recoveryTime: number;
  prepTurnSlow: number;
  recoveryTurnSlow: number;
  prepMoveSlow: number;
  recoveryMoveSlow: number;
  castMoveSlow: number;
  minMultiplier: number;
  maxMultiplier: number;
  critChance: number;
  critMultiplier: number;
}

export interface WeaponStatsComponent {
  baseDamage: StatValue<number>;
  prepTime: StatValue<number>;
  castTime: StatValue<number>;
  recoveryTime: StatValue<number>;
  prepTurnSlow: number;
  recoveryTurnSlow: number;
  prepMoveSlow: number;
  recoveryMoveSlow: number;
  castMoveSlow: number;
  minMultiplier: number;
  maxMultiplier: number;
  critChance: number;
  critMultiplier: number;
}

export interface ActiveAttack {
  weaponId: EntityId;
  slotIndex: number;
  partId?: string;
  phase: 'prep' | 'cast' | 'recovery';
  timer: number;
  totalDuration: number;
}

export interface ActiveAttackComponent {
  attacks: ActiveAttack[];
}
