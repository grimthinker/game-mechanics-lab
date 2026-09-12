import { BTService, BTNode, NodeStatus } from './core';
import { LOGIC_CONFIG } from './config';
import { Point } from '../types';
import { EntityAdapter } from '../EntityAdapter';
import { GlobalInput } from '../input/GlobalInput';

export class BTServiceFindNearestTarget extends BTService {
  public static readonly nodeName = 'Поиск ближайшей цели';
  public static readonly description =
    'Периодически сканирует окружающих сущностей, проверяет текущую цель на потерю видимости и записывает лучшего кандидата в blackboard';

  public static readonly defaultParams = {
    ...BTService.defaultParams,
  };

  protected override params: typeof BTServiceFindNearestTarget.defaultParams = {
    interval: LOGIC_CONFIG.findNewTargetInterval,
  };

  constructor(child: BTNode, params?: Partial<typeof BTServiceFindNearestTarget.defaultParams>) {
    super(child, params);
    this.params = { ...BTServiceFindNearestTarget.defaultParams, ...params };
  }

  protected tickService(entity: EntityAdapter): void {
    const bb = entity.brain!.blackboard;

    const range = bb.get('detectDist') ?? 400;
    const rangeSq = bb.get('detectDistSq') ?? range * range;
    const loseDist = bb.get('loseTargetDist') ?? 600;
    const loseDistSq = bb.get('loseTargetDistSq') ?? loseDist * loseDist;

    const currentTargetId = bb.get('targetId');
    if (currentTargetId !== undefined && currentTargetId !== null) {
      const target = entity.utils.getEntity(currentTargetId);

      let shouldLose = false;
      if (!target || !target.isAlive) {
        shouldLose = true;
      } else {
        const selfPos = entity.getPos();
        const targetPos = target.getPos();
        const dx = targetPos.x - selfPos.x;
        const dy = targetPos.y - selfPos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > loseDistSq) {
          shouldLose = true;
        }
      }

      if (shouldLose) {
        bb.remove('targetId');
      } else {
        return;
      }
    }

    const entities = entity.utils.getAllEntities();

    let nearestId: string | null = null;
    let minDistSq = rangeSq;

    for (const e of entities) {
      if (entity.id === e.id) continue;
      if (!e.isAlive) continue;

      const selfPos = entity.getPos();
      const targetPos = e.getPos();

      const dx = targetPos.x - selfPos.x;
      if (dx > range || dx < -range) continue;

      const dy = targetPos.y - selfPos.y;
      if (dy > range || dy < -range) continue;

      const distSq = dx * dx + dy * dy;

      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearestId = e.id;
      }
    }

    if (nearestId !== null) {
      bb.set('bestCandidateId', nearestId);
    }
  }
}

export class BTServicePathUpdater extends BTService {
  private isRequesting = false;
  private requestTimer = 999;
  private lastStartPos: Point = { x: 0, y: 0 };
  private lastTargetPos: Point = { x: 0, y: 0 };

  private readonly pushedDistanceSq: number;

  public static readonly nodeName = 'Обновление пути';
  public static readonly description =
    'Периодически пересчитывает путь до цели через навигационную сетку и сохраняет его в blackboard';

  public static readonly defaultParams = {
    ...BTService.defaultParams,
    ...LOGIC_CONFIG.pathUpdaterParams,
  };

  protected override params: typeof BTServicePathUpdater.defaultParams;

  constructor(child: BTNode, params?: Partial<typeof BTServicePathUpdater.defaultParams>) {
    super(child, params);
    this.params = { ...BTServicePathUpdater.defaultParams, ...params };
    this.pushedDistanceSq = this.params.pushedDistance ** 2;
  }

  protected override onTick(entity: EntityAdapter): NodeStatus {
    this.requestTimer += entity.dt;
    return super.onTick(entity);
  }

  protected tickService(entity: EntityAdapter): void {
    const bb = entity.brain!.blackboard;

    if (bb.get('isEngaged')) return;

    const targetId = bb.get('targetId');
    if (targetId === undefined) return;

    const target = entity.utils.getEntity(targetId);

    if (target) {
      const selfPos = entity.getPos();
      const targetPos = target.getPos();
      const dx = targetPos.x - selfPos.x;
      const dy = targetPos.y - selfPos.y;
      const distSq = dx * dx + dy * dy;

      this.updatePathingLogic(entity, selfPos, targetPos, distSq);
    }
  }

  private updatePathingLogic(
    entity: EntityAdapter,
    selfPos: Point,
    targetPos: Point,
    distSq: number
  ) {
    if (this.isRequesting) return;

    let shouldRequest = false;

    const pdx = selfPos.x - this.lastStartPos.x;
    const pdy = selfPos.y - this.lastStartPos.y;
    if (pdx * pdx + pdy * pdy > this.pushedDistanceSq) {
      shouldRequest = true;
    }

    const dist = Math.sqrt(distSq);
    const t = Math.min(dist / this.params.maxDistanceCalc, 1.0);
    const currentInterval =
      this.params.minIntervalDt + t * (this.params.maxIntervalDt - this.params.minIntervalDt);

    if (this.requestTimer >= currentInterval) {
      const currentThreshold =
        this.params.minTargetMoveThreshold +
        t * (this.params.maxTargetMoveThreshold - this.params.minTargetMoveThreshold);
      const tdx = targetPos.x - this.lastTargetPos.x;
      const tdy = targetPos.y - this.lastTargetPos.y;

      if (tdx * tdx + tdy * tdy > currentThreshold * currentThreshold) {
        shouldRequest = true;
      }
    }

    if (shouldRequest) {
      this.isRequesting = true;
      this.requestTimer = 0;
      this.lastStartPos = { ...selfPos };
      this.lastTargetPos = { ...targetPos };
      const pathPromise = entity.utils.getPath(selfPos, targetPos, entity.radius);
      this.handlePathPromise(entity, pathPromise);
    }
  }

  private handlePathPromise(entity: EntityAdapter, promise: Promise<Point[]>) {
    promise
      .then((newPath) => {
        this.isRequesting = false;
        if (newPath) entity.brain!.blackboard.set('currentPath', newPath);
      })
      .catch(() => {
        this.isRequesting = false;
      });
  }
}

export class BTServiceSyncStats extends BTService {
  public static readonly nodeName = 'Синхронизация параметров';
  public static readonly description =
    'Регулярно переносит актуальные боевые и поведенческие характеристики из ECS-компонентов в blackboard существа';

  public static readonly defaultParams = {
    ...BTService.defaultParams,
  };

  protected override params: typeof BTServiceSyncStats.defaultParams;

  constructor(child: BTNode, params?: Partial<typeof BTServiceSyncStats.defaultParams>) {
    super(child, params);
    this.params = { ...BTServiceSyncStats.defaultParams, ...params };
  }

  protected tickService(entity: EntityAdapter): void {
    const stats = entity.aiStats;
    const bb = entity.brain!.blackboard;

    const detectDist = stats.detectDist ?? 400;
    const loseTargetDist = stats.loseTargetDist ?? 600;
    bb.set('detectDist', detectDist);
    bb.set('detectDistSq', detectDist * detectDist);
    bb.set('loseTargetDist', loseTargetDist);
    bb.set('loseTargetDistSq', loseTargetDist * loseTargetDist);

    bb.set('health', entity.hp);
    bb.set('maxHealth', entity.maxHp);

    const selfPos = entity.getPos();
    bb.set('pos', { x: selfPos.x, y: selfPos.y });

    const stopDist = stats.followStopDist ?? 40;

    bb.set('followStopDist', stopDist);
    bb.set('followUpDist', stopDist + 10);
  }
}

export class BTServiceInputListener extends BTService {
  public static readonly nodeName = 'Слушатель ввода';
  public static readonly description = 'Слушает глобальный ввод и пишет нажатые клавиши в память';

  public static readonly defaultParams = { interval: 0 };
  protected override params: typeof BTServiceInputListener.defaultParams = { interval: 0 };

  constructor(child: BTNode, params?: Partial<typeof BTServiceInputListener.defaultParams>) {
    super(child, params);
    this.params = { ...BTServiceInputListener.defaultParams, ...params };
  }

  protected override onOpen(entity: EntityAdapter): void {
    super.onOpen(entity);
    const bb = entity.brain?.blackboard;
    if (bb) {
      if (GlobalInput.keys.size > 0) {
        bb.set('pressedKeys', Array.from(GlobalInput.keys));
      } else {
        bb.remove('pressedKeys');
      }
    }
  }

  protected override onAbort(entity: EntityAdapter): void {
    entity.brain?.blackboard.remove('pressedKeys');
    super.onAbort(entity);
  }

  protected override onClose(entity: EntityAdapter): void {
    entity.brain?.blackboard.remove('pressedKeys');
    super.onClose(entity);
  }

  protected tickService(entity: EntityAdapter): void {
    const bb = entity.brain?.blackboard;
    if (!bb) return;
    if (GlobalInput.keys.size > 0) {
      bb.set('pressedKeys', Array.from(GlobalInput.keys));
    } else {
      bb.remove('pressedKeys');
    }
  }
}

export class BTServiceInputController extends BTService {
  public static readonly nodeName = 'Контроллер ввода';
  public static readonly description =
    'Читает нажатые клавиши из памяти и управляет input компонентом';

  public static readonly defaultParams = { interval: 0 };
  protected override params: typeof BTServiceInputController.defaultParams = { interval: 0 };

  constructor(child: BTNode, params?: Partial<typeof BTServiceInputController.defaultParams>) {
    super(child, params);
    this.params = { ...BTServiceInputController.defaultParams, ...params };
  }

  protected override onAbort(entity: EntityAdapter): void {
    entity.setDesiredMoveVector(null);
    entity.stop();
    entity.stopRunning();
    entity.stopWalking();
    entity.stopCrouching();
    super.onAbort(entity);
  }

  protected override onClose(entity: EntityAdapter): void {
    entity.setDesiredMoveVector(null);
    entity.stop();
    entity.stopRunning();
    entity.stopWalking();
    entity.stopCrouching();
    super.onClose(entity);
  }

  protected tickService(entity: EntityAdapter): void {
    const bb = entity.brain?.blackboard;
    const keys = bb?.get('pressedKeys') || [];
    const keysSet = new Set(keys);

    // Линия прицеливания (направление на курсор мыши либо текущий угол корпуса)
    const aimAngle = entity.targetLookAngle ?? entity.angle;

    let forwardIntent = 0;
    if (keysSet.has('w')) forwardIntent += 1;
    if (keysSet.has('s')) forwardIntent -= 1;

    let strafeIntent = 0;
    if (keysSet.has('d')) strafeIntent += 1;
    if (keysSet.has('a')) strafeIntent -= 1;

    if (forwardIntent !== 0 || strafeIntent !== 0) {
      const cosA = Math.cos(aimAngle);
      const sinA = Math.sin(aimAngle);

      // Проекция намерения движения относительно направления курсора:
      // W/S — вдоль линии прицеливания (cosA, sinA)
      // D/A — перпендикулярно вправо (-sinA, cosA)
      const dirX = forwardIntent * cosA - strafeIntent * sinA;
      const dirY = forwardIntent * sinA + strafeIntent * cosA;
      const len = Math.hypot(dirX, dirY);

      entity.setDesiredMoveVector({ x: dirX / len, y: dirY / len });
    } else {
      entity.setDesiredMoveVector(null);
    }

    if (keysSet.has('shift')) {
      entity.startRunning();
    } else {
      entity.stopRunning();
    }

    if (keysSet.has('x')) {
      entity.startWalking();
    } else {
      entity.stopWalking();
    }

    if (keysSet.has('c')) {
      entity.startCrouching();
    } else {
      entity.stopCrouching();
    }

    if (keysSet.has(' ')) {
      entity.attack();
    }
  }
}
