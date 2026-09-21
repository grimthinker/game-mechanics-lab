import RAPIER from '@dimforge/rapier3d-compat';
import { Point, Vec3, Quat, Radians } from '../../types';
import { StatValue } from './stats';

export type PhysicsBodyType = 'dynamic' | 'fixed' | 'kinematicPositionBased';

export interface TransformComponent {
  x: number;
  y: number;
  z: number;
  rotation: Quat;
  /** Вспомогательное поле рыскания (Yaw) для обратной совместимости систем */
  angle: Radians;
}

export interface PhysicsBodyComponent {
  /** Нативное твердое тело Rapier3D (WASM) */
  rawBody?: RAPIER.RigidBody;
  /** Основной коллайдер тела в Rapier3D */
  rawCollider?: RAPIER.Collider;
  /** Тип физического поведения в 3D */
  bodyType?: PhysicsBodyType;

  isStatic: boolean;
  category: number;
  mask: number;
  isTrigger?: boolean;
  currentColliderStance?: string;
}

export const STANDARD_RADII = [8, 16, 24, 32] as const;
export type StandardRadius = (typeof STANDARD_RADII)[number];

export function isValidStandardRadius(radius: number): radius is StandardRadius {
  return (STANDARD_RADII as readonly number[]).includes(radius);
}

export interface PhysicsConfig {
  radius: number;
  weight: number;
  totalWeight?: number;
  size?: number;
  isSolid?: boolean;
  points?: Point[];
  linearDamping?: number;
  angularDamping?: number;
}

export interface PhysicsStatsComponent {
  radius: StatValue<number>;
  weight: StatValue<number>;
  totalWeight?: number;
  size?: number;
  isSolid: boolean;
  points?: Point[];
}
