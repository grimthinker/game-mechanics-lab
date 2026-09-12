import { World } from '../World';
import { EntityId } from '../types';
import { EntityUtils, Blackboard, BTLogicComponent } from '../../ai/core';
import { createBTAISystem } from '../../ai/system';
import { BEHAVIOR_TREES } from '../../ai/trees_library';
import { EntityAdapter } from '../../EntityAdapter';

export class AISystem {
  private aiSystem: { update: (dt: number) => void };
  private world!: World;
  private adapters: Map<EntityId, EntityAdapter> = new Map();

  constructor() {
    const utils: EntityUtils = {
      getAllEntities: () => this.getAllAIEntities(),
      getEntity: (id: string) => this.getEntityAdapter(id),
      getPath: (_start, end) => Promise.resolve([{ x: end.x, y: end.y }]),
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
    const entities = this.world.getEntitiesWith(
      'meta',
      'transform',
      'input',
      'aiStats',
      'health',
      'brain'
    );

    // Собираем все ID существующих в мире сущностей для корректной очистки кэша
    const allWorldIds = new Set(this.world.getAllEntities().map(([id]) => id));

    for (const [id] of entities) {
      const adapter = this.getEntityAdapter(id);
      if (adapter) result.push(adapter);
    }

    // Очистка кэша от удаленных из мира сущностей (любого типа)
    for (const id of this.adapters.keys()) {
      if (!allWorldIds.has(id)) {
        this.adapters.delete(id);
      }
    }

    return result;
  }

  public unregisterEntity(id: EntityId): void {
    this.adapters.delete(id);
  }

  public clear(): void {
    this.adapters.clear();
  }

  private getEntityAdapter(id: EntityId): EntityAdapter | undefined {
    const ent = this.world.getEntity(id);
    if (!ent) {
      this.adapters.delete(id);
      return undefined;
    }

    let adapter = this.adapters.get(id);
    if (!adapter) {
      adapter = new EntityAdapter(id, this.world);
      this.adapters.set(id, adapter);
    }
    return adapter;
  }
}
