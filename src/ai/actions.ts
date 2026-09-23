import { EntityAdapter } from '../EntityAdapter';
import { Point } from '../types';
import { vec2_distance_to, Radians } from '../utils';
import { LOGIC_CONFIG } from './config';
import { NodeStatus, BTAction, PathKeys, BTSimpleAction } from './core';

import { NodeBBSchema } from './schema';

export class BTConditionValidTarget extends BTSimpleAction {
  public static readonly nodeName = 'Проверка валидности цели';
  public static readonly description = 'Проверяет, что цель валидна';
  public static readonly bbSchema: NodeBBSchema = {
    reads: { targetId: { type: 'entityId', description: 'Идентификатор цели' } },
    writes: {
      targetId: { type: 'entityId', description: 'Сброс цели при потере' },
      isEngaged: { type: 'boolean', description: 'Сброс состояния боя' },
    },
  };

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
  public static readonly bbSchema: NodeBBSchema = {
    reads: {
      targetId: { type: 'entityId' },
      currentPath: { type: 'path' },
    },
  };

  protected onTick(entity: EntityAdapter): NodeStatus {
    const bb = entity.brain!.blackboard;
    const targetId = bb.get('targetId');
    if (targetId === undefined) return NodeStatus.FAILURE;

    const target = entity.utils.getEntity(targetId);
    const targetPos = target?.getPos();

    if (!targetPos) return NodeStatus.FAILURE;

    const selfPos = entity.getPos();
    const dx = targetPos.x - selfPos.x;
    const dz =
      (targetPos as any).z !== undefined && (selfPos as any).z !== undefined
        ? (targetPos as any).z - (selfPos as any).z
        : targetPos.y - selfPos.y;

    const input = entity.input;

    if (dx * dx + dz * dz <= this.stopDistSq) {
      if (input) {
        input.desiredMoveVector = null;
        input.moveForward = 0;
        input.moveStrafe = 0;
        input.isMovingForward = false;
        input.turnDirection = 0;
        input.turnRatio = 0;
        input.targetLookAngle = undefined;
      }
      return NodeStatus.SUCCESS;
    }

    const path = bb.get('currentPath');
    if (path && path.length > 0) {
      this.movementNode.tick(entity);
    } else {
      const dist = Math.hypot(dx, dz);
      if (dist > 0.001 && input && entity.isAlive) {
        input.desiredMoveVector = { x: dx / dist, y: dz / dist };
        input.targetLookAngle = Math.atan2(dz, dx) as Radians;
      } else if (input) {
        input.desiredMoveVector = null;
        input.moveForward = 0;
        input.moveStrafe = 0;
        input.isMovingForward = false;
      }
    }

    return NodeStatus.RUNNING;
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
    const input = entity.input;
    if (input && entity.isAlive) {
      input.desiredMoveVector = null;
      input.moveForward = 0;
      input.moveStrafe = 0;
      input.isMovingForward = false;
      input.wantsAttack = true;
      input.attackSlotIndex = this.params.slotIndex;
    }
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
    const input = entity.input;
    if (input) {
      input.wantsAttack = false;
      input.attackSlotIndex = undefined;
    }
    const activeAttacks = entity.activeAttacks;
    if (activeAttacks) {
      if (this.params.slotIndex !== undefined) {
        activeAttacks.attacks = activeAttacks.attacks.filter(
          (a) => a.slotIndex !== this.params.slotIndex
        );
      } else {
        activeAttacks.attacks = [];
      }
    }
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
    const input = entity.input;
    if (input) {
      input.desiredMoveVector = null;
      input.moveForward = 0;
      input.moveStrafe = 0;
      input.isMovingForward = false;
      input.turnDirection = 0;
      input.turnRatio = 0;
      input.targetLookAngle = undefined;
    }
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
    const dz =
      (targetPos as any).z !== undefined && (selfPos as any).z !== undefined
        ? (targetPos as any).z - (selfPos as any).z
        : targetPos.y - selfPos.y;

    if (dx === 0 && dz === 0) return NodeStatus.SUCCESS;

    const dist = Math.hypot(dx, dz);
    // Если цель отдалилась за пределы дистанции боя — прерываем поворот и возвращаем FAILURE
    if (dist > LOGIC_CONFIG.followUpDist) {
      bb.set('isEngaged', false);
      this.stopAction(entity);
      return NodeStatus.FAILURE;
    }

    const targetAngle = Math.atan2(dz, dx) as Radians;
    const currentAngle = entity.angle;

    // Нормализация разницы углов в диапазон [-PI, PI]
    let diff = targetAngle - currentAngle;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    // Если угол в пределах погрешности — завершаем поворот
    if (Math.abs(diff) <= this.params.tolerance) {
      this.stopAction(entity);
      return NodeStatus.SUCCESS;
    }

    // Задаем угол направления взгляда напрямую в InputComponent для VelocitySystem
    if (entity.input && entity.isAlive) {
      entity.input.targetLookAngle = targetAngle;
    }

    return NodeStatus.RUNNING;
  }

  protected stopAction(entity: EntityAdapter): void {
    if (entity.input) {
      entity.input.targetLookAngle = undefined;
      entity.input.turnDirection = 0;
      entity.input.turnRatio = 0;
    }
  }
}

export class BTActionStopTurn extends BTSimpleAction {
  public static readonly nodeName = 'Остановить поворот';
  public static readonly description = 'Останавливает вращение бота';

  protected onTick(entity: EntityAdapter): NodeStatus {
    if (entity.input) {
      entity.input.turnDirection = 0;
      entity.input.turnRatio = 0;
      entity.input.targetLookAngle = undefined;
    }
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
    const input = entity.input;

    if (path.length === 0) {
      if (input) {
        input.desiredMoveVector = null;
        input.moveForward = 0;
        input.moveStrafe = 0;
        input.isMovingForward = false;
      }
      return NodeStatus.SUCCESS;
    }

    const selfPos = entity.getPos();
    while (path.length > 0 && this.getDist(selfPos, path[0]) <= LOGIC_CONFIG.inPosDist) {
      path.shift();
    }

    if (path.length === 0) {
      if (input) {
        input.desiredMoveVector = null;
        input.moveForward = 0;
        input.moveStrafe = 0;
        input.isMovingForward = false;
      }
      bb.remove(this.pathKey);
      return NodeStatus.SUCCESS;
    }

    // Расчет вектора и угла к следующей путевой точке по плоскости XZ
    const target = path[0];
    const dx = target.x - selfPos.x;
    const dz =
      (target as any).z !== undefined && (selfPos as any).z !== undefined
        ? (target as any).z - (selfPos as any).z
        : target.y - selfPos.y;
    const dist = Math.hypot(dx, dz);

    if (dist > 0.001 && input && entity.isAlive) {
      input.desiredMoveVector = { x: dx / dist, y: dz / dist };
      input.targetLookAngle = Math.atan2(dz, dx) as Radians;
    } else if (input) {
      input.desiredMoveVector = null;
      input.moveForward = 0;
      input.moveStrafe = 0;
      input.isMovingForward = false;
    }

    return NodeStatus.RUNNING;
  }

  private getDist(
    p1: { x: number; y: number; z?: number },
    p2: { x: number; y: number; z?: number }
  ): number {
    const dx = p2.x - p1.x;
    const dz = p2.z !== undefined && p1.z !== undefined ? p2.z - p1.z : p2.y - p1.y;
    return Math.hypot(dx, dz);
  }

  protected stopAction(entity: EntityAdapter): void {
    if (entity.input) {
      entity.input.desiredMoveVector = null;
      entity.input.moveForward = 0;
      inputMoveStrafe(entity.input);
    }
  }
}

function inputMoveStrafe(input: import('../ecs/types').InputComponent) {
  input.moveStrafe = 0;
  input.isMovingForward = false;
}

export class BTAlwaysRunning extends BTAction {
  public static readonly nodeName = 'Постоянное выполнение';
  public static readonly description = 'Всегда возвращает RUNNING, удерживая сервисы активными';

  protected onTick(_ctx: EntityAdapter): NodeStatus {
    return NodeStatus.RUNNING;
  }
  protected stopAction(_ctx: EntityAdapter): void {}
}
