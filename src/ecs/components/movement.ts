import { Radians } from '../../utils';
import { StatValue } from './stats';

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

export type CreatureActionMode =
  'idle' | 'attacking' | 'pickup' | 'equipping' | 'stance_changing' | 'throw';

export interface CreatureMetaComponent {
  name: string;
  stance?: CreatureStance;
  movementMode?: CreatureMovementMode;
  directionMode?: CreatureDirectionMode;
  actionMode?: CreatureActionMode;
  entityType?: string;
  destructible?: boolean;
}

export interface VelocityComponent {
  vx: number;
  vy: number;
  vz: number;
  currentSpeed: number;
  currentTurnSpeed: Radians;
  externalVx?: number;
  externalVy?: number;
  externalVz?: number;
  angvel?: { x: number; y: number; z: number };
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
  throwPrepTime?: number;
  throwRecoveryTime?: number;
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
  throwPrepTime: StatValue<number>;
  throwRecoveryTime: StatValue<number>;
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
