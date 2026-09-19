import { Body } from 'detect-collisions';
import { Point } from '../../types';
import { Radians } from '../../utils';
import { StatValue } from './stats';

export interface TransformComponent {
  x: number;
  y: number;
  angle: Radians;
}

export interface PhysicsBodyComponent {
  body: Body;
  isStatic: boolean;
  category: number;
  mask: number;
  isTrigger?: boolean;
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
}

export interface PhysicsStatsComponent {
  radius: StatValue<number>;
  weight: StatValue<number>;
  totalWeight?: number;
  size?: number;
  isSolid: boolean;
  points?: Point[];
}
