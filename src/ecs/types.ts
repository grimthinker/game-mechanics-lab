import { Circle } from 'detect-collisions';
import { Point } from '../types';
import { BTLogicComponent } from '../ai/core';

export type EntityId = string;

export interface TransformComponent {
  x: number;
  y: number;
  angle: number;
}

export const enum CollisionCategory {
  NONE = 0,
  OBSTACLE = 1 << 0, // 1
  CREATURE = 1 << 1, // 2
  ITEM = 1 << 2,     // 4
}

export const COLLISION_MASK_ALL =
  CollisionCategory.OBSTACLE | CollisionCategory.CREATURE | CollisionCategory.ITEM;
export const COLLISION_MASK_NONE = 0;

export interface PhysicsBodyComponent {
  body: Circle;
  isStatic: boolean;
  category: number;
  mask: number;
}

export interface GizmoComponent {
  type: 'spawner' | 'waypoint' | 'trigger' | 'sound' | 'marker';
  color?: string;       // Цвет отрисовки в редакторе (например, '#e67e22')
  icon?: string;        // Иконка (например, '🚩', '🔊', '⚙️', '📍')
  radius?: number;      // Радиус кликабельной зоны в редакторе (по умолчанию, например, 14px)
}

export interface StatValue<T = number> {
  base: T;
  current: T;
}

export type ComponentStats<T> = {
  [K in keyof Required<T>]: StatValue<Required<T>[K]>;
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
  attackSlotIndex?: number;
}

export interface HealthComponent {
  isAlive: boolean;
  hitFlashTimer: number;
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
  name: string;
  state: CreatureState;
}

export type ItemComponent = ItemData;

export interface OwnershipComponent {
  ownerId: EntityId;
  status: 'equipped' | 'inventory';
}

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

export type WeaponStatsComponent = ComponentStats<WeaponCombatConfig>;

export interface ArmorCombatConfig {
  defense: number;
  flatReduction: number;
}

export type ArmorStatsComponent = ComponentStats<ArmorCombatConfig>;

export interface EntityComponents {
  transform?: TransformComponent;
  physicsBody?: PhysicsBodyComponent;
  velocity?: VelocityComponent;
  input?: InputComponent;
  health?: HealthComponent;
  physicsStats?: PhysicsStatsComponent;
  healthStats?: HealthStatsComponent;
  movementStats?: MovementStatsComponent;
  stealthStats?: StealthStatsComponent;
  aiStats?: AIStatsComponent;
  brain?: BTLogicComponent;
  inventory?: InventoryComponent;
  equip?: EquipComponent;
  activeAttacks?: ActiveAttackComponent;
  item?: ItemComponent;
  meta?: CreatureMetaComponent;
  ownership?: OwnershipComponent;
  gizmo?: GizmoComponent;
  weaponStats?: WeaponStatsComponent;
  weaponZone?: HitZoneConfig;
  armorStats?: ArmorStatsComponent;
}

export const SERIALIZABLE_COMPONENT_KEYS: ReadonlyArray<keyof EntityComponents> = [
  'transform',
  'physicsStats',
  'healthStats',
  'movementStats',
  'stealthStats',
  'aiStats',
  'item',
  'inventory',
  'equip',
  'meta',
  'ownership',
  'health',
  'velocity',
  'input',
  'activeAttacks',
  'gizmo',
  'weaponStats',
  'weaponZone',
  'armorStats',
] as const;

export const STANDARD_RADII = [8, 16, 24, 32] as const;
export type StandardRadius = (typeof STANDARD_RADII)[number];

export type CreatureState = 'idle' | 'moving' | 'running' | 'crouching' | 'attacking' | 'dead';

export type HitZoneType = 'radius' | 'angle' | 'forward_line' | 'shrapnel';

export type InventorySize = {
  width: number;
  height: number;
};

export interface PhysicsConfig {
  radius: StandardRadius;
  weight: number;
  isSolid?: boolean;
}

export interface ItemConfig extends PhysicsConfig {
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

export interface HealthConfig {
  maxHp: number;
  hp?: number;
}
export interface MovementConfig {
  maxSpeed: number;
  maxTurnSpeed: number;
  runSpeedMultiplier?: number;
  crouchSpeedMultiplier?: number;
  runTurnMultiplier?: number;
  crouchTurnMultiplier?: number;
}
export interface StealthConfig {
  stealthPower: number;
  runStealthMultiplier: number;
  crouchStealthMultiplier?: number;
}
export interface AIConfig {
  behavior: string;
}

export type PhysicsStatsComponent = ComponentStats<PhysicsConfig>;
export type HealthStatsComponent = ComponentStats<HealthConfig>;
export type MovementStatsComponent = ComponentStats<MovementConfig>;
export type StealthStatsComponent = ComponentStats<StealthConfig>;
export type AIStatsComponent = ComponentStats<AIConfig>;

export interface InventorySetup {
  size: InventorySize;
  slots?: InventorySlot[][];
}

export interface EntityConfig {
  physics?: PhysicsConfig;
  health?: HealthConfig;
  movement?: MovementConfig;
  stealth?: StealthConfig;
  ai?: AIConfig;
  item?: ItemData;
  inventory?: InventorySetup;
  equip?: EquipSlot[];
  meta?: { id?: string; name?: string; entityType?: string };
  weaponStats?: Partial<WeaponCombatConfig>;
  weaponZone?: HitZoneConfig;
  armorStats?: Partial<ArmorCombatConfig>;
}

export interface ActiveAttack {
  weaponId: EntityId;
  slotIndex: number;
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