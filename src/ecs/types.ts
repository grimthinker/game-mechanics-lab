import { Body, Circle, Polygon } from 'detect-collisions';
import { Point } from '../types';
import { BehaviorStatsConfig, BTLogicComponent } from '../ai/core';
import { Radians } from '../utils';
import { t } from '../locales';

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
  body: Body;
  isStatic: boolean;
  category: number;
  mask: number;
  isTrigger?: boolean;
}

export type EntityArchetype =
  'creature' | 'item' | 'projectile' | 'zone' | 'marker' | 'particles' | 'obstacle' | 'bodyPart';

export type SocketType = string;

export interface SocketDef {
  type: SocketType;
  size: number;
  maxChildSize?: number;
  strength: number;
}

export interface SocketDefComponent {
  sockets: Record<string, SocketDef>;
}

export interface SocketLink {
  targetEntityId: string;
  targetSocketId: string;
  currentStrength: number;
  maxStrength: StatValue<number>;
  socketSize: number;
}

export interface SocketLinkComponent {
  links: Record<string, SocketLink>;
}

export interface BrainComponent {
  power: number;
  isActive: boolean;
  rootEntityId?: string;
}

export interface AssemblyRootComponent {
  rootPartId: string;
  partIds: string[];
}

export interface LocomotionComponent {}

export const enum ConsciousnessState {
  CONSCIOUS = 'CONSCIOUS',
  UNCONSCIOUS = 'UNCONSCIOUS',
  DEAD = 'DEAD',
}

export interface ConsciousnessComponent {
  state: ConsciousnessState;
}

export interface LocomotionStateComponent {
  speedMult: number;
  turnMult: number;
  canSprint: boolean;
  forceProneOnMove: boolean;
  canStand: boolean;
  intactLegs: number;
  brokenLegs: number;
  destroyedLegs: number;
}

export interface HeartComponent {
  requiresBrain: boolean;
}

export interface VisionStatsComponent {
  fovAngle: StatValue<number>;
  clarity: StatValue<number>;
  maxDistance: StatValue<number>;
}

export interface HearingStatsComponent {
  sensitivity: StatValue<number>;
  maxDistance: StatValue<number>;
}

export interface PerceptionComponent {
  visionFovAngle: number;
  visionClarity: number;
  visionMaxDistance: number;
  hearingSensitivity: number;
  hearingMaxDistance: number;
}

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

export interface RenderPolygonPrimitive {
  kind: 'polygon';
  points: Point[];
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
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
  | RenderPolygonPrimitive
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

export type ZoneEffectType = 'damage' | 'heal' | 'repel' | 'attract' | 'time_dilation';

export interface AreaEffectorComponent {
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
  color?: string;
  icon?: string;
  radius?: number;
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
  vx: number;
  vy: number;
  currentSpeed: number;
  currentTurnSpeed: Radians;
  externalVx?: number;
  externalVy?: number;
}

export interface InputComponent {
  desiredMoveVector: { x: number; y: number } | null;
  moveForward?: -1 | 0 | 1;
  moveStrafe?: -1 | 0 | 1;
  targetLookAngle?: Radians;
  isMovingForward: boolean;
  turnDirection: -1 | 0 | 1;
  turnRatio: number;
  isRunning: boolean;
  isCrouching: boolean;
  isSlowWalking: boolean;
  wantsAttack: boolean;
  attackSlotIndex?: number;
  desiredStance?: BaseCreatureStance;
}

export interface HealthComponent {
  current: number;
  max: StatValue<number>;
  isAlive: boolean;
  destructible: boolean;
  hitFlashTimer: number;
  healFlashTimer?: number;
  healthBarTimer?: number;
}

export interface FunctionalHealthComponent {
  current: number;
  max: StatValue<number>;
  isFunctional: boolean;
}

export type ItemType = 'weapon' | 'armor' | 'bag' | 'bodyPart';

export interface ItemData {
  name: string;
  type: ItemType;
  maxStack: number;
  size: number;
  equipTypes: string[];
  equippable: boolean;
  equipTimeMultiplier: number;
}

export interface InventorySlot {
  itemId: EntityId | null;
  count: number;
}

export interface InventoryComponent {
  size: InventorySize;
  slots: InventorySlot[][];
}

export interface InteractionSlot {
  id: string;
  interactDist: number;
  strength: number;
  itemId: EntityId | null;
}

export const STANDARD_EQUIPMENT_AREA_TYPES = [
  'head',
  'neck',
  'torso',
  'hands',
  'legs',
  'feet',
  'waist',
  'belt_slot',
  'sheath',
  'holster',
  'sling',
  'pouch',
] as const;

export type StandardEquipmentAreaType = (typeof STANDARD_EQUIPMENT_AREA_TYPES)[number];

export const EQUIPMENT_AREA_TYPE_LABELS: Record<string, string> = {
  get head() {
    return t('equipmentAreas.head');
  },
  get neck() {
    return t('equipmentAreas.neck');
  },
  get torso() {
    return t('equipmentAreas.torso');
  },
  get hands() {
    return t('equipmentAreas.hands');
  },
  get legs() {
    return t('equipmentAreas.legs');
  },
  get feet() {
    return t('equipmentAreas.feet');
  },
  get waist() {
    return t('equipmentAreas.waist');
  },
  get belt_slot() {
    return t('equipmentAreas.belt_slot');
  },
  get sheath() {
    return t('equipmentAreas.sheath');
  },
  get holster() {
    return t('equipmentAreas.holster');
  },
  get sling() {
    return t('equipmentAreas.sling');
  },
  get pouch() {
    return t('equipmentAreas.pouch');
  },
};

export interface EquipmentArea {
  id: string;
  name: string;
  type: string;
  space: number;
  itemIds: EntityId[];
}

export interface EquipmentComponent {
  equipmentAreas: EquipmentArea[];
}

export type InteractionSlotsComponent = InteractionSlot;

export type InteractionPhase = 'reach' | 'lift' | 'abort_reach' | 'abort_lift';

export interface InteractionActionComponent {
  type: 'pickup' | 'equip' | 'unequip';
  targetId?: string;
  slotIndex?: number;
  partId?: string;
  areaId?: string;
  containerId?: EntityId;
  timer: number;
  totalDuration: number;
  phase?: InteractionPhase;
  targetItemPos?: Point;
  elapsedInReach?: number;
  wantsCancel?: boolean;
  relativeDist?: number;
  relativeAngle?: Radians;
  abortStartProgress?: number;
}

export interface PickupIntentComponent {
  targetItemId: EntityId;
}

export interface ActiveAttackComponent {
  attacks: ActiveAttack[];
}

export type BaseCreatureStance = 'standing' | 'crouching' | 'prone';

export type TransitionCreatureStance =
  | 'stand_to_crouch'
  | 'crouch_to_stand'
  | 'crouch_to_prone'
  | 'prone_to_crouch'
  | 'stand_to_prone'
  | 'prone_to_stand';

export type CreatureStance = BaseCreatureStance | TransitionCreatureStance;

export interface StanceTransitionComponent {
  fromStance: BaseCreatureStance;
  toStance: BaseCreatureStance;
  timer: number;
  totalDuration: number;
  transitionStance: TransitionCreatureStance;
}

export type CreatureMovementMode = 'immobile' | 'turning' | 'walking' | 'jogging' | 'sprinting';

export type CreatureDirectionMode = 'forward' | 'strafe' | 'backward' | 'immobile';

export type CreatureActionMode = 'idle' | 'attacking' | 'pickup' | 'equipping' | 'stance_changing';

export interface CreatureMetaComponent {
  name: string;
  stance?: CreatureStance;
  movementMode?: CreatureMovementMode;
  directionMode?: CreatureDirectionMode;
  actionMode?: CreatureActionMode;
  entityType?: string;
  destructible?: boolean;
}

export type ItemComponent = ItemData;

export interface OwnershipComponent {
  ownerId: EntityId;
  status: 'equipped' | 'inventory';
}

export interface EntityComponents {
  tag?: TagComponent;
  renderable?: RenderableComponent;
  areaEffector?: AreaEffectorComponent;
  attachment?: AttachmentComponent;
  transform?: TransformComponent;
  physicsBody?: PhysicsBodyComponent;
  velocity?: VelocityComponent;
  input?: InputComponent;
  health?: HealthComponent;
  functionalHealth?: FunctionalHealthComponent;
  physicsStats?: PhysicsStatsComponent;
  movementStats?: MovementStatsComponent;
  stealthStats?: StealthStatsComponent;
  aiStats?: AIStatsComponent;
  brain?: BTLogicComponent;
  inventory?: InventoryComponent;
  equip?: EquipmentComponent;
  interactionSlots?: InteractionSlotsComponent;
  interactionAction?: InteractionActionComponent;
  stanceTransition?: StanceTransitionComponent;
  pickupIntent?: PickupIntentComponent;
  activeAttacks?: ActiveAttackComponent;
  item?: ItemComponent;
  meta?: CreatureMetaComponent;
  ownership?: OwnershipComponent;
  gizmo?: GizmoComponent;
  weaponStats?: WeaponStatsComponent;
  weaponZone?: HitZoneConfig;
  armorStats?: ArmorStatsComponent;
  timeScale?: TimeScaleComponent;
  socketDef?: SocketDefComponent;
  socketLink?: SocketLinkComponent;
  bodyBrain?: BrainComponent;
  assemblyRoot?: AssemblyRootComponent;
  locomotion?: LocomotionComponent;
  heart?: HeartComponent;
  vision?: VisionStatsComponent;
  hearing?: HearingStatsComponent;
  perception?: PerceptionComponent;
  consciousness?: ConsciousnessComponent;
  locomotionState?: LocomotionStateComponent;
}

export const SERIALIZABLE_COMPONENT_KEYS: ReadonlyArray<keyof EntityComponents> = [
  'tag',
  'renderable',
  'areaEffector',
  'attachment',
  'health',
  'functionalHealth',
  'transform',
  'physicsStats',
  'movementStats',
  'stealthStats',
  'aiStats',
  'item',
  'inventory',
  'equip',
  'interactionSlots',
  'interactionAction',
  'stanceTransition',
  'meta',
  'ownership',
  'gizmo',
  'weaponStats',
  'weaponZone',
  'armorStats',
  'velocity',
  'activeAttacks',
  'input',
  'timeScale',
  'socketDef',
  'socketLink',
  'bodyBrain',
  'assemblyRoot',
  'locomotion',
  'heart',
  'vision',
  'hearing',
  'perception',
  'consciousness',
  'locomotionState',
] as const;
export const STANDARD_RADII = [8, 16, 24, 32] as const;
export type StandardRadius = (typeof STANDARD_RADII)[number];

export function isValidStandardRadius(radius: number): radius is StandardRadius {
  return (STANDARD_RADII as readonly number[]).includes(radius);
}

export type HitZoneType = 'radius' | 'angle' | 'forward_line' | 'shrapnel';

export type InventorySize = {
  width: number;
  height: number;
};

export interface PhysicsConfig {
  radius: number;
  weight: number;
  size?: number;
  isSolid?: boolean;
  points?: Point[];
}

export interface PhysicsStatsComponent {
  radius: StatValue<number>;
  weight: StatValue<number>;
  size?: number;
  isSolid: boolean;
  points?: Point[];
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
  destructible?: boolean;
}

export interface FunctionalHealthConfig {
  maxHp: number;
  hp?: number;
}

export interface MovementConfig {
  maxSpeed: number;
  maxTurnSpeed: Radians;
  runSpeedMultiplier?: number;
  crouchSpeedMultiplier?: number;
  proneSpeedMultiplier?: number;
  walkSpeedMultiplier?: number;
  runTurnMultiplier?: number;
  crouchTurnMultiplier?: number;
  proneTurnMultiplier?: number;
  walkTurnMultiplier?: number;
  turnInPlaceTurnMultiplier?: number;
  strafeSpeedMultiplier?: number;
  backwardSpeedMultiplier?: number;
  strafeTurnMultiplier?: number;
  backwardTurnMultiplier?: number;
  pickupSpeedMultiplier?: number;
  pickupTurnMultiplier?: number;
  standToCrouchTime?: number;
  crouchToStandTime?: number;
  standToProneTime?: number;
  proneToStandTime?: number;
  crouchToProneTime?: number;
  proneToCrouchTime?: number;
}

export interface MovementStatsComponent {
  maxSpeed: StatValue<number>;
  maxTurnSpeed: StatValue<number>;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  proneSpeedMultiplier: number;
  walkSpeedMultiplier: number;
  runTurnMultiplier: number;
  crouchTurnMultiplier: number;
  proneTurnMultiplier: number;
  walkTurnMultiplier: number;
  turnInPlaceTurnMultiplier: number;
  strafeSpeedMultiplier: number;
  backwardSpeedMultiplier: number;
  strafeTurnMultiplier: number;
  backwardTurnMultiplier: number;
  pickupSpeedMultiplier: number;
  pickupTurnMultiplier: number;
  standToCrouchTime: StatValue<number>;
  crouchToStandTime: StatValue<number>;
  standToProneTime: StatValue<number>;
  proneToStandTime: StatValue<number>;
  crouchToProneTime: StatValue<number>;
  proneToCrouchTime: StatValue<number>;
}

export interface StealthConfig {
  stealthPower: number;
  runStealthMultiplier: number;
  crouchStealthMultiplier?: number;
  proneStealthMultiplier?: number;
  walkStealthMultiplier?: number;
  turnInPlaceStealthMultiplier?: number;
  immobileStealthMultiplier?: number;
}

export interface StealthStatsComponent {
  stealthPower: StatValue<number>;
  runStealthMultiplier: number;
  crouchStealthMultiplier: number;
  proneStealthMultiplier: number;
  walkStealthMultiplier: number;
  turnInPlaceStealthMultiplier: number;
  immobileStealthMultiplier: number;
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

export interface TimeScaleComponent {
  multiplier: StatValue<number>;
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

export interface VisionConfig {
  fovAngle: number;
  clarity: number;
  maxDistance: number;
}

export interface HearingConfig {
  sensitivity: number;
  maxDistance: number;
}

export interface EntityConfig {
  tag?: TagComponent;
  renderable?: RenderableComponent;
  areaEffector?: AreaEffectorComponent;
  attachment?: AttachmentComponent;
  gizmo?: GizmoComponent;
  physics?: PhysicsConfig;
  health?: HealthConfig;
  functionalHealth?: FunctionalHealthConfig;
  movement?: MovementConfig;
  stealth?: StealthConfig;
  ai?: AIConfig;
  item?: ItemData;
  inventory?: InventorySetup;
  equip?: EquipmentComponent;
  interactionSlots?: InteractionSlotsComponent;
  meta?: CreatureMetaComponent;
  ownership?: OwnershipComponent;
  transform?: TransformComponent;
  weaponStats?: Partial<WeaponCombatConfig>;
  weaponZone?: HitZoneConfig;
  armorStats?: Partial<ArmorCombatConfig>;
  timeScale?: TimeScaleComponent;
  socketDef?: SocketDefComponent;
  socketLink?: SocketLinkComponent;
  bodyBrain?: BrainComponent;
  assemblyRoot?: AssemblyRootComponent;
  locomotion?: LocomotionComponent;
  heart?: HeartComponent;
  vision?: VisionConfig;
  hearing?: HearingConfig;
  perception?: PerceptionComponent;
}

export interface ActiveAttack {
  weaponId: EntityId;
  slotIndex: number;
  partId?: string;
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
  attack: (targetId?: string) => boolean;
  getPos: () => Point;
}
