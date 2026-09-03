import { CreatureType, CreatureState, ItemData, StandardRadius } from "./ecs/types";

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
  mass: number;
  currentSpeed: number;
  currentTurnSpeed: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  hp: number;
  maxHp: number;
  state: CreatureState;
  equipSlots: { type: string; item: ItemData | null }[];
  inventory?: {
    size: { width: number; height: number };
    slots: { item: ItemData | null; count: number }[][];
  };
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
  | { kind: 'creature'; config: PlacementConfig }
  | { kind: 'item'; itemData: ItemData; isSolid: boolean; radius: StandardRadius };