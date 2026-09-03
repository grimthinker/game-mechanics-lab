import { Point } from '../types';
import { BehaviorTreeId, MobTypeId } from './config';
import type { EntityAdapter } from '../EntityAdapter'; // Import EntityAdapter as Context
import { StandardRadius } from '../ecs/types';

export enum NodeStatus {
  IDLE = 'IDLE',
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  RUNNING = 'RUNNING',
}

export const ALL_NODE_CATEGORIES = [
  'composite',
  'decorator',
  'service',
  'action',
  'simple_action',
  'condition',
] as const;

export type NodeCategory = typeof ALL_NODE_CATEGORIES[number];

export interface BTNodeDTO {
    id?: string;
    name: string;
    category: NodeCategory;
    status?: NodeStatus;
    description?: string;
    parameters?: Record<string, any>;
    timeToNextTick?: number; 
    children: BTNodeDTO[];
  }

export interface BTMessage {
  type: 'BT_TICK';
  payload: EntityBTState[];
}

export interface EntityBTState {
  entity_id: number;
  entity_name?: string;
  tree: BTNodeDTO;
  blackboard?: Record<string, any>; 
}

export interface EntityUtils {
  get_all_entities: () => EntityAdapter[];
  get_entity: (id: string) => EntityAdapter | undefined;
  get_path: (
    start: Point,
    end: Point,
    navmesh_radius_type?: StandardRadius
  ) => Promise<Point[]>;
}


export type AttackStatus = 'idle' | 'attacking' | 'cooldown';
export type AttackData = any;

export abstract class BTNode {
  public readonly id: string = Math.random().toString(36).substring(2, 9);
  public static readonly nodeName: string;
  public static readonly description: string;
  public static readonly category: NodeCategory;
  public static readonly defaultParams?: Record<string, any>;

  public get name(): string {
    return (this.constructor as typeof BTNode).nodeName;
  }
  public get description(): string {
    return (this.constructor as typeof BTNode).description;
  }
  public get category(): NodeCategory {
    return (this.constructor as typeof BTNode).category;
  }

  public lastStatus: NodeStatus = NodeStatus.IDLE;
  protected isOpen: boolean = false;

  protected onOpen(ctx: EntityAdapter): void {}
  protected abstract onTick(ctx: EntityAdapter): NodeStatus;
  protected onClose(ctx: EntityAdapter): void {}
  protected onAbort(ctx: EntityAdapter): void {}

  public tick(ctx: EntityAdapter): NodeStatus {
    if (!this.isOpen) {
      this.onOpen(ctx);
      this.isOpen = true;
    }

    const status = this.onTick(ctx);
    this.lastStatus = status;

    if (status !== NodeStatus.RUNNING) {
      this.isOpen = false;
      this.onClose(ctx);
    }

    return status;
  }

  public abort(ctx: EntityAdapter): void {
    if (this.isOpen) {
      this.onAbort(ctx);
      this.isOpen = false;
      this.lastStatus = NodeStatus.FAILURE;
    }
  }

  public isRunning(): boolean {
    return this.lastStatus === NodeStatus.RUNNING;
  }
}

export abstract class BTSimpleAction extends BTNode {
  public static readonly category: NodeCategory = 'simple_action';
}

export abstract class BTAction extends BTNode {
  public static readonly category: NodeCategory = 'action';

  protected onAbort(ctx: EntityAdapter): void {
    this.stopAction(ctx);
  }

  protected onClose(ctx: EntityAdapter): void {
    this.stopAction(ctx);
  }

  protected abstract stopAction(ctx: EntityAdapter): void;
}

export abstract class BTDecorator extends BTNode {
  public static readonly category: NodeCategory = 'decorator';

  constructor(public child: BTNode) {
    super();
  }

  public override abort(ctx: EntityAdapter): void {
    if (this.child.isRunning()) {
      this.child.abort(ctx);
    }
    super.abort(ctx);
  }
}

export abstract class BTComposite extends BTNode {
  public static readonly category: NodeCategory = 'composite';

  constructor(public children: BTNode[]) {
    super();
  }

  public override abort(ctx: EntityAdapter): void {
    for (const child of this.children) {
      if (child.isRunning()) {
        child.abort(ctx);
      }
    }
    super.abort(ctx);
  }
}

export abstract class BTService extends BTDecorator {
  public static readonly category: NodeCategory = 'service';
  public static readonly defaultParams: { interval: number } = { interval: 1.0 };

  protected params: typeof BTService.defaultParams;
  private timeSinceLastTick: number = 0;

  constructor(child: BTNode, params?: Partial<typeof BTService.defaultParams>) {
    super(child);
    this.params = { ...BTService.defaultParams, ...params };
  }

  protected override onTick(ctx: EntityAdapter): NodeStatus {
    this.timeSinceLastTick += ctx.dt;
    if (this.timeSinceLastTick >= this.params.interval) {
      this.tickService(ctx);
      this.timeSinceLastTick = 0;
    }
    return this.child.tick(ctx);
  }

  public get timeRemains() {
    return this.params.interval - this.timeSinceLastTick;
  }

  protected abstract tickService(ctx: EntityAdapter): void;
}

export enum AIEventType {
  DAMAGED,
  TARGET_SPOTTED,
  TARGET_LOST,
  SET_TARGET,
  SET_PATROL_POINTS,
  APPLY_EFFECT,
  WEAPON_CHANGED,
}

export type AIEvent = {
  type: AIEventType;
  payload: any;
};

export class Blackboard {
  private data: Partial<BBData> = {};

  public getData(): Partial<BBData> {
    return this.data;
  }

  public set<K extends keyof BBData>(key: K, value: BBData[K]): void {
    this.data[key] = value;
  }

  public get<K extends keyof BBData>(key: K): BBData[K] | undefined {
    return this.data[key];
  }

  public has<K extends keyof BBData>(key: K): boolean {
    return this.data[key] !== undefined;
  }

  public remove<K extends keyof BBData>(key: K): void {
    delete this.data[key];
  }
}

export type PathKeys = {
  [K in keyof BBData]-?: BBData[K] extends Point[] ? K : never;
}[keyof BBData];

type SquaredStats = {
  [K in keyof BehaviorStatsConfig as `${K}_sq`]: number;
};

export interface BBData extends BehaviorStatsConfig, SquaredStats {
  pressed_keys?: string[];
  target_id: string;
  best_candidate_id: string | undefined;
  is_engaged: boolean;
  current_path: Point[];
  patrol_points: Point[];
  current_patrol_index: number;
  patrol_route_tmp: Point[];
  health: number;
  max_health: number;
  pos: Point;
}

export interface BehaviorStatsConfig {
  detect_dist: number;
  lose_target_dist: number;
  in_pos_dist: number;
  follow_stop_dist: number;
  follow_up_dist: number;
}

export enum MOB_RELATIONS {
  DANGER = 'danger',
  PREY = 'prey',
  FRIEND = 'friend',
}

export type RelationGroup = string;

export type MobRelations = {
  [k in MOB_RELATIONS]?: (MobTypeId | RelationGroup)[];
};

export interface BehaviorConfig {
  stats_conf: BehaviorStatsConfig;
  bt_id: BehaviorTreeId;
  relations: MobRelations;
  relations_group?: string;
}

export interface BTLogicComponent {
  root_node: BTNode;
  blackboard: Blackboard;
  event_queue: AIEvent[];
  relations: MobRelations;
  relations_group?: string | undefined;
}