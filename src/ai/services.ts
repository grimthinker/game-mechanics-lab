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
import { getAggregatedInteractionSlots } from '../ecs/utils/hierarchy';
import { getTerrainHeightAt } from '../ecs/types';

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
      input.attackSlotIndex = undefined;
      input.attackSlotKind = undefined;
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
      input.attackSlotIndex = undefined;
      input.attackSlotKind = undefined;
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

    if (keysSet.has('f')) {
      input.wantsAttack = true;
      input.attackSlotKind = 'right_hand';
    } else if (keysSet.has('g')) {
      input.wantsAttack = true;
      input.attackSlotKind = 'left_hand';
    } else {
      input.wantsAttack = false;
      input.attackSlotKind = undefined;
    }

    input.wantsJump = keysSet.has(' ');
  }
}

export class BTServiceEnforceWalkMode extends BTService {
  public static readonly nodeName = 'Принудительный шаг';
  public static readonly description =
    'Всегда держит режим ходьбы (isSlowWalking = true, isRunning = false)';
  public static readonly defaultParams = { interval: 0 };
  protected override params = { interval: 0 };

  constructor(child: BTNode, params?: Partial<typeof BTServiceEnforceWalkMode.defaultParams>) {
    super(child, params);
    this.params = { ...BTServiceEnforceWalkMode.defaultParams, ...params };
  }

  protected tickService(entity: EntityAdapter): void {
    if (entity.input) {
      entity.input.isSlowWalking = true;
      entity.input.isRunning = false;
    }
  }
}

export class BTServiceFetchMasterWatcher extends BTService {
  public static readonly nodeName = 'Наблюдение хозяина за апортом';
  public static readonly description =
    'Отслеживает палки в руках, принесенные палки на земле, собак и границы зоны игры';

  public static readonly bbSchema: NodeBBSchema = {
    reads: {
      dogIds: { type: 'any', description: 'Список ID привязанных собак' },
      playZoneCenter: { type: 'point', description: 'Центр зоны игры' },
      playZoneRadius: { type: 'number', description: 'Радиус зоны игры' },
      dogFollowDistance: { type: 'number', description: 'Дистанция старта следования за собакой' },
      detectDist: { type: 'number', description: 'Радиус восприятия' },
    },
    writes: {
      playZoneCenter: { type: 'point', description: 'Центр зоны игры' },
      isOutsidePlayZone: { type: 'boolean', description: 'Хозяин за пределами зоны игры' },
      heldStickCount: { type: 'number', description: 'Количество удерживаемых палок' },
      freeSlotCount: { type: 'number', description: 'Количество свободных слотов' },
      nearestDeliveredStickId: { type: 'entityId', description: 'Ближайшая доставленная палка' },
      shouldThrow: { type: 'boolean', description: 'Пора бросать палку' },
      hasReadyDogNearby: { type: 'boolean', description: 'Рядом есть свободная собака' },
      isAnyDogTooFar: { type: 'boolean', description: 'Собака убежала далеко' },
      priorityDogId: { type: 'entityId', description: 'Приоритетная собака' },
      isReadyToThrow: { type: 'boolean', description: 'Готовность к броску' },
      canThrowNow: { type: 'boolean', description: 'Возможность бросить прямо сейчас' },
    },
  };

  public static readonly defaultParams = {
    ...BTService.defaultParams,
    interval: 0.1,
    throwCooldown: 3.0,
    dogFollowDistance: 20.0,
  };

  protected override params: typeof BTServiceFetchMasterWatcher.defaultParams;

  constructor(child: BTNode, params?: Partial<typeof BTServiceFetchMasterWatcher.defaultParams>) {
    super(child, params);
    this.params = { ...BTServiceFetchMasterWatcher.defaultParams, ...params };
  }

  protected override onOpen(entity: EntityAdapter): void {
    super.onOpen(entity);
    this.tickService(entity);
  }

  protected tickService(entity: EntityAdapter): void {
    const bb = entity.brain!.blackboard;
    const selfPos = entity.getPos();

    let playZoneCenter = bb.get<Vec3>('playZoneCenter');
    if (!playZoneCenter) {
      playZoneCenter = { ...selfPos };
      bb.set('playZoneCenter', playZoneCenter);
    }

    const distToCenter = Math.hypot(selfPos.x - playZoneCenter.x, selfPos.z - playZoneCenter.z);
    bb.set('isOutsidePlayZone', distToCenter > 15.0);

    const aggSlots = getAggregatedInteractionSlots(entity.world, entity.id);
    const heldSticks = aggSlots.filter((s) => {
      if (s.isBroken || !s.slot.itemId) return false;
      return entity.world.getComponent(s.slot.itemId, 'fetchStick') !== undefined;
    });
    const freeSlots = aggSlots.filter((s) => !s.isBroken && s.slot.itemId === null);

    bb.set('heldStickCount', heldSticks.length);
    bb.set('freeSlotCount', freeSlots.length);

    const detectDist = bb.get<number>('detectDist') || LOGIC_CONFIG.detectDist;
    const deliveredStickEntities = entity.world.getEntitiesWith('fetchStick', 'transform');

    let nearestDeliveredId: string | null = null;
    let minStickDist = detectDist;

    for (const [sId, comps] of deliveredStickEntities) {
      if (comps.fetchStick.ownerMasterId !== entity.id) continue;
      if (comps.fetchStick.state !== 'delivered') continue;
      if (entity.world.getComponent(sId, 'ownership')) continue;

      const d = Math.hypot(comps.transform.x - selfPos.x, comps.transform.z - selfPos.z);
      if (d <= minStickDist) {
        minStickDist = d;
        nearestDeliveredId = sId;
      }
    }

    if (nearestDeliveredId) {
      bb.set('nearestDeliveredStickId', nearestDeliveredId);
    } else {
      bb.remove('nearestDeliveredStickId');
    }

    const shouldThrow = heldSticks.length > 0 && (freeSlots.length === 0 || !nearestDeliveredId);
    bb.set('shouldThrow', shouldThrow);

    const dogIds = bb.get<string[]>('dogIds') || [];
    let hasReadyDogNearby = false;
    let isAnyDogTooFar = false;
    let priorityDogId: string | null = null;
    let maxDistFromCenter = -1;

    const followDistanceThreshold =
      bb.get<number>('dogFollowDistance') ?? this.params.dogFollowDistance;

    for (const dId of dogIds) {
      const dog = entity.utils.getEntity(dId);
      if (!dog || !dog.isAlive) continue;

      const dPos = dog.getPos();
      const distToMaster = Math.hypot(dPos.x - selfPos.x, dPos.z - selfPos.z);
      const distFromCenter = Math.hypot(dPos.x - playZoneCenter.x, dPos.z - playZoneCenter.z);

      const dogSlots = getAggregatedInteractionSlots(entity.world, dId);
      const dogHasItem = dogSlots.some((s) => s.slot.itemId !== null);

      if (distToMaster <= 6.0 && !dogHasItem) {
        hasReadyDogNearby = true;
      }

      if (distToMaster > followDistanceThreshold) {
        isAnyDogTooFar = true;
      }

      const dogHoldsStick = dogSlots.some((s) => {
        if (!s.slot.itemId) return false;
        const stick = entity.world.getComponent(s.slot.itemId, 'fetchStick');
        return stick?.state === 'held_by_dog';
      });

      if (dogHoldsStick) {
        priorityDogId = dId;
      } else if (!priorityDogId && distFromCenter > maxDistFromCenter) {
        maxDistFromCenter = distFromCenter;
        priorityDogId = dId;
      }
    }

    bb.set('hasReadyDogNearby', hasReadyDogNearby);
    bb.set('isAnyDogTooFar', isAnyDogTooFar);
    if (priorityDogId) {
      bb.set('priorityDogId', priorityDogId);
    } else {
      bb.remove('priorityDogId');
    }

    const localTime = bb.get<number>('localTime') || 0;
    const lastThrowTime = bb.get<number>('lastThrowTime') || -999;
    const canThrowCooldown = localTime - lastThrowTime >= this.params.throwCooldown;

    const isOutsidePlayZone = bb.get<boolean>('isOutsidePlayZone');
    const isReadyToThrow = shouldThrow && canThrowCooldown && hasReadyDogNearby;
    bb.set('isReadyToThrow', isReadyToThrow);

    const canThrowNow = isReadyToThrow && !isOutsidePlayZone;
    bb.set('canThrowNow', canThrowNow);
  }
}

export class BTServiceFetchWatcher extends BTService {
  public static readonly nodeName = 'Наблюдение собаки за апортом';
  public static readonly description =
    'Следит за брошенными палками хозяина с учетом дальности обнаружения и гистерезиса';

  public static readonly bbSchema: NodeBBSchema = {
    reads: {
      masterEntityId: { type: 'entityId', description: 'ID хозяина' },
      detectDist: { type: 'number', description: 'Радиус обнаружения' },
      playZoneCenter: { type: 'point', description: 'Центр зоны игры' },
    },
    writes: {
      masterEntityId: { type: 'entityId', description: 'ID хозяина' },
      fetchTargetId: { type: 'entityId', description: 'Целевая палка' },
      fetchState: { type: 'string', description: 'Состояние апорта' },
      dogZoneWaitPos: { type: 'point', description: 'Точка ожидания в зоне игры' },
    },
  };

  public static readonly defaultParams = {
    ...BTService.defaultParams,
    interval: 0.1,
    unreachableTimeout: 15.0,
    hysteresisDistance: 3.0,
    retargetCooldown: 0.6,
  };

  private chaseTimer: number = 0;
  private retargetTimer: number = 0;
  private unreachableSticks: Map<string, number> = new Map();

  protected override params: typeof BTServiceFetchWatcher.defaultParams;

  constructor(child: BTNode, params?: Partial<typeof BTServiceFetchWatcher.defaultParams>) {
    super(child, params);
    this.params = { ...BTServiceFetchWatcher.defaultParams, ...params };
  }

  protected override onOpen(entity: EntityAdapter): void {
    super.onOpen(entity);
    this.chaseTimer = 0;
    this.retargetTimer = 0;
    this.unreachableSticks.clear();
    entity.brain!.blackboard.remove('dogZoneWaitPos');
    this.tickService(entity);
  }

  protected tickService(entity: EntityAdapter): void {
    const bb = entity.brain!.blackboard;
    const selfPos = entity.getPos();
    const localTime = bb.get<number>('localTime') || 0;

    this.retargetTimer -= this.params.interval;

    for (const [stickId, expiry] of this.unreachableSticks.entries()) {
      if (localTime >= expiry) {
        this.unreachableSticks.delete(stickId);
      }
    }

    let masterId = bb.get<string>('masterEntityId');
    if (!masterId) {
      const masterEntry = entity.world
        .getEntitiesWith('aiStats', 'health')
        .find(
          ([, comp]) => comp.aiStats.behavior.current === 'MasterFetchTree' && comp.health.isAlive
        );
      if (masterEntry) {
        masterId = masterEntry[0];
        bb.set('masterEntityId', masterId);
      }
    }

    const detectDist = bb.get<number>('detectDist') || LOGIC_CONFIG.detectDist;

    let isMasterSpotted = false;
    if (masterId) {
      const master = entity.utils.getEntity(masterId);
      if (master && master.isAlive) {
        const mPos = master.getPos();
        const distToMaster = Math.hypot(mPos.x - selfPos.x, mPos.z - selfPos.z);
        if (distToMaster <= detectDist) {
          isMasterSpotted = true;
        }
      }
    }

    const aggSlots = getAggregatedInteractionSlots(entity.world, entity.id);
    const heldStickSlot = aggSlots.find((s) => {
      if (!s.slot.itemId) return false;
      const stick = entity.world.getComponent(s.slot.itemId, 'fetchStick');
      return stick !== undefined;
    });
    const hasStickInMouth = !!heldStickSlot;

    if (hasStickInMouth) {
      this.chaseTimer = 0;
      bb.remove('fetchTargetId');
      bb.remove('dogZoneWaitPos');
      if (isMasterSpotted) {
        bb.set('fetchState', 'returning_to_master');
      } else {
        bb.set('fetchState', 'delivering_to_zone');
      }
      return;
    }

    const stickEntities = entity.world.getEntitiesWith('fetchStick', 'transform');
    const validCandidates: { id: string; dist: number }[] = [];

    for (const [sId, comps] of stickEntities) {
      if (masterId && comps.fetchStick.ownerMasterId !== masterId) continue;
      if (comps.fetchStick.state !== 'thrown') continue;
      if (entity.world.getComponent(sId, 'ownership')) continue;
      if (this.unreachableSticks.has(sId)) continue;

      const d = Math.hypot(comps.transform.x - selfPos.x, comps.transform.z - selfPos.z);
      if (d <= detectDist) {
        validCandidates.push({ id: sId, dist: d });
      }
    }

    validCandidates.sort((a, b) => a.dist - b.dist);

    let currentTargetId = bb.get<string | null>('fetchTargetId');
    if (currentTargetId) {
      const targetTrans = entity.world.getComponent(currentTargetId, 'transform');
      const targetStick = entity.world.getComponent(currentTargetId, 'fetchStick');
      const targetOwnership = entity.world.getComponent(currentTargetId, 'ownership');

      const isCurrentStillValid =
        targetTrans &&
        targetStick?.state === 'thrown' &&
        !targetOwnership &&
        !this.unreachableSticks.has(currentTargetId);

      if (!isCurrentStillValid) {
        currentTargetId = null;
        this.chaseTimer = 0;
      } else {
        const curDist = Math.hypot(targetTrans.x - selfPos.x, targetTrans.z - selfPos.z);
        if (curDist > detectDist) {
          currentTargetId = null;
          this.chaseTimer = 0;
        } else if (validCandidates.length > 0 && validCandidates[0].id !== currentTargetId) {
          if (
            this.retargetTimer <= 0 &&
            validCandidates[0].dist < curDist - this.params.hysteresisDistance
          ) {
            currentTargetId = validCandidates[0].id;
            this.retargetTimer = this.params.retargetCooldown;
            this.chaseTimer = 0;
          }
        }
      }
    }

    if (!currentTargetId && validCandidates.length > 0) {
      currentTargetId = validCandidates[0].id;
      this.retargetTimer = this.params.retargetCooldown;
      this.chaseTimer = 0;
    }

    if (currentTargetId) {
      this.chaseTimer += this.params.interval;
      if (this.chaseTimer > this.params.unreachableTimeout) {
        this.unreachableSticks.set(currentTargetId, localTime + 25.0);
        currentTargetId = null;
        this.chaseTimer = 0;
      }
    }

    if (currentTargetId) {
      bb.remove('dogZoneWaitPos');
      bb.set('fetchTargetId', currentTargetId);
      bb.set('fetchState', 'chasing_item');
    } else {
      bb.remove('fetchTargetId');
      if (isMasterSpotted) {
        bb.remove('dogZoneWaitPos');
        bb.set('fetchState', 'following_master');
      } else {
        bb.set('fetchState', 'returning_to_zone');

        // Рассредоточение собак: вычисляем персональную случайную точку в радиусе 3..8м от центра зоны
        if (!bb.has('dogZoneWaitPos')) {
          let playCenter = bb.get<Vec3>('playZoneCenter');
          if (!playCenter) {
            playCenter = { ...selfPos };
          }
          const angle = Math.random() * Math.PI * 2;
          const r = 3.0 + Math.random() * 5.0;
          const wx = playCenter.x + Math.cos(angle) * r;
          const wz = playCenter.z + Math.sin(angle) * r;

          let wy = playCenter.y;
          const terrainEntities = entity.world.getEntitiesWith('terrain');
          if (terrainEntities.length > 0) {
            const h = getTerrainHeightAt(terrainEntities[0][1].terrain, wx, wz);
            if (h !== null) wy = h;
          }
          bb.set('dogZoneWaitPos', { x: wx, y: wy, z: wz });
        }
      }
    }
  }
}
