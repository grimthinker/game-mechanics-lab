import { BTService, BTNode, NodeStatus } from './core';
import { LOGIC_CONFIG } from './config';
import { Point, Vec3 } from '../types';
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

    const range = bb.get('detectDist') ?? LOGIC_CONFIG.detectDist;
    const rangeSq = bb.get('detectDistSq') ?? range * range;
    const loseDist = bb.get('loseTargetDist') ?? LOGIC_CONFIG.loseTargetDist;
    const loseDistSq = bb.get('loseTargetDistSq') ?? loseDist * loseDist;

    // При полной слепоте и глухоте (все органы чувств уничтожены) цель не может быть обнаружена или удерживаться
    if (range <= 0) {
      bb.remove('targetId');
      bb.remove('bestCandidateId');
      return;
    }

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
        const dz = targetPos.z - selfPos.z;
        const distSq = dx * dx + dz * dz;

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

      const dz = targetPos.z - selfPos.z;
      if (dz > range || dz < -range) continue;

      const distSq = dx * dx + dz * dz;

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
  private lastStartPos: Vec3 = { x: 0, y: 0, z: 0 };
  private lastTargetPos: Vec3 = { x: 0, y: 0, z: 0 };

  private readonly pushedDistanceSq: number;

  public static readonly nodeName = 'Обновление пути';
  public static readonly description =
    'Периодически пересчитывает путь до цели через навигационную сетку и сохраняет его в blackboard';

  public static readonly defaultParams = {
    ...BTService.defaultParams,
    interval: 0.1,
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
      const dz = targetPos.z - selfPos.z;
      const distSq = dx * dx + dz * dz;

      this.updatePathingLogic(entity, selfPos, targetPos, distSq);
    }
  }

  private updatePathingLogic(
    entity: EntityAdapter,
    selfPos: Vec3,
    targetPos: Vec3,
    distSq: number
  ) {
    if (this.isRequesting) return;

    let shouldRequest = false;

    const currentPath = entity.brain!.blackboard.get('currentPath');
    if (!currentPath || currentPath.length === 0) {
      shouldRequest = true;
    }

    const pdx = selfPos.x - this.lastStartPos.x;
    const pdz = selfPos.z - this.lastStartPos.z;

    if (pdx * pdx + pdz * pdz > this.pushedDistanceSq) {
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
      const tdz = targetPos.z - this.lastTargetPos.z;

      if (tdx * tdx + tdz * tdz > currentThreshold * currentThreshold) {
        shouldRequest = true;
      }
    }

    if (shouldRequest) {
      this.isRequesting = true;
      this.requestTimer = 0;
      this.lastStartPos = { x: selfPos.x, y: selfPos.y, z: selfPos.z };
      this.lastTargetPos = { x: targetPos.x, y: targetPos.y, z: targetPos.z };
      const pathPromise = entity.utils.getPath(selfPos, targetPos, entity.radius);
      this.handlePathPromise(entity, pathPromise);
    }
  }

  private handlePathPromise(entity: EntityAdapter, promise: Promise<Vec3[]>) {
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

import { NodeBBSchema } from './schema';

export class BTServiceSyncStats extends BTService {
  public static readonly nodeName = 'Синхронизация параметров';
  public static readonly description =
    'Регулярно переносит актуальные боевые и поведенческие характеристики из ECS-компонентов в blackboard существа';
  public static readonly bbSchema: NodeBBSchema = {
    writes: {
      health: { type: 'number', isSystem: true, description: 'Текущее здоровье' },
      maxHealth: { type: 'number', isSystem: true, description: 'Макс. здоровье' },
      pos: { type: 'point', isSystem: true, description: 'Координаты' },
      detectDist: { type: 'number', description: 'Радиус обнаружения' },
      loseTargetDist: { type: 'number', description: 'Дистанция потери цели' },
      followStopDist: { type: 'number', description: 'Остановка до цели' },
      followUpDist: { type: 'number', description: 'Старт преследования' },
      visionFovAngle: { type: 'number', description: 'Угол обзора' },
      visionClarity: { type: 'number', description: 'Четкость зрения' },
      visionMaxDist: { type: 'number', description: 'Дальность зрения' },
      hearingSensitivity: { type: 'number', description: 'Слух' },
      hearingMaxDist: { type: 'number', description: 'Дальность слуха' },
    },
  };

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

    let detectDist = stats.detectDist ?? LOGIC_CONFIG.detectDist;
    let loseTargetDist = stats.loseTargetDist ?? LOGIC_CONFIG.loseTargetDist;

    // Синхронизация данных агрегированных органов чувств
    const perception = entity.perception;
    if (perception) {
      const vDist = perception.visionMaxDistance;
      const hDist = perception.hearingMaxDistance;

      bb.set('visionFovAngle', perception.visionFovAngle);
      bb.set('visionClarity', perception.visionClarity);
      bb.set('visionMaxDist', vDist);
      bb.set('visionMaxDistSq', vDist * vDist);

      bb.set('hearingSensitivity', perception.hearingSensitivity);
      bb.set('hearingMaxDist', hDist);
      bb.set('hearingMaxDistSq', hDist * hDist);

      // Актуализируем эффективную дистанцию обнаружения по максимуму из чувств существа
      const effectiveSenseDist = Math.max(vDist, hDist);
      detectDist = effectiveSenseDist;
      loseTargetDist = effectiveSenseDist > 0 ? effectiveSenseDist * 1.5 : 0;
    }

    bb.set('detectDist', detectDist);
    bb.set('detectDistSq', detectDist * detectDist);
    bb.set('loseTargetDist', loseTargetDist);
    bb.set('loseTargetDistSq', loseTargetDist * loseTargetDist);

    bb.set('health', entity.hp);
    bb.set('maxHealth', entity.maxHp);

    const selfPos = entity.getPos();
    bb.set('pos', { x: selfPos.x, y: selfPos.y, z: selfPos.z });

    const stopDist = stats.followStopDist ?? 2.0;

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
    const input = entity.input;
    if (input) {
      input.desiredMoveVector = null;
      input.moveForward = 0;
      input.moveStrafe = 0;
      input.isMovingForward = false;
      input.isRunning = false;
      input.isSlowWalking = false;
      input.wantsAttack = false;
      input.wantsJump = false;
      input.desiredStance = 'standing';
    }
    super.onAbort(entity);
  }

  protected override onClose(entity: EntityAdapter): void {
    const input = entity.input;
    if (input) {
      input.desiredMoveVector = null;
      input.moveForward = 0;
      input.moveStrafe = 0;
      input.isMovingForward = false;
      input.isRunning = false;
      input.isSlowWalking = false;
      input.wantsAttack = false;
      input.wantsJump = false;
      input.desiredStance = 'standing';
    }
    super.onClose(entity);
  }

  protected tickService(entity: EntityAdapter): void {
    const input = entity.input;
    if (!input || !entity.isAlive) return;

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

      // Проекция намерения движения относительно направления курсора в плоскости XZ:
      // W/S — вдоль линии прицеливания (cosA, sinA)
      // D/A — перпендикулярно вправо (-sinA, cosA)
      const dirX = forwardIntent * cosA - strafeIntent * sinA;
      const dirZ = forwardIntent * sinA + strafeIntent * cosA;
      const len = Math.hypot(dirX, dirZ);

      input.desiredMoveVector = { x: dirX / len, z: dirZ / len };
      input.moveForward = forwardIntent !== 0 ? (Math.sign(forwardIntent) as -1 | 1) : 0;
      input.moveStrafe = strafeIntent !== 0 ? (Math.sign(strafeIntent) as -1 | 1) : 0;
      input.isMovingForward = forwardIntent > 0;
    } else {
      input.desiredMoveVector = null;
      input.moveForward = 0;
      input.moveStrafe = 0;
      input.isMovingForward = false;
    }

    input.isRunning = keysSet.has('shift');
    input.isSlowWalking = keysSet.has('x');

    if (keysSet.has('v')) {
      input.desiredStance = 'prone';
      input.isCrouching = false;
    } else if (keysSet.has('c')) {
      input.desiredStance = 'crouching';
      input.isCrouching = true;
    } else {
      input.desiredStance = 'standing';
      input.isCrouching = false;
    }

    input.wantsAttack = keysSet.has('f');
    input.wantsJump = keysSet.has(' ');
  }
}
