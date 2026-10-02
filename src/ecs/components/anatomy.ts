import { Radians } from '../../utils';
import { StatValue } from './stats';

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

/**
 * ECS Tag-компонент, указывающий, что данная часть тела является опорной ходильной конечностью.
 */
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

export interface HeadOrientationComponent {
  /** Мировой угол поворота головы по горизонтали (Yaw) */
  yaw: Radians;
  /** Мировой угол наклона головы по вертикали (Pitch) */
  pitch: Radians;
  /** Локальный угол поворота относительно корпуса (Yaw) */
  relativeYaw: Radians;
  /** Локальный угол наклона относительно корпуса (Pitch) */
  relativePitch: Radians;
  /** Текущая скорость поворота головы (рад/с) */
  yawVelocity: number;
  /** Текущая скорость наклона головы (рад/с) */
  pitchVelocity: number;
  /** Стат максимальной скорости поворота головы, подверженный воздействию эффектов */
  turnSpeed: StatValue<number>;
}
