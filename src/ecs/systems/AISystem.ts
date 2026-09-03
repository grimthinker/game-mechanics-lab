import { World } from '../World';
import { EntityId } from '../types';
import {
  EntityUtils,
  Blackboard,
  BTLogicComponent,
} from '../../ai/core';
import { createBTAISystem } from '../../ai/system';
import { BEHAVIOR_TREES } from '../../ai/trees_library';
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

  public initBotBrain(world: World, id: EntityId, behaviorId: string): void {
    const entity = world.getEntity(id);
    if (!entity) return;

    const treeFactory = BEHAVIOR_TREES[behaviorId] || BEHAVIOR_TREES['IdleTree'];

    const brain: BTLogicComponent = {
      root_node: treeFactory(),
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
    const entities = this.world.getEntitiesWith('meta', 'transform', 'input', 'stats', 'health', 'brain');
  
    for (const [id] of entities) {
      const adapter = this.getEntityAdapter(id);
      if (adapter) result.push(adapter);
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