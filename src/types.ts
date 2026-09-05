import { CreatureState, ItemData, StandardRadius, InventoryComponent, EntityConfig } from './ecs/types';

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

export type PlacementMode = { kind: 'entity'; config: EntityConfig };