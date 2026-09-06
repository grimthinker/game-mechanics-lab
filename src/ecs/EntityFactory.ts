import { World } from './World';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { AISystem } from './systems/AISystem';
import { EntityId, EntityConfig } from './types';
import { Point } from '../types';
import { ARCHETYPE_ASSEMBLERS, detectArchetype } from './archetypes';

export class EntityFactory {
  public spawnEntity(
    world: World,
    physics: PhysicsSystem,
    aiSystem: AISystem,
    config: EntityConfig,
    position?: Point,
    forcedId?: string
  ): EntityId {
    const id = forcedId || `ent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    world.createEntity(id);

    const archetype = detectArchetype(config);
    const assembler = ARCHETYPE_ASSEMBLERS[archetype] ?? ARCHETYPE_ASSEMBLERS.creature;
    assembler(world, physics, aiSystem, id, config, position);

    return id;
  }
}