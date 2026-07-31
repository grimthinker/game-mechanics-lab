import { now_with_ms, vec2_distance_to } from "../utils";
import { BTNode, EntityContext, NodeStatus, BTAction, PathKeys, PointLike, BTSimpleAction } from "./core";


const follow_up_dist = 10;
const follow_stop_dist = 14;
const in_pos_dist = 1;

export class BTConditionValidTarget extends BTSimpleAction {
    public static readonly nodeName = "Проверка валидности цели";
    public static readonly description = "Проверяет, что цель валидна";

    protected onTick(entity: EntityContext): NodeStatus {
        const bb = entity.brain!.blackboard;
        const target_id = bb.get('target_id');
        
        if (target_id === undefined) return NodeStatus.FAILURE;
        const target = entity.utils.get_entity(target_id);

        if (!target?.control.is_alife()) {
            bb.remove('target_id');
            bb.remove('is_engaged');
            return NodeStatus.FAILURE;
        }
        return NodeStatus.SUCCESS;
    }
    protected onAbort() {}
}

export class BTConditionEngaged extends BTSimpleAction {
    public static readonly nodeName = "Проверка нахождения в бою";
    public static readonly description = "Проверяет, что моб завязан в бою";

    protected onTick(entity: EntityContext): NodeStatus {
        const bb = entity.brain!.blackboard;
        const target_id = bb.get('target_id');
        if (target_id === undefined) return NodeStatus.FAILURE;

        const target = entity.utils.get_entity(target_id);
        const t_pos = target?.control.get_pos();

        if (!t_pos) 
            return NodeStatus.FAILURE;

        const e_pos = entity.control.get_pos();
        const dist = vec2_distance_to(e_pos, t_pos);
        let is_engaged = bb.get('is_engaged') || false;

        if (is_engaged) {
            if (dist > follow_up_dist) is_engaged = false;
        } else {
            if (dist <= follow_stop_dist) is_engaged = true;
        }

        bb.set('is_engaged', is_engaged);
        return is_engaged ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
    }
    protected onAbort() {}
}

export class BTActionFollowPath extends BTAction {
    public static readonly nodeName = "Двигаться по пути";
    public static readonly description = "Двигаться по пути current_path, если он есть";

    constructor(private path_key: PathKeys = 'current_path') { 
        super();
    }

    protected onTick(entity: EntityContext): NodeStatus {
        const bb = entity.brain!.blackboard;
        const path = bb.get(this.path_key) || [];

        if (path.length === 0) {
            entity.control.stop();
            return NodeStatus.SUCCESS;
        }

        const e_pos = entity.control.get_pos();
        while (path.length > 0 && this.getDist(e_pos, path[0]) <= in_pos_dist) {
            path.shift();
        }

        if (path.length === 0) {
            entity.control.stop();
            bb.remove(this.path_key); 
            return NodeStatus.SUCCESS;
        }

        entity.control.look_at_pos(path[0]);
        entity.control.start_moving();

        return NodeStatus.RUNNING;
    }

    private getDist(p1: PointLike, p2: PointLike): number {
        return Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
    }

    protected stopAction(entity: EntityContext): void {
        entity.control.stop();
    }
}

export class BTActionPursue extends BTAction {
    private movementNode: BTActionFollowPath = new BTActionFollowPath('current_path');
    private readonly stopDistSq: number = follow_stop_dist ** 2;
    public static readonly nodeName = "Преследовать цель";
    public static readonly description = "Преследовать цель, если она есть и есть путь current_path";

    protected onTick(entity: EntityContext): NodeStatus {
        const bb = entity.brain!.blackboard;
        const target_id = bb.get('target_id');
        if (target_id === undefined) return NodeStatus.FAILURE;

        const target = entity.utils.get_entity(target_id);
        const t_pos = target?.control.get_pos();

        if (!t_pos) return NodeStatus.FAILURE;

        const e_pos = entity.control.get_pos();

        const dx = t_pos.x - e_pos.x;
        const dy = t_pos.y - e_pos.y;

        if ((dx * dx + dy * dy) <= this.stopDistSq) {
            return NodeStatus.SUCCESS;
        }

        return this.movementNode.tick(entity);
    }

    protected stopAction(entity: EntityContext): void {
        entity.brain!.blackboard.remove('current_path');   // Удаляем путь при завершении действия 
        this.movementNode.abort(entity);
    }
}

export class BTActionPatrol extends BTAction {
    private movementNode = new BTActionFollowPath('patrol_route_tmp');
    public static readonly nodeName = "Патруль";
    public static readonly description = "Двигаться вдоль пути patrol_points, если они есть, иначе возвращает FAILURE";

    protected onTick(entity: EntityContext): NodeStatus {
        const bb = entity.brain!.blackboard;
        const points = bb.get('patrol_points');

        if (!points || points.length === 0) return NodeStatus.FAILURE;

        let index = bb.get('current_patrol_index') || 0;

        // Передаем путь в FollowPath только в случае, если текущего временного пути нет
        if (!bb.has('patrol_route_tmp')) {
            bb.set('patrol_route_tmp', [points[index]]);
        }

        const status = this.movementNode.tick(entity);

        if (status === NodeStatus.SUCCESS) {
            index = (index + 1) % points.length;
            bb.set('current_patrol_index', index);
            bb.remove('patrol_route_tmp'); // Очищаем временный путь для смены точки
            return NodeStatus.RUNNING; 
        }

        return status;
    }

    protected stopAction(entity: EntityContext): void {
        entity.brain!.blackboard.remove('patrol_route_tmp');
        this.movementNode.abort(entity);
    }
}

const attack_duration = 1;

export class BTActionAttack extends BTAction {
    private timer: number = 0;
    public static readonly nodeName = "Атака";
    public static readonly description = "Совершает атаку. Пока идет атака, узел в состоянии RUNNING";

    protected onOpen(entity: EntityContext): void {
        const target_id = entity.brain!.blackboard.get('target_id');
        entity.control.stop();
        entity.control.attack(target_id);
        this.timer = 0;
    }

    protected onTick(entity: EntityContext): NodeStatus {
        this.timer += entity.dt; 

        if (this.timer >= attack_duration) {
            return NodeStatus.SUCCESS;
        }

        return NodeStatus.RUNNING; 
    }

    protected stopAction(entity: EntityContext): void {
        // Остановка атаки, пока не релизовано (мобы не умеют прерывать атаку)
    }
}

export class BTCommandForgetTarget extends BTSimpleAction {
    public static readonly nodeName = "Забыть цель";
    public static readonly description = "Сбрасывает цель, состояние is_engaged и теущий путь";

    protected onTick(entity: EntityContext): NodeStatus {
        const bb = entity.brain!.blackboard;
        bb.remove('target_id');
        bb.remove('is_engaged');
        bb.remove('current_path');
        entity.control.stop();
        return NodeStatus.SUCCESS;
    }
}

export class BTCommandAcceptCandidate extends BTSimpleAction {
    public static readonly nodeName = "Принять цель";
    public static readonly description = "Принять цель, указанную в best_candidate_id, если она есть";
    
    protected onTick(entity: EntityContext): NodeStatus {
        const bb = entity.brain!.blackboard;
        const candidate = bb.get('best_candidate_id');

        if (candidate !== undefined) {
            bb.set('target_id', candidate);
            bb.remove('best_candidate_id'); // Очищаем временную переменную
            return NodeStatus.SUCCESS;
        }
        return NodeStatus.FAILURE;
    }
}

export class BTActionLookAtTarget extends BTSimpleAction {
    public static readonly nodeName = "Повернуться к цели";
    public static readonly description = "Поворачивает сущность в сторону текущей цели (поворот мгновенный)";

    protected onTick(entity: EntityContext): NodeStatus {
        const bb = entity.brain!.blackboard;
        const target_id = bb.get('target_id');
        if (target_id === undefined) return NodeStatus.FAILURE;

        const target = entity.utils.get_entity(target_id);
        const t_pos = target?.control.get_pos();
        if (!t_pos) return NodeStatus.FAILURE;

        entity.control.look_at_pos(t_pos);
        return NodeStatus.SUCCESS;
    }
}

export class BTSucceedImmediately extends BTSimpleAction {
    public static readonly nodeName = "Мгновенный успех";
    public static readonly description = "Ничего не делает и сразу возвращает SUCCESS";
    
    protected onTick(ctx: EntityContext): NodeStatus {
        return NodeStatus.SUCCESS;
    }
}

export class BTWait extends BTAction {
    public static readonly nodeName = "Ожидание времени";
    public static readonly description = "Ждёт заданное количеcтво секунд и возвращает SUCCESS";
    public static readonly defaultParams = { duration: 1 };

    private startTime: number = 0;
    private params: typeof BTWait.defaultParams;

    constructor(params?: Partial<typeof BTWait.defaultParams>) { 
        super();
        this.params = { ...BTWait.defaultParams, ...params };
    }

    protected onOpen(ctx: EntityContext): void {
        this.startTime = now_with_ms(); 
    }

    protected onTick(ctx: EntityContext): NodeStatus {
        const elapsed = now_with_ms() - this.startTime;
        if (elapsed >= this.params.duration) {
            return NodeStatus.SUCCESS;
        }
        return NodeStatus.RUNNING;
    }
    
    protected stopAction(ctx: EntityContext): void {}
}