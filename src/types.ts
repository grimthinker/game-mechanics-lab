import { EntityConfig } from './ecs/types';
import { BodyStructureType } from './ecs/templates';

export interface Point {
  x: number;
  y: number;
}

export interface BlackboardPickingState {
  entityId: string;
  key: string;
}

export interface ModularPlacementOptions {
  structureType: BodyStructureType;
  behavior: string;
  name: string;
}

export type PlacementMode =
  { kind: 'entity'; config: EntityConfig } | { kind: 'modular'; options: ModularPlacementOptions };
