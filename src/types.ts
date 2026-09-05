import { CreatureState, ItemData, StandardRadius, CreatureConfig } from "./ecs/types";
import { InventoryComponent, EntityConfig } from './ecs/types';

export interface Point {
  x: number;
  y: number;
}

export interface ObstacleSegment {
  start: Point;
  end: Point;
}


export interface EntityStats {
  id: string;
  behavior: string;
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
  itemData?: ItemData;
  inventory?: InventoryComponent;
}

export interface PlacementConfig {
  behavior: string;
  radius: StandardRadius;
  mass: number;
  maxSpeed: number;
  maxTurnSpeed: number;
  runSpeedMultiplier: number;
  crouchSpeedMultiplier: number;
  crouchStealthMultiplier: number;
}

export type PlacementMode = { kind: 'entity'; config: EntityConfig };