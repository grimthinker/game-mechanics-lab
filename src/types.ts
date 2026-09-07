import { EntityConfig } from './ecs/types';

export interface Point {
  x: number;
  y: number;
}

export interface ObstacleSegment {
  start: Point;
  end: Point;
}

export type PlacementMode = { kind: 'entity'; config: EntityConfig };
