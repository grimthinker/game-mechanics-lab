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
  mass: number;
  isStatic: boolean;
}

export interface StatValue {
  base: number;
  current: number;
}

export interface StatsComponent {
  hp: StatValue;
  maxHp: StatValue;
  maxSpeed: StatValue;
  maxTurnSpeed: StatValue;
  stealth: StatValue;
  runSpeedMultiplier: StatValue;
  runTurnMultiplier: StatValue;
  crouchSpeedMultiplier: StatValue;
  crouchTurnMultiplier: StatValue;
  crouchStealthMultiplier: StatValue;
  interactionRange: StatValue;
}

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

// Карта соответствия типа предмета и его интерфейса конфига
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
    config?: ItemConfigMap[K]; // Конфиг автоматически подстроится под тип K
  };
}[T];

export interface InventorySlot {
  item: ItemData | null;
  count: number;
}

export interface InventoryComponent {
  size: InventorySize;
  slots: InventorySlot[][];
}

export type EquipSlotType = 'armor' | 'bag' | 'weapon';

export interface EquipSlot {
  type: EquipSlotType;
  item: ItemData | null;
}

export interface EquipComponent {
  slots: EquipSlot[];
}

export interface ActiveAttackComponent {
  attacks: ActiveAttack[];
}

export interface CreatureMetaComponent {
  id: string;
  type: CreatureType;
  state: CreatureState;
}

export interface ItemComponent {
  id: string;
  name: string;
  type: ItemType;
  config?: WeaponConfig | ItemConfig | ArmorConfig | InventoryConfig;
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
}

export type CreatureType = 'player' | 'ai';

export const STANDARD_RADII = [8, 16, 24, 32] as const;
export type StandardRadius = (typeof STANDARD_RADII)[number];

export type CreatureState = 'idle' | 'moving' | 'running' | 'crouching' | 'attacking' | 'dead';

export type HitZoneType = 'radius' | 'angle' | 'line' | 'shrapnel' | 'forward_line' | 'offset_radius';

export type InventorySize = {
  width: number;
  height: number;
}

export interface ItemConfig {
    id: string;
    name: string;
    invWeight: number;
    radius: number;
    maxStack?: number;
}

export interface InventoryConfig extends ItemConfig {
  size: InventorySize
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
  offsetDistance?: number;
  pierceObstacles?: boolean;
  piercePlayers?: boolean;
  pierceBots?: boolean;
}

export interface WeaponConfig extends ItemConfig {
  prepTime: number;
  castTime?: number; // Задержка перед нанесением урона, в течение которой нельзя поворачиваться
  recoveryTime: number;
  prepTurnSlow: number;
  recoveryTurnSlow: number;
  prepMoveSlow: number;
  recoveryMoveSlow: number;
  castMoveSlow?: number; // Замедление перемещения во время каста (по умолчанию равно prepMoveSlow)
  baseDamage: number;
  minMultiplier: number;
  maxMultiplier: number;
  critChance: number;
  critMultiplier: number;
  zone: HitZoneConfig;
}

export interface ActiveAttack {
  weapon: WeaponConfig;
  phase: 'prep' | 'cast' | 'recovery';
  timer: number;
  totalDuration: number;
}

export interface CreatureConfig {
  id: string;
  type: CreatureType;
  position: Point;
  radius: number;
  mass: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  maxHp?: number;
  hp?: number;
  stealth?: number;
  baseStealth?: number;
  weapons?: WeaponConfig[];
  runSpeedMultiplier?: number;
  crouchSpeedMultiplier?: number;
  crouchStealthMultiplier?: number;
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
    look_in_dir: (angle: number) => boolean;
    look_at_pos: (target_pos: Point) => boolean;
    attack: (id_target?: string) => boolean;
    getPos: () => Point;
  }