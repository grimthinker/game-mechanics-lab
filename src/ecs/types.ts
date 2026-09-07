import { Circle } from 'detect-collisions';
import { Point } from '../types';
import { BehaviorStatsConfig, BTLogicComponent } from '../ai/core';
import { Radians } from '../utils';

export type EntityId = string;

export interface TransformComponent {
  x: number;
  y: number;
  angle: Radians;
}

export const enum CollisionCategory {
  NONE = 0,
  OBSTACLE = 1 << 0, // 1
  CREATURE = 1 << 1, // 2
  ITEM = 1 << 2, // 4
  PROJECTILE = 1 << 3, // 8
  TRIGGER_ZONE = 1 << 4, // 16
  PARTICLE = 1 << 5, // 32
}

export const COLLISION_MASK_PHYSICAL =
  CollisionCategory.OBSTACLE | CollisionCategory.CREATURE | CollisionCategory.ITEM;

export const COLLISION_MASK_ALL =
  CollisionCategory.OBSTACLE |
  CollisionCategory.CREATURE |
  CollisionCategory.ITEM |
  CollisionCategory.PROJECTILE |
  CollisionCategory.TRIGGER_ZONE |
  CollisionCategory.PARTICLE;

export const COLLISION_MASK_NONE = 0;

export interface PhysicsBodyComponent {
  body: Circle;
  isStatic: boolean;
  category: number;
  mask: number;
  isTrigger?: boolean;
}

export type EntityArchetype = 'creature' | 'item' | 'projectile' | 'zone' | 'marker' | 'particles';

export interface TagComponent {
  archetype: EntityArchetype;
  subType?: string;
}

export interface RenderCirclePrimitive {
  kind: 'circle';
  radius: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
}

export interface RenderRectPrimitive {
  kind: 'rect';
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
}

export interface RenderLinePrimitive {
  kind: 'line';
  from: Point;
  to: Point;
  stroke: string;
  strokeWidth?: number;
  dash?: number[];
}

export interface RenderArcPrimitive {
  kind: 'arc';
  radius: number;
  startAngle: number;
  endAngle: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  closed?: boolean;
}

export interface RenderTextPrimitive {
  kind: 'text';
  text: string;
  offset?: Point;
  font?: string;
  fill: string;
  ignoreRotation?: boolean;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
}

export type RenderPrimitive =
  | RenderCirclePrimitive
  | RenderRectPrimitive
  | RenderLinePrimitive
  | RenderArcPrimitive
  | RenderTextPrimitive;

export const RENDER_Z_INDEX = {
  ZONES: 0,
  OBSTACLES: 5,
  ITEMS: 10,
  CORPSES: 20,
  PROJECTILES: 30,
  CREATURES: 40,
  ATTACKS: 50,
  PARTICLES: 60,
  GIZMOS: 90,
  UI: 100,
} as const;

export interface RenderableComponent {
  zIndex: number;
  primitives: RenderPrimitive[];
  isVisible: boolean;
  syncWithTransform?: boolean;
}

export type ZoneEffectType = 'damage' | 'heal' | 'repel' | 'attract';

export interface ZoneTriggerComponent {
  effect: ZoneEffectType;
  valuePerSec: number;
  radius: number;
  ignoreParent?: boolean;
  destroyOnParentDeath?: boolean;
  destroyOnParentRemoval?: boolean;
  distanceAttenuation?: boolean;
  centerValue?: number;
  boundaryValue?: number;
}

export interface AttachmentComponent {
  parentId: EntityId;
  offsetX?: number;
  offsetY?: number;
}

export interface GizmoComponent {
  type: 'spawner' | 'waypoint' | 'trigger' | 'sound' | 'marker';
  color?: string; // Цвет отрисовки в редакторе (например, '#e67e22')
  icon?: string; // Иконка (например, '🚩', '🔊', '⚙️', '📍')
  radius?: number; // Радиус кликабельной зоны в редакторе (по умолчанию, например, 14px)
}

export const enum ModifierType {
  FLAT = 'flat',
  PERCENT_ADD = 'percent_add',
  PERCENT_MULT = 'percent_mult',
}

export interface StatModifier {
  id: string;
  type: ModifierType;
  value: number;
  duration?: number;
}

export interface StatValue<T = number> {
  base: T;
  current: T;
  modifiers?: StatModifier[];
}

export interface VelocityComponent {
  currentSpeed: number;
  currentTurnSpeed: Radians;
  externalVx?: number;
  externalVy?: number;
}

export interface InputComponent {
  isMovingForward: boolean;
  turnDirection: -1 | 0 | 1;
  turnRatio: number;
  isRunning: boolean;
  isCrouching: boolean;
  wantsAttack: boolean;
  attackSlotIndex?: number;
}

export interface HealthComponent {
  current: number;
  max: StatValue<number>;
  isAlive: boolean;
  hitFlashTimer: number;
  healFlashTimer?: number;
}

export type ItemType = 'weapon' | 'armor' | 'bag';

export interface ItemData {
  name: string;
  type: ItemType;
  maxStack: number;
}

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
  name: string;
  state: CreatureState;
  entityType?: string;
}

export type ItemComponent = ItemData;

export interface OwnershipComponent {
  ownerId: EntityId;
  status: 'equipped' | 'inventory';
}

export interface EntityComponents {
  tag?: TagComponent;
  renderable?: RenderableComponent;
  zoneTrigger?: ZoneTriggerComponent;
  attachment?: AttachmentComponent;
  transform?: TransformComponent;
  physicsBody?: PhysicsBodyComponent;
  velocity?: VelocityComponent;
  input?: InputComponent;
  health?: HealthComponent;
  physicsStats?: PhysicsStatsComponent;
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
  'tag',
  'renderable',
  'zoneTrigger',
  'attachment',
  'health',
  'transform',
  'physicsStats',
  'movementStats',
  'stealthStats',
  'aiStats',
  'item',
  'inventory',
  'equip',
  'meta',
  'ownership',
  'gizmo',
  'weaponStats',
  'weaponZone',
  'armorStats',
] as const;

export const STANDARD_RADII = [8, 16, 24, 32] as const;
export type StandardRadius = (typeof STANDARD_RADII)[number];

export function isValidStandardRadius(radius: number): radius is StandardRadius {
  return (STANDARD_RADII as readonly number[]).includes(radius);
}

export type CreatureState = 'idle' | 'moving' | 'running' | 'crouching' | 'attacking' | 'dead';

export type HitZoneType = 'radius' | 'angle' | 'forward_line' | 'shrapnel';

export type InventorySize = {
  width: number;
  height: number;
};

export interface PhysicsConfig {
  radius: number;
  weight: number;
  isSolid?: boolean;
}

export interface PhysicsStatsComponent {
  radius: StatValue<number>;
  weight: StatValue<number>;
  isSolid: boolean;
}

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

export interface HealthConfig {
  maxHp: number;
  hp?: number;
}

export interface MovementConfig {
  maxSpeed: number;
  maxTurnSpeed: Radians;
  runSpeedMultiplier?: number;
  crouchSpeedMultiplier?: number;
  runTurnMultiplier?: number;
  crouchTurnMultiplier?: number;
}

export interface MovementStatsComponent {
  maxSpeed: StatValue<number>;
  maxTurnSpeed: StatValue<number>;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  runTurnMultiplier: number;
  crouchTurnMultiplier: number;
}

export interface StealthConfig {
  stealthPower: number;
  runStealthMultiplier: number;
  crouchStealthMultiplier?: number;
}

export interface StealthStatsComponent {
  stealthPower: StatValue<number>;
  runStealthMultiplier: number;
  crouchStealthMultiplier: number;
}

export interface AIConfig {
  behavior: string;
  stats?: Partial<BehaviorStatsConfig>;
}

export interface ArmorCombatConfig {
  defense: number;
  flatReduction: number;
}

export interface ArmorStatsComponent {
  defense: StatValue<number>;
  flatReduction: StatValue<number>;
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

export interface AIStatsComponent {
  behavior: { base: string; current: string };
  stats?: Partial<BehaviorStatsConfig>;
}

export interface InventorySetup {
  size: InventorySize;
  slots?: InventorySlot[][];
}

export interface EntityConfig {
  tag?: TagComponent;
  renderable?: RenderableComponent;
  zoneTrigger?: ZoneTriggerComponent;
  attachment?: AttachmentComponent;
  gizmo?: GizmoComponent;
  physics?: PhysicsConfig;
  health?: HealthConfig;
  movement?: MovementConfig;
  stealth?: StealthConfig;
  ai?: AIConfig;
  item?: ItemData;
  inventory?: InventorySetup;
  equip?: EquipSlot[];
  meta?: { name?: string; entityType?: string };
  ownership?: OwnershipComponent;
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
