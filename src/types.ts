import { CreatureType, CreatureState, ItemData, StandardRadius, CreatureConfig } from "./ecs/types";

export interface Point {
  x: number;
  y: number;
}

export interface ObstacleSegment {
  start: Point;
  end: Point;
}

export interface CreatureStats {
  id: string;
  type: CreatureType;
  radius: number;
  weight: number;
  currentSpeed: number;
  currentTurnSpeed: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  hp: number;
  maxHp: number;
  state: CreatureState;
  equipSlots: { type: string; item: ItemData | null }[];
}

export interface PlacementConfig {
  type: CreatureType;
  radius: StandardRadius;
  mass: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  crouchStealthMultiplier: number;
}

export type PlacementMode = 
  | { kind: 'creature'; config: CreatureConfig }
  | { kind: 'item'; itemData: ItemData; isSolid: boolean; radius: StandardRadius };