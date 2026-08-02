import { BTService, BTNode, NodeStatus } from './core';
import { LOGIC_CONFIG } from './config';
import { Point } from '../types';
import { EntityAdapter } from '../EntityAdapter';

export class BTServiceFindNearestTarget extends BTService {
  public static readonly nodeName = 'Поиск ближайшей цели';
  public static readonly description =
    'Периодически сканирует окружающих сущностей, проверяет текущую цель на потерю видимости и записывает лучшего кандидата в blackboard';

  public static readonly defaultParams = {
    ...BTService.defaultParams,
  };

  protected override params: typeof BTServiceFindNearestTarget.defaultParams = {
    interval: LOGIC_CONFIG.min_path_request_interval,
  };

  constructor(
    child: BTNode,
    params?: Partial<typeof BTServiceFindNearestTarget.defaultParams>
  ) {
    super(child, params);
    this.params = { ...BTServiceFindNearestTarget.defaultParams, ...params };
  }

  protected tickService(entity: EntityAdapter): void {
    const bb = entity.brain!.blackboard;

    const range = bb.get('detect_dist') ?? 400;
    const rangeSq = bb.get('detect_dist_sq') ?? range * range;
    const loseDist = bb.get('lose_target_dist') ?? 600;
    const loseDistSq = bb.get('lose_target_dist_sq') ?? loseDist * loseDist;

    const currentTargetId = bb.get('target_id');
    if (currentTargetId !== undefined && currentTargetId !== null) {
      const target = entity.utils.get_entity(currentTargetId);

      let shouldLose = false;
      if (!target || !target.isAlive) {
        shouldLose = true;
      } else {
        const e_pos = entity.getPos();
        const t_pos = target.getPos();
        const dx = t_pos.x - e_pos.x;
        const dy = t_pos.y - e_pos.y;
        const distSq = dx * dx + dy * dy;

        if (distSq > loseDistSq) {
          shouldLose = true;
        }
      }

      if (shouldLose) {
        bb.remove('target_id');
      } else {
        return;
      }
    }

    const entities = entity.utils.get_all_entities();

    let nearest_id: string | null = null;
    let min_dist_sq = rangeSq;

    for (const e of entities) {
      if (entity.id === e.id) continue;
      if (!e.isAlive) continue;

      const e_pos = entity.getPos();
      const t_pos = e.getPos();

      const dx = t_pos.x - e_pos.x;
      if (dx > range || dx < -range) continue;

      const dy = t_pos.y - e_pos.y;
      if (dy > range || dy < -range) continue;

      const dist_sq = dx * dx + dy * dy;

      if (dist_sq < min_dist_sq) {
        min_dist_sq = dist_sq;
        nearest_id = e.id;
      }
    }

    if (nearest_id !== null) {
      bb.set('best_candidate_id', nearest_id);
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
    minIntervalDt: 0.2,
    maxIntervalDt: 2.0,
    maxDistanceCalc: 50,
    pushedDistance: 5,
    minTargetMoveThreshold: 1.0,
    maxTargetMoveThreshold: 10.0,
  };

  protected override params: typeof BTServicePathUpdater.defaultParams;

  constructor(
    child: BTNode,
    params?: Partial<typeof BTServicePathUpdater.defaultParams>
  ) {
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

    if (bb.get('is_engaged')) return;

    const target_id = bb.get('target_id');
    if (target_id === undefined) return;

    const target = entity.utils.get_entity(target_id);

    if (target) {
      const e_pos = entity.getPos();
      const t_pos = target.getPos();
      const dx = t_pos.x - e_pos.x;
      const dy = t_pos.y - e_pos.y;
      const distSq = dx * dx + dy * dy;

      this.updatePathingLogic(entity, e_pos, t_pos, distSq);
    }
  }

  private updatePathingLogic(
    entity: EntityAdapter,
    self_pos: Point,
    target_pos: Point,
    distSq: number
  ) {
    if (this.isRequesting) return;

    let shouldRequest = false;

    const pdx = self_pos.x - this.lastStartPos.x;
    const pdy = self_pos.y - this.lastStartPos.y;
    if (pdx * pdx + pdy * pdy > this.pushedDistanceSq) {
      shouldRequest = true;
    }

    const dist = Math.sqrt(distSq);
    const t = Math.min(dist / this.params.maxDistanceCalc, 1.0);
    const currentInterval =
      this.params.minIntervalDt +
      t * (this.params.maxIntervalDt - this.params.minIntervalDt);

    if (this.requestTimer >= currentInterval) {
      const currentThreshold =
        this.params.minTargetMoveThreshold +
        t *
          (this.params.maxTargetMoveThreshold -
            this.params.minTargetMoveThreshold);
      const tdx = target_pos.x - this.lastTargetPos.x;
      const tdy = target_pos.y - this.lastTargetPos.y;

      if (tdx * tdx + tdy * tdy > currentThreshold * currentThreshold) {
        shouldRequest = true;
      }
    }

    if (shouldRequest) {
      this.isRequesting = true;
      this.requestTimer = 0;
      this.lastStartPos = { ...self_pos };
      this.lastTargetPos = { ...target_pos };
      const path_promise = entity.utils.get_path(
        self_pos,
        target_pos,
        entity.radius
      );
      this.handlePathPromise(entity, path_promise);
    }
  }

  private handlePathPromise(
    entity: EntityAdapter,
    promise: Promise<Point[]>
  ) {
    promise
      .then((new_path) => {
        this.isRequesting = false;
        if (new_path) entity.brain!.blackboard.set('current_path', new_path);
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

  constructor(
    child: BTNode,
    params?: Partial<typeof BTServiceSyncStats.defaultParams>
  ) {
    super(child, params);
    this.params = { ...BTServiceSyncStats.defaultParams, ...params };
  }

  protected tickService(entity: EntityAdapter): void {
    const stats = entity.ai_stats;
    const bb = entity.brain!.blackboard;

    const detect_dist = stats.detect_dist ?? 400;
    const lose_target_dist = stats.lose_target_dist ?? 600;
    bb.set('detect_dist', detect_dist);
    bb.set('detect_dist_sq', detect_dist * detect_dist);
    bb.set('lose_target_dist', lose_target_dist);
    bb.set('lose_target_dist_sq', lose_target_dist * lose_target_dist);

    bb.set('health', entity.hp);
    bb.set('max_health', entity.maxHp);

    const e_pos = entity.getPos();
    bb.set('pos', { x: e_pos.x, y: e_pos.y });

    const stopDist = stats.follow_stop_dist ?? 40;

    bb.set('follow_stop_dist', stopDist);
    bb.set('follow_up_dist', stopDist + 10);
  }
}