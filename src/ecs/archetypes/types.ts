import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import { EntityId, EntityConfig } from '../types';
import { Point, Vec3 } from '../../types';

export type EntityAssembler = (
  world: World,
  physics: PhysicsSystem,
  aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  position?: Point | Vec3
) => void;
