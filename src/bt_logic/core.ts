
import { BehaviorTreeId, MobTypeId } from "./config";


// Статусы выполнения узла
export enum NodeStatus {
    IDLE = 'IDLE',
    SUCCESS = 'SUCCESS',
    FAILURE = 'FAILURE',
    RUNNING = 'RUNNING'
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

export type PointLike = {
    x: number,
    y: number
}

// export interface EntityUtils {
//     get_all_entities: () => EntityContext[],
//     get_entity: (id: number) => EntityContext | undefined,
//     get_path: (start: PointLike, end: PointLike, navmesh_radius_type: RADIUS_SIZE) => Promise<PointLike[]>
// }

export interface EntityController {
    stop: () => boolean,
    start_moving: () => boolean,
    // set_status: (new_status: EntityStatus) => boolean,
    look_in_dir: (angle: number) => boolean,
    look_at_pos: (target_pos: PointLike) => boolean,
    attack: (id_target?: number) => boolean,
    is_alife: () => boolean,
    get_health: () => number,
    get_pos: () => PointLike
}

export type StatsComponent = {
    behavior?: CBehaviorStats,  // Нужно для мобов, игрокам не нужно
    entity: CEntityStats,
    weapon?: CWeaponStats    // Оружие по умолчанию, привязанное к этому существу
}

export type EntityContext = {
    id: number,
    dt: number,
    utils: EntityUtils,
    brain?: BTLogicComponent,
    stats: StatsComponent,
    attack_status: AttackStatus,
    attack_data?: AttackData;
    control: EntityController,  // Нужно для мобов (для управления)
}

// export type BTContext = {
//     world: IWorld,
//     hub: IHub,
//     location: string,
//     id_room: number,
//     dt: number,
//     components: {
//         id_entity: number;
//         c_identity: Components[ComponentType.IDENTITY],
//         c_transform: Components[ComponentType.TRANSFORM],
//         c_network: Components[ComponentType.NETWORK_ENTITY], 
//         c_physic: Components[ComponentType.PHYSICS],
//         c_life: Components[ComponentType.LIFE],
//         c_bt_logic: Components[ComponentType.BT_LOGIC],
//     },
// }


export interface BTNodeSchema {
    id: string;
    name: string;
    type: 'action' | 'composite' | 'decorator' | 'service' | 'condition';
    children?: BTNodeSchema[];
}


let nodeCounter = 0;
function generateNodeId(): string {
    return `node_${++nodeCounter}_${Math.random().toString(36).substr(2, 5)}`;
}


// Базовый класс для всех узлов
export abstract class BTNode {
    /** Уникальный ID экземпляра узла для React/Dagre */
    public readonly id: string = Math.random().toString(36).substring(2, 9);
    
    public static readonly nodeName: string;
    public static readonly description: string;
    public static readonly category: NodeCategory;
    public static readonly defaultParams?: Record<string, any>;

    public get name(): string { return (this.constructor as typeof BTNode).nodeName; }
    public get description(): string { return (this.constructor as typeof BTNode).description; }
    public get category(): NodeCategory { return (this.constructor as typeof BTNode).category; }

    /** Последний статус выполнения узла */
    public lastStatus: NodeStatus = NodeStatus.IDLE;

    /** Был ли узел открыт (активен) в прошлом кадре */
    protected isOpen: boolean = false;


    /** Вызывается при запуске/активации узла */
    protected onOpen(ctx: EntityContext): void {}

    /** Основная логика узла */
    protected abstract onTick(ctx: EntityContext): NodeStatus;

    /** Вызывается при завершении узла (SUCCESS или FAILURE) */
    protected onClose(ctx: EntityContext): void {}

    /** Вызывается при прерывании узла сверху */
    protected onAbort(ctx: EntityContext): void {}

    /** Главный метод выполнения, который вызывает система */
    public tick(ctx: EntityContext): NodeStatus {
        if (!this.isOpen) {
            this.onOpen(ctx);
            this.isOpen = true;
        }

        // Выполняем логику и сохраняем статус
        const status = this.onTick(ctx);
        this.lastStatus = status;

        if (status !== NodeStatus.RUNNING) {
            this.isOpen = false;
            this.onClose(ctx);
        }

        return status;
    }

    /** Принудительная остановка/сброс узла */
    public abort(ctx: EntityContext): void {
        if (this.isOpen) {
            this.onAbort(ctx);
            this.isOpen = false;
            this.lastStatus = NodeStatus.FAILURE; // Или IDLE
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

    protected onAbort(ctx: EntityContext): void {
        this.stopAction(ctx);
    }

    protected onClose(ctx: EntityContext): void {
        this.stopAction(ctx);
    }

    protected abstract stopAction(ctx: EntityContext): void;
}

export abstract class BTDecorator extends BTNode {
    public static readonly category: NodeCategory = 'decorator';

    constructor(public child: BTNode) {
        super();
    }

    public override abort(ctx: EntityContext): void {
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

    public override abort(ctx: EntityContext): void {
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

    protected override onTick(ctx: EntityContext): NodeStatus {
        this.timeSinceLastTick += ctx.dt;
        if (this.timeSinceLastTick >= this.params.interval) {
            this.tickService(ctx);
            this.timeSinceLastTick = 0;
        }
        return this.child.tick(ctx);
    }

    protected abstract tickService(ctx: EntityContext): void;
}

// --- События ---
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
    payload: any; // Например, { attacker_id: 123 } или { target_id: 456 }
};

// --- Доска знаний (Blackboard) ---
// Хранит "память" моба. Дерево читает отсюда, события пишут сюда.
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
    [K in keyof BBData]: BBData[K] extends PointLike[] ? K : never
}[keyof BBData];

type SquaredStats = {
    [K in keyof BehaviorStatsConfig as `${K}_sq`]: number;
};

export interface BBData extends BehaviorStatsConfig, SquaredStats {
    target_id: number,
    best_candidate_id: number | undefined,
    is_engaged: boolean,
    
    current_path: PointLike[],     // Путь для преследования
    
    // ПАТРУЛИРОВАНИЕ
    patrol_points: PointLike[],    // Весь список точек (приходит из AIEvent)
    current_patrol_index: number,  // Какую точку сейчас посещаем
    patrol_route_tmp: PointLike[], // Массив из одной точки для BTActionFollowPath

    //
    health: number,
    max_health: number,
    pos: PointLike,
}

export interface BehaviorStatsConfig {
    /** расстояние, на котором моб замечает сущность */
    detect_dist: number,

    /** расстояние, на котором моб теряет свою текущую цель */
    lose_target_dist: number,

    /** расстояние до целевой позиции, на котором она считается достигнутой*/
    in_pos_dist: number,

    /** расстояние между этой сущностью и целевой сущностью, на котором моб останавливается при преследовании (чтобы не упереться в цель, а встать на заданном расстоянии)*/
    follow_stop_dist: number,

    /** расстояние между этой сущностью и целевой сущностью, на котором моб возобновляет преследование (если до этого цель была достигнута, чтобы догонять удаляющуюся цель)*/
    follow_up_dist: number,
}

export enum MOB_RELATIONS {
    DANGER = "danger",     // Для обозначения в конфиге моба типа существ, которых данный моб будет считать опасностью
    PREY = "prey",       // Для обозначения типа существ, которых моб будет может выбирать как цель преследования
    FRIEND = "friend"      
}

export type RelationGroup = string;

export type MobRelations = {
    [k in MOB_RELATIONS]?: (MobTypeId | RelationGroup)[]
}

export interface BehaviorConfig {
    stats_conf: BehaviorStatsConfig,
    bt_id: BehaviorTreeId,
    relations: MobRelations,
    relations_group?: string,
}



export interface BTLogicComponent {
    root_node: BTNode,       // Корень дерева поведения
    blackboard: Blackboard,  // Индивидуальная память моба
    event_queue: AIEvent[],
    relations: MobRelations,
    relations_group?: string | undefined,
}