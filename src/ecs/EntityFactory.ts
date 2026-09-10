import { World } from './World';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { AISystem } from './systems/AISystem';
import { EntityId, EntityConfig } from './types';
import { Point } from '../types';
import { ARCHETYPE_ASSEMBLERS, detectArchetype } from './archetypes';

export class EntityFactory {
  public generateId(prefix: string = 'ent'): EntityId {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  public spawnEntity(
    world: World,
    physics: PhysicsSystem,
    aiSystem: AISystem,
    config: EntityConfig,
    position?: Point,
    forcedId?: string
  ): EntityId {
    const id = forcedId || this.generateId('ent');
    world.createEntity(id);

    const archetype = detectArchetype(config);
    const assembler = ARCHETYPE_ASSEMBLERS[archetype] ?? ARCHETYPE_ASSEMBLERS.creature;
    assembler(world, physics, aiSystem, id, config, position);

    if (archetype === 'creature') {
      this.setupDefaultCreatureEquipment(world, physics, aiSystem, id, position);
    }

    return id;
  }

  private setupDefaultCreatureEquipment(
    world: World,
    physics: PhysicsSystem,
    aiSystem: AISystem,
    creatureId: EntityId,
    position?: Point
  ): void {
    const equip = world.getComponent(creatureId, 'equip');
    if (!equip) return;

    const torsoArea = equip.equipmentAreas.find((a) => a.type === 'torso');
    if (torsoArea && torsoArea.itemIds.length === 0) {
      const bagId = this.spawnEntity(
        world,
        physics,
        aiSystem,
        {
          tag: { archetype: 'item', subType: 'bag' },
          item: {
            name: 'Сумка',
            type: 'bag',
            maxStack: 1,
            size: 10,
            equipType: 'torso',
            equippable: true,
            equipTimeMultiplier: 1.0,
          },
          physics: {
            radius: 16,
            weight: 1,
            isSolid: true,
          },
          ownership: {
            ownerId: creatureId,
            status: 'equipped',
          },
          inventory: {
            size: { width: 6, height: 4 },
          },
        },
        position,
        this.generateId('item_bag')
      );
      torsoArea.itemIds.push(bagId);
    }
  }
}
