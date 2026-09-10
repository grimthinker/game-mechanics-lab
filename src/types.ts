import { EntityConfig } from './ecs/types';

export interface Point {
  x: number;
  y: number;
}

export type PlacementMode = { kind: 'entity'; config: EntityConfig };
