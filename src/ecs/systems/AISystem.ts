import { World } from '../World';
import { EntityId } from '../types';
import {
  EntityUtils,
  Blackboard,
  BTLogicComponent,
} from '../../ai/core';
import { createBTAISystem } from '../../ai/system';
import { AttackerTree } from '../../ai/trees_library';
import { EntityAdapter } from '../../EntityAdapter';
import { PhysicsSystem } from '../systems/PhysicsSystem';

export class AISystem {
  private aiSystem: { update: (dt: number) => void };
  private world!: World;

  constructor() {
    const utils: EntityUtils = {
      get_all_entities: () => this.getAllAIEntities(),
      get_entity: (id: string) => this.getEntityAdapter(id),
      get_path: (_start, end) => Promise.resolve([{ x: end.x, y: end.y }]),
    };

    this.aiSystem = createBTAISystem(utils);
  }

  public initBotBrain(world: World, id: EntityId): void {
    const entity = world.getEntity(id);
    if (!entity) return;

    const brain: BTLogicComponent = {
      root_node: AttackerTree(),
      blackboard: new Blackboard(),
      event_queue: [],
      relations: {},
    };

    world.addComponent(id, 'brain' as any, brain);
  }

  public update(dt: number, world: World): void {
    this.world = world;
    this.aiSystem.update(dt);
  }

  private getAllAIEntities(): EntityAdapter[] {
    const result: EntityAdapter[] = [];
    const entities = this.world.getEntitiesWith('meta', 'transform', 'input', 'stats', 'health');

    for (const [id, comp] of entities) {
      if (comp.meta.type === 'ai') {
        const adapter = this.getEntityAdapter(id);
        if (adapter) result.push(adapter);
      }
    }
    return result;
  }

  private getEntityAdapter(id: EntityId): EntityAdapter | undefined {
    const ent = this.world.getEntity(id);
    if (!ent || !ent.transform || !ent.input || !ent.stats || !ent.health) {
      return undefined;
    }
    return new EntityAdapter(id, this.world);
  }
}