import { EntityAdapter } from '../EntityAdapter';
import { Point } from '../types';
import { vec2_distance_to, Radians } from '../utils';
import { LOGIC_CONFIG } from './config';
import { NodeStatus, BTAction, PathKeys, BTSimpleAction } from './core';

export class BTConditionValidTarget extends BTSimpleAction {
  public static readonly nodeName = 'Проверка валидности цели';
  public static readonly description = 'Проверяет, что цель валидна';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const targetId = bb.get('targetId');

    if (targetId === undefined) return NodeStatus.FAILURE;
    const target = entity.utils.getEntity(targetId);

    if (!target?.isAlive) {
      bb.remove('targetId');
      bb.remove('isEngaged');
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
    const targetId = bb.get('targetId');
    if (targetId === undefined) return NodeStatus.FAILURE;

    const target = entity.utils.getEntity(targetId);
    const targetPos = target?.getPos();

    if (!targetPos) return NodeStatus.FAILURE;

    const selfPos = entity.getPos();
    const dist = vec2_distance_to(selfPos, targetPos);
    let isEngaged = bb.get('isEngaged') || false;

    if (isEngaged) {
      if (dist > LOGIC_CONFIG.followUpDist) isEngaged = false;
    } else {
      if (dist <= LOGIC_CONFIG.followStopDist) isEngaged = true;
    }

    bb.set('isEngaged', isEngaged);
    return isEngaged ? NodeStatus.SUCCESS : NodeStatus.FAILURE;
  }
  protected onAbort() {}
}

export class BTActionPursue extends BTAction {
  private movementNode: BTActionFollowPathSmooth = new BTActionFollowPathSmooth('currentPath');
  private readonly stopDistSq: number = LOGIC_CONFIG.followStopDist ** 2;
  public static readonly nodeName = 'Преследовать цель';
  public static readonly description = 'Преследовать цель, если она есть и есть путь currentPath';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const targetId = bb.get('targetId');
    if (targetId === undefined) return NodeStatus.FAILURE;

    const target = entity.utils.getEntity(targetId);
    const targetPos = target?.getPos();

    if (!targetPos) return NodeStatus.FAILURE;

    const selfPos = entity.getPos();
    const dx = targetPos.x - selfPos.x;
    const dy = targetPos.y - selfPos.y;

    if (dx * dx + dy * dy <= this.stopDistSq) {
      entity.stop();
      entity.stopTurning();
      return NodeStatus.SUCCESS;
    }

    return this.movementNode.tick(entity);
  }

  protected stopAction(entity: EntityAdapter): void {
    entity.brain!.blackboard.remove('currentPath');
    this.movementNode.abort(entity);
  }
}

export class BTActionPatrol extends BTAction {
  private movementNode = new BTActionFollowPathSmooth('patrolRouteTmp');
  public static readonly nodeName = 'Патруль';
  public static readonly description =
    'Двигаться вдоль пути patrolPoints, если они есть, иначе возвращает FAILURE';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const points = bb.get('patrolPoints');

    if (!points || points.length === 0) return NodeStatus.FAILURE;

    let index = bb.get('currentPatrolIndex') || 0;

    if (!bb.has('patrolRouteTmp')) {
      bb.set('patrolRouteTmp', [points[index]]);
    }

    const status = this.movementNode.tick(entity);

    if (status === NodeStatus.SUCCESS) {
      index = (index + 1) % points.length;
      bb.set('currentPatrolIndex', index);
      bb.remove('patrolRouteTmp');
      return NodeStatus.RUNNING;
    }

    return status;
  }

  protected stopAction(entity: EntityAdapter): void {
    entity.brain!.blackboard.remove('patrolRouteTmp');
    this.movementNode.abort(entity);
  }
}

export class BTActionAttack extends BTAction {
  private hasStarted: boolean = false;
  public static readonly nodeName = 'Атака';
  public static readonly description =
    'Совершает атаку указанным слотом (или первым свободным) и ожидает её завершения в ECS';
  public static readonly defaultParams: { slotIndex?: number } = {
    slotIndex: undefined,
  };

  private params: typeof BTActionAttack.defaultParams;

  constructor(params?: Partial<typeof BTActionAttack.defaultParams>) {
    super();
    this.params = { ...BTActionAttack.defaultParams, ...params };
  }

  protected onOpen(entity: EntityAdapter): void {
    const targetId = entity.brain!.blackboard.get('targetId');
    entity.stop();
    entity.attack(targetId, this.params.slotIndex);
    this.hasStarted = false;
  }

  protected onTick(entity: EntityAdapter): NodeStatus {
    // 1. Атака активна и обрабатывается в ECS (для конкретного слота или общая)
    const isAttackingInECS =
      this.params.slotIndex !== undefined
        ? entity.isSlotBusy(this.params.slotIndex)
        : entity.attackStatus !== 'idle';

    if (isAttackingInECS) {
      this.hasStarted = true;
      return NodeStatus.RUNNING;
    }

    // 2. Запрос на атаку только что отправлен в input, но AttackSystem еще не выполнилась в текущем кадре
    if (entity.hasPendingAttackRequest) {
      return NodeStatus.RUNNING;
    }

    // 3. Атака была начата в ECS и теперь полностью завершилась (пройдено время восстановления)
    if (this.hasStarted) {
      return NodeStatus.SUCCESS;
    }

    // 4. Запрос был обработан, но атака не началась (нет оружия в слотах, слот занят и т.д.)
    return NodeStatus.FAILURE;
  }

  protected stopAction(entity: EntityAdapter): void {
    entity.cancelAttack(this.params.slotIndex);
    this.hasStarted = false;
  }
}

export class BTCommandForgetTarget extends BTSimpleAction {
  public static readonly nodeName = 'Забыть цель';
  public static readonly description = 'Сбрасывает цель, состояние isEngaged и текущий путь';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    bb.remove('targetId');
    bb.remove('isEngaged');
    bb.remove('currentPath');
    entity.stop();
    return NodeStatus.SUCCESS;
  }
}

export class BTCommandAcceptCandidate extends BTSimpleAction {
  public static readonly nodeName = 'Принять цель';
  public static readonly description = 'Принять цель, указанную в bestCandidateId, если она есть';

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const candidate = bb.get('bestCandidateId');

    if (candidate !== undefined) {
      bb.set('targetId', candidate);
      bb.remove('bestCandidateId');
      return NodeStatus.SUCCESS;
    }
    return NodeStatus.FAILURE;
  }
}

// export class BTActionLookAtTarget extends BTAction {}

export class BTSucceedImmediately extends BTSimpleAction {
  public static readonly nodeName = 'Мгновенный успех';
  public static readonly description = 'Ничего не делает и сразу возвращает SUCCESS';

  protected onTick(ctx: EntityAdapter): NodeStatus {
    return NodeStatus.SUCCESS;
  }
}

export class BTWait extends BTAction {
  public static readonly nodeName = 'Ожидание времени';
  public static readonly description = 'Ждёт заданное количество секунд и возвращает SUCCESS';
  public static readonly defaultParams = { duration: 1 };

  private startTime: number = 0;
  private params: typeof BTWait.defaultParams;

  constructor(params?: Partial<typeof BTWait.defaultParams>) {
    super();
    this.params = { ...BTWait.defaultParams, ...params };
  }

  protected onOpen(ctx: EntityAdapter): void {
    this.startTime = ctx.brain!.blackboard.get('localTime') ?? 0;
  }

  protected onTick(ctx: EntityAdapter): NodeStatus {
    const currentTime = ctx.brain!.blackboard.get('localTime') ?? 0;
    if (currentTime - this.startTime >= this.params.duration) {
      return NodeStatus.SUCCESS;
    }
    return NodeStatus.RUNNING;
  }

  protected stopAction(ctx: EntityAdapter): void {}
}

export class BTActionRotateToPos extends BTAction {
  public static readonly nodeName = 'Повернуться к позиции';
  public static readonly description = 'Плавный поворот к указанной точке из блекборда';
  public static readonly defaultParams = { tolerance: LOGIC_CONFIG.angleDiffTolerance };

  private params: typeof BTActionRotateToPos.defaultParams;

  constructor(params?: Partial<typeof BTActionRotateToPos.defaultParams>) {
    super();
    this.params = { ...BTActionRotateToPos.defaultParams, ...params };
  }

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const targetId = bb.get('targetId');
    if (targetId === undefined) return NodeStatus.FAILURE;

    const target = entity.utils.getEntity(targetId);
    const targetPos = target?.getPos();
    if (!targetPos) return NodeStatus.FAILURE;

    const selfPos = entity.getPos();
    const dx = targetPos.x - selfPos.x;
    const dy = targetPos.y - selfPos.y;

    if (dx === 0 && dy === 0) return NodeStatus.SUCCESS;

    const targetAngle = Math.atan2(dy, dx);
    const currentAngle = entity.angle;

    // Нормализация разницы углов в диапазон [-PI, PI]
    let diff = targetAngle - currentAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    // Если угол в пределах погрешности — завершаем поворот
    if (Math.abs(diff) <= this.params.tolerance) {
      entity.stopTurning();
      return NodeStatus.SUCCESS;
    }

    const direction: -1 | 1 = diff > 0 ? 1 : -1;

    // Вычисляем ratio (долю скорости) на основе оставшегося угла.
    // Чем ближе к цели, тем ниже скорость поворота (плавное замедление),
    // но держим минимальный порог, чтобы бот гарантированно докрутился.
    let ratio = Math.min(1, Math.abs(diff) / LOGIC_CONFIG.slowDownAngle);
    ratio = Math.max(LOGIC_CONFIG.minRotationSpeed, ratio);

    entity.startTurning(direction, ratio);

    return NodeStatus.RUNNING;
  }

  protected stopAction(entity: EntityAdapter): void {
    entity.stopTurning();
  }
}

export class BTActionStopTurn extends BTSimpleAction {
  public static readonly nodeName = 'Остановить поворот';
  public static readonly description = 'Останавливает вращение бота';

  protected onTick(entity: EntityAdapter): NodeStatus {
    entity.stopTurning();
    return NodeStatus.SUCCESS;
  }

  protected stopAction(entity: EntityAdapter): void {}
}

export class BTActionFollowPathSmooth extends BTAction {
  public static readonly nodeName = 'Двигаться по пути (плавно)';
  public static readonly description =
    'Двигаться по пути currentPath с одновременным плавным поворотом';

  constructor(private pathKey: PathKeys = 'currentPath') {
    super();
  }

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const path = bb.get(this.pathKey) || [];

    if (path.length === 0) {
      entity.stop();
      return NodeStatus.SUCCESS;
    }

    const selfPos = entity.getPos();
    while (path.length > 0 && this.getDist(selfPos, path[0]) <= LOGIC_CONFIG.inPosDist) {
      path.shift();
    }

    if (path.length === 0) {
      entity.stop();
      bb.remove(this.pathKey);
      return NodeStatus.SUCCESS;
    }

    // Расчет вектора и угла к следующей путевой точке
    const target = path[0];
    const dx = target.x - selfPos.x;
    const dy = target.y - selfPos.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 0.001) {
      entity.setDesiredMoveVector({ x: dx / dist, y: dy / dist });
      const targetAngle = Math.atan2(dy, dx) as Radians;
      entity.setTargetLookAngle(targetAngle);
    } else {
      entity.stop();
    }

    return NodeStatus.RUNNING;
  }

  private getDist(p1: Point, p2: Point): number {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
  }

  protected stopAction(entity: EntityAdapter): void {
    entity.stop();
  }
}
