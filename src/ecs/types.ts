import { BTLogicComponent } from '../ai/core';
import { Point } from '../types';

export * from './components/base';
export * from './components/stats';
export * from './components/physics';
export * from './components/movement';
export * from './components/combat';
export * from './components/ai';
export * from './components/inventory';
export * from './components/anatomy';
export * from './components/rendering';

import {
  TagComponent,
  RenderableComponent,
  AreaEffectorComponent,
  AttachmentComponent,
  GizmoComponent,
  VisualModelComponent,
  AnimatorComponent,
} from './components/rendering';
import {
  TransformComponent,
  PhysicsBodyComponent,
  PhysicsStatsComponent,
  PhysicsConfig,
} from './components/physics';
import {
  VelocityComponent,
  InputComponent,
  StanceTransitionComponent,
  MovementStatsComponent,
  MovementConfig,
  StealthStatsComponent,
  StealthConfig,
} from './components/movement';
import {
  HealthComponent,
  HealthConfig,
  FunctionalHealthComponent,
  FunctionalHealthConfig,
  WeaponStatsComponent,
  WeaponCombatConfig,
  HitZoneConfig,
  ArmorStatsComponent,
  ArmorCombatConfig,
  ActiveAttackComponent,
} from './components/combat';
import {
  AIStatsComponent,
  AIConfig,
  VisionStatsComponent,
  HearingStatsComponent,
  PerceptionComponent,
  VisionConfig,
  HearingConfig,
} from './components/ai';
import {
  InventoryComponent,
  EquipmentComponent,
  InteractionSlotsComponent,
  InteractionActionComponent,
  PickupIntentComponent,
  ItemComponent,
  OwnershipComponent,
  ItemConfig,
  InventorySetup,
} from './components/inventory';
import { TimeScaleComponent } from './components/stats';
import {
  SocketDefComponent,
  SocketLinkComponent,
  BrainComponent,
  AssemblyRootComponent,
  LocomotionComponent,
  HeartComponent,
  ConsciousnessComponent,
  LocomotionStateComponent,
} from './components/anatomy';

export interface EntityComponents {
  tag?: TagComponent;
  visualModel?: VisualModelComponent;
  animator?: AnimatorComponent;
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
  meta?: import('./components/movement').CreatureMetaComponent;
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
  'visualModel',
  'animator',
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

export interface EntityConfig {
  tag?: TagComponent;
  visualModel?: VisualModelComponent;
  animator?: AnimatorComponent;
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
  item?: ItemConfig;
  inventory?: InventorySetup;
  equip?: EquipmentComponent;
  interactionSlots?: InteractionSlotsComponent;
  meta?: import('./components/movement').CreatureMetaComponent;
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
