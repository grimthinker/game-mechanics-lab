import { Circle } from 'detect-collisions';
import { Point } from '../types';
import { BTLogicComponent } from '../ai/core';

export type EntityId = string;

export interface TransformComponent {
  x: number;
  y: number;
  angle: number;
}

export interface PhysicsBodyComponent {
  body: Circle;
  radius: StandardRadius;
  weight: number;
  isStatic: boolean;
}

export interface StatValue<T = number> {
  base: T;
  current: T;
}

export type StatsComponent = {
  [K in keyof Required<CreatureConfig>]: StatValue<Required<CreatureConfig>[K]>;
};

export interface VelocityComponent {
  currentSpeed: number;
  currentTurnSpeed: number;
}

export interface InputComponent {
  isMovingForward: boolean;
  turnDirection: -1 | 0 | 1;
  turnSpeed: number;
  isRunning: boolean;
  isCrouching: boolean;
  wantsAttack: boolean;
}

export interface HealthComponent {
  isAlive: boolean;
  hitFlashTimer: number;
}

export interface StealthComponent {
  isCrouching: boolean;
}

export type ItemType = 'weapon' | 'armor' | 'bag' | 'resource' | 'other';

type ItemConfigMap = {
  weapon: WeaponConfig;
  armor: ArmorConfig;
  bag: InventoryConfig;
  resource: ItemConfig;
  other: ItemConfig;
};

export type ItemData<T extends ItemType = ItemType> = {
  [K in T]: {
    id: string;
    name: string;
    type: K;
    maxStack: number;
    config: ItemConfigMap[K];
  };
}[T];

export interface InventorySlot {
  itemId: EntityId | null;
  count: number;
}

export interface InventoryComponent {
  size: InventorySize;
  slots: InventorySlot[][];
}

export type EquipSlotType = 'armor' | 'bag' | 'weapon';

export interface EquipSlot {
  type: EquipSlotType;
  itemId: EntityId | null;
}

export interface EquipComponent {
  slots: EquipSlot[];
}

export interface ActiveAttackComponent {
  attacks: ActiveAttack[];
}

export interface CreatureMetaComponent {
  id: string;
  state: CreatureState;
  config: CreatureConfig;
}

export type ItemComponent = ItemData;

export interface OwnershipComponent {
  ownerId: EntityId;
  status: 'equipped' | 'inventory';
}

export interface EntityComponents {
  transform?: TransformComponent;
  physicsBody?: PhysicsBodyComponent;
  velocity?: VelocityComponent;
  input?: InputComponent;
  health?: HealthComponent;
  stealth?: StealthComponent;
  stats?: StatsComponent;
  brain?: BTLogicComponent;
  inventory?: InventoryComponent;
  equip?: EquipComponent;
  activeAttacks?: ActiveAttackComponent;
  item?: ItemComponent;
  meta?: CreatureMetaComponent;
  ownership?: OwnershipComponent;
}

export const STANDARD_RADII = [8, 16, 24, 32] as const;
export type StandardRadius = (typeof STANDARD_RADII)[number];

export type CreatureState = 'idle' | 'moving' | 'running' | 'crouching' | 'attacking' | 'dead';

export type HitZoneType = 'radius' | 'angle' | 'forward_line' | 'shrapnel';

export type InventorySize = {
  width: number;
  height: number;
};

export interface CoreStatsConfig {
  radius: StandardRadius;
  weight: number;
  isSolid?: boolean;
}

export interface ItemConfig extends CoreStatsConfig {
  id: string;
  name: string;
  maxStack?: number;
}

export interface InventoryConfig extends ItemConfig {
  size: InventorySize;
}

export interface ArmorConfig extends ItemConfig {
  defense: number;
  flat_reduction: number;
}

export type HitZoneConfig = {
  hitZoneType: HitZoneType;
  radius?: number;
  angle?: number;
  length?: number;
  rayCount?: number;
  pierceObstacles?: boolean;
  piercePlayers?: boolean;
  pierceBots?: boolean;
};

export interface WeaponConfig extends ItemConfig {
  prepTime: number;
  castTime?: number;
  recoveryTime: number;
  prepTurnSlow: number;
  recoveryTurnSlow: number;
  prepMoveSlow: number;
  recoveryMoveSlow: number;
  castMoveSlow?: number;
  baseDamage: number;
  minMultiplier: number;
  maxMultiplier: number;
  critChance: number;
  critMultiplier: number;
  zone: HitZoneConfig;
}

export interface CreatureConfig extends CoreStatsConfig {
  behavior: string;
  maxSpeed: number;
  maxTurnSpeed: number;
  maxHp: number;
  hp?: number;
  stealth?: number;
  runSpeedMultiplier?: number;
  crouchSpeedMultiplier?: number;
  crouchStealthMultiplier?: number;
  runTurnMultiplier?: number;
  crouchTurnMultiplier?: number;
}

export interface ActiveAttack {
  weapon: WeaponConfig;
  phase: 'prep' | 'cast' | 'recovery';
  timer: number;
  totalDuration: number;
}

export interface IMovable {
  startMovingForward(): void;
  stopMovingForward(): void;
  startTurning(direction: -1 | 1, amount: number): void;
  stopTurning(): void;
  startRunning(): void;
  stopRunning(): void;
  startCrouching(): void;
  stopCrouching(): void;
}

export interface EntityController {
  stop: () => boolean;
  attack: (id_target?: string) => boolean;
  getPos: () => Point;
}