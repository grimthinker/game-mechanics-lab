import { EntityConfig } from './ecs/types';

export interface Point {
  x: number;
  y: number;
}

export interface BlackboardPickingState {
  entityId: string;
  key: string;
}

export type PlacementMode =
  { kind: 'entity'; config: EntityConfig } | { kind: 'modular'; behavior: string; name: string };
