import { EntityAdapter } from '../EntityAdapter';
import { Point } from '../types';
import { vec2_distance_to, now_with_ms } from '../utils';
import {
  NodeStatus,
  BTAction,
  PathKeys,
  BTSimpleAction,
} from './core';

const follow_up_dist = 50;
const follow_stop_dist = 40;
const in_pos_dist = 5;

export class BTConditionValidTarget extends BTSimpleAction {
  public static readonly nodeName = 'Проверка валидности цели';
  public static readonly description = 'Проверяет, что цель валидна';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const target_id = bb.get('target_id');

    if (target_id === undefined) return NodeStatus.FAILURE;
    const target = entity.utils.get_entity(target_id);

    if (!target?.isAlive) {
      bb.remove('target_id');
      bb.remove('is_engaged');
      return NodeStatus.FAILURE;
    }
    return NodeStatus.SUCCESS;
  }
  protected onAbort() {}
}

export class BTConditionEngaged extends BTSimpleAction {
  public static readonly nodeName = 'Проверка нахождения в бою';
  public static readonly description = 'Проверяет, что моб завязан в бою';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const target_id = bb.get('target_id');
    if (target_id === undefined) return NodeStatus.FAILURE;

    const target = entity.utils.get_entity(target_id);
    const t_pos = target?.getPos();

    if (!t_pos) return NodeStatus.FAILURE;

    const e_pos = entity.getPos();
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
  public static readonly nodeName = 'Двигаться по пути';
  public static readonly description =
    'Двигаться по пути current_path, если он есть';

  constructor(private path_key: PathKeys = 'current_path') {
    super();
  }

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const path = bb.get(this.path_key) || [];

    if (path.length === 0) {
      entity.stop();
      return NodeStatus.SUCCESS;
    }

    const e_pos = entity.getPos();
    while (path.length > 0 && this.getDist(e_pos, path[0]) <= in_pos_dist) {
      path.shift();
    }

    if (path.length === 0) {
      entity.stop();
      bb.remove(this.path_key);
      return NodeStatus.SUCCESS;
    }

    entity.look_at_pos(path[0]);
    entity.startMovingForward();

    return NodeStatus.RUNNING;
  }

  private getDist(p1: Point, p2: Point): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  protected stopAction(entity: EntityAdapter): void {
    entity.stop();
  }
}

export class BTActionPursue extends BTAction {
  private movementNode: BTActionFollowPath = new BTActionFollowPath('current_path');
  private readonly stopDistSq: number = follow_stop_dist ** 2;
  public static readonly nodeName = 'Преследовать цель';
  public static readonly description =
    'Преследовать цель, если она есть и есть путь current_path';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const target_id = bb.get('target_id');
    if (target_id === undefined) return NodeStatus.FAILURE;

    const target = entity.utils.get_entity(target_id);
    const t_pos = target?.getPos();

    if (!t_pos) return NodeStatus.FAILURE;

    const e_pos = entity.getPos();
    const dx = t_pos.x - e_pos.x;
    const dy = t_pos.y - e_pos.y;

    if (dx * dx + dy * dy <= this.stopDistSq) {
      entity.stop();
      entity.look_at_pos(t_pos);
      return NodeStatus.SUCCESS;
    }

    return this.movementNode.tick(entity);
  }

  protected stopAction(entity: EntityAdapter): void {
    entity.brain!.blackboard.remove('current_path');
    this.movementNode.abort(entity);
  }
}

export class BTActionPatrol extends BTAction {
  private movementNode = new BTActionFollowPath('patrol_route_tmp');
  public static readonly nodeName = 'Патруль';
  public static readonly description =
    'Двигаться вдоль пути patrol_points, если они есть, иначе возвращает FAILURE';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const points = bb.get('patrol_points');

    if (!points || points.length === 0) return NodeStatus.FAILURE;

    let index = bb.get('current_patrol_index') || 0;

    if (!bb.has('patrol_route_tmp')) {
      bb.set('patrol_route_tmp', [points[index]]);
    }

    const status = this.movementNode.tick(entity);

    if (status === NodeStatus.SUCCESS) {
      index = (index + 1) % points.length;
      bb.set('current_patrol_index', index);
      bb.remove('patrol_route_tmp');
      return NodeStatus.RUNNING;
    }

    return status;
  }

  protected stopAction(entity: EntityAdapter): void {
    entity.brain!.blackboard.remove('patrol_route_tmp');
    this.movementNode.abort(entity);
  }
}

const attack_duration = 0.5;

export class BTActionAttack extends BTAction {
  private timer: number = 0;
  public static readonly nodeName = 'Атака';
  public static readonly description =
    'Совершает атаку. Пока идет атака, узел в состоянии RUNNING';

  protected onOpen(entity: EntityAdapter): void {
    const target_id = entity.brain!.blackboard.get('target_id');
    entity.stop();
    entity.attack(target_id);
    this.timer = 0;
  }

  protected onTick(entity: EntityAdapter): NodeStatus {
    this.timer += entity.dt;

    if (this.timer >= attack_duration) {
      return NodeStatus.SUCCESS;
    }

    return NodeStatus.RUNNING;
  }

  protected stopAction(entity: EntityAdapter): void {}
}

export class BTCommandForgetTarget extends BTSimpleAction {
  public static readonly nodeName = 'Забыть цель';
  public static readonly description =
    'Сбрасывает цель, состояние is_engaged и текущий путь';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    bb.remove('target_id');
    bb.remove('is_engaged');
    bb.remove('current_path');
    entity.stop();
    return NodeStatus.SUCCESS;
  }
}

export class BTCommandAcceptCandidate extends BTSimpleAction {
  public static readonly nodeName = 'Принять цель';
  public static readonly description =
    'Принять цель, указанную в best_candidate_id, если она есть';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const candidate = bb.get('best_candidate_id');

    if (candidate !== undefined) {
      bb.set('target_id', candidate);
      bb.remove('best_candidate_id');
      return NodeStatus.SUCCESS;
    }
    return NodeStatus.FAILURE;
  }
}

export class BTActionLookAtTarget extends BTSimpleAction {
  public static readonly nodeName = 'Повернуться к цели';
  public static readonly description =
    'Поворачивает сущность в сторону текущей цели (поворот мгновенный)';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const target_id = bb.get('target_id');
    if (target_id === undefined) return NodeStatus.FAILURE;

    const target = entity.utils.get_entity(target_id);
    const t_pos = target?.getPos();
    if (!t_pos) return NodeStatus.FAILURE;

    entity.look_at_pos(t_pos);
    return NodeStatus.SUCCESS;
  }
}

export class BTSucceedImmediately extends BTSimpleAction {
  public static readonly nodeName = 'Мгновенный успех';
  public static readonly description =
    'Ничего не делает и сразу возвращает SUCCESS';

  protected onTick(ctx: EntityAdapter): NodeStatus {
    return NodeStatus.SUCCESS;
  }
}

export class BTWait extends BTAction {
  public static readonly nodeName = 'Ожидание времени';
  public static readonly description =
    'Ждёт заданное количество секунд и возвращает SUCCESS';
  public static readonly defaultParams = { duration: 1 };

  private startTime: number = 0;
  private params: typeof BTWait.defaultParams;

  constructor(params?: Partial<typeof BTWait.defaultParams>) {
    super();
    this.params = { ...BTWait.defaultParams, ...params };
  }

  protected onOpen(ctx: EntityAdapter): void {
    this.startTime = now_with_ms();
  }

  protected onTick(ctx: EntityAdapter): NodeStatus {
    const elapsed = now_with_ms() - this.startTime;
    if (elapsed >= this.params.duration) {
      return NodeStatus.SUCCESS;
    }
    return NodeStatus.RUNNING;
  }

  protected stopAction(ctx: EntityAdapter): void {}
}