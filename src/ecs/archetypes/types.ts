import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import { EntityId, EntityConfig } from '../types';
import { Point } from '../../types';

export type EntityAssembler = (
  world: World,
  physics: PhysicsSystem,
  aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Point
) => void;