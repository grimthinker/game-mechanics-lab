import { Circle } from 'detect-collisions';
import { CreatureType, CreatureState, Point, WeaponConfig, ActiveAttack } from '../types';

export type EntityId = string;

export interface TransformComponent {
  x: number;
  y: number;
  angle: number;
}

export interface PhysicsBodyComponent {
  body: Circle;
  radius: number;
  mass: number;
  isStatic: boolean;
}

export interface VelocityComponent {
  maxSpeed: number;
  maxTurnSpeed: number;
  currentSpeed: number;
  currentTurnSpeed: number;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
}

export interface InputComponent {
  isMovingForward: boolean;
  turningDirection: -1 | 0 | 1;
  isRunning: boolean;
  isCrouching: boolean;
  wantsAttack: boolean;
}

export interface HealthComponent {
  hp: number;
  maxHp: number;
  isAlive: boolean;
  hitFlashTimer: number;
}

export interface StealthComponent {
  stealth: number;
  baseStealth: number;
  crouchStealthMultiplier: number;
}

export interface WeaponInventoryComponent {
  weapons: WeaponConfig[];
  activeAttacks: ActiveAttack[];
}

export interface CreatureMetaComponent {
  id: string;
  type: CreatureType;
  state: CreatureState;
}

export interface EntityComponents {
  transform?: TransformComponent;
  physicsBody?: PhysicsBodyComponent;
  velocity?: VelocityComponent;
  input?: InputComponent;
  health?: HealthComponent;
  stealth?: StealthComponent;
  weaponInventory?: WeaponInventoryComponent;
  meta?: CreatureMetaComponent;
}