import { BehaviorStatsConfig } from '../../ai/core';
import { StatValue } from './stats';

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

export interface AIStatsComponent {
  behavior: { base: string; current: string };
  stats?: Partial<BehaviorStatsConfig>;
}

export interface AIConfig {
  behavior: string;
  stats?: Partial<BehaviorStatsConfig>;
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
