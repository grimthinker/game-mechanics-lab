import { System, Line, Circle, Polygon, Body } from 'detect-collisions';
import { World } from '../World';
import {
  EntityId,
  HitZoneConfig,
  CollisionCategory,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
} from '../types';
import { Point } from '../../types';

const PHYSICS_CONFIG = {
  A: 10,
  C: 0.5,
  B: 0.01,
  d_min: 0.001,
  R_mult: Math.sin(Math.PI / 4),
};

export class PhysicsSystem {
  public system: System;
  public obstaclesEnabled: boolean = true;
  private bodyToEntityMap: WeakMap<object, EntityId> = new WeakMap();

  constructor() {
    this.system = new System();
  }

  public registerBody(entityId: EntityId, body: Body): void {
    this.bodyToEntityMap.set(body, entityId);
    this.system.insert(body);
  }

  public unregisterBody(body: Body): void {
    this.bodyToEntityMap.delete(body);
    this.system.remove(body);
  }

  public getEntityByBody(body: object): EntityId | undefined {
    return this.bodyToEntityMap.get(body);
  }

  public getCollisionFilter(body: object, world: World): { category: number; mask: number } {
    if (body instanceof Line) {
      return {
        category: CollisionCategory.OBSTACLE,
        mask: COLLISION_MASK_ALL,
      };
    }
    const entityId = this.bodyToEntityMap.get(body);
    if (entityId) {
      const phys = world.getComponent(entityId, 'physicsBody');
      if (phys) {
        return { category: phys.category, mask: phys.mask };
      }
    }
    return {
      category: CollisionCategory.NONE,
      mask: COLLISION_MASK_NONE,
    };
  }

  public setObstaclesEnabled(enabled: boolean): void {
    this.obstaclesEnabled = enabled;
  }

  public moveEntitySafe(world: World, entityId: EntityId, dx: number, dy: number): void {
    const transform = world.getComponent(entityId, 'transform');
    const phys = world.getComponent(entityId, 'physicsBody');
    if (!transform || !phys) return;

    const body = phys.body;

    // Синхронизируем тело из Transform перед началом перемещения (SSOT)
    body.setPosition(transform.x, transform.y);
    if (typeof body.setAngle === 'function') {
      body.setAngle(transform.angle);
    }
    this.system.updateBody(body);

    // Если тело не сталкивается с препятствиями (бестелесное), двигаем напрямую
    if ((phys.mask & CollisionCategory.OBSTACLE) === 0) {
      body.setPosition(body.x + dx, body.y + dy);
      transform.x = body.x;
      transform.y = body.y;
      return;
    }

    const radius = body instanceof Circle ? body.r : 16;
    const moveSq = dx * dx + dy * dy;
    const radiusThreshold = radius * PHYSICS_CONFIG.R_mult;

    let steps = 1;
    if (moveSq > radiusThreshold * radiusThreshold) {
      const maxDim = Math.max(Math.abs(dx), Math.abs(dy));
      steps = maxDim / radiusThreshold;
      steps = steps > 2 ? Math.ceil(steps) : 2;
    }

    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 0; i < steps; i++) {
      body.setPosition(body.x + stepX, body.y + stepY);
      this.system.updateBody(body);
      if (body instanceof Circle) {
        this.resolveObstaclesForBody(body, world);
      }
    }

    transform.x = body.x;
    transform.y = body.y;
  }

  private resolveObstaclesForBody(body: Circle, world: World): void {
    if (!this.obstaclesEnabled) return;

    this.system.checkOne(body, (response) => {
      const wall = response.b === body ? response.a : response.b;
      if (!wall.isStatic) return;

      const bodyFilter = this.getCollisionFilter(body, world);
      const wallFilter = this.getCollisionFilter(wall, world);
      if (
        (bodyFilter.mask & wallFilter.category) === 0 ||
        (wallFilter.mask & bodyFilter.category) === 0
      ) {
        return;
      }

      const wallEntityId = this.bodyToEntityMap.get(wall);
      if (wallEntityId) {
        const phys = world.getComponent(wallEntityId, 'physicsBody');
        if (phys?.isTrigger) return;
        const physStats = world.getComponent(wallEntityId, 'physicsStats');
        if (physStats && !physStats.isSolid) return;
        const health = world.getComponent(wallEntityId, 'health');
        if (health && !health.isAlive) return;
      }

      // В detect-collisions response.overlapV выталкивает response.a из response.b
      const isBodyA = response.a === body;
      const pushX =
        (response.overlapV.x + PHYSICS_CONFIG.B * Math.sign(response.overlapV.x || 1)) *
        (isBodyA ? -1 : 1);
      const pushY =
        (response.overlapV.y + PHYSICS_CONFIG.B * Math.sign(response.overlapV.y || 1)) *
        (isBodyA ? -1 : 1);

      body.setPosition(body.x + pushX, body.y + pushY);
      this.system.updateBody(body);
    });
  }

  public update(dt: number, world: World): void {
    // Синхронизация радиуса физических тел с актуальными статами (на случай баффов/дебаффов)
    const statEntities = world.getEntitiesWith('physicsBody', 'physicsStats');
    for (const [_id, { physicsBody, physicsStats }] of statEntities) {
      if (
        physicsBody.body instanceof Circle &&
        physicsBody.body.r !== physicsStats.radius.current
      ) {
        physicsBody.body.r = physicsStats.radius.current;
      }
    }

    // Предварительная синхронизация тела из Transform (SSOT -> Body) для всех динамических объектов
    const allPhysEntities = world.getEntitiesWith('transform', 'physicsBody');
    for (const [_id, { transform, physicsBody }] of allPhysEntities) {
      if (!physicsBody.isStatic && physicsBody.body) {
        physicsBody.body.setPosition(transform.x, transform.y);
        if (typeof physicsBody.body.setAngle === 'function') {
          physicsBody.body.setAngle(transform.angle);
        }
        this.system.updateBody(physicsBody.body);
      }
    }

    const movingEntities = world.getEntitiesWith('transform', 'velocity');
    for (const [id, { transform, velocity }] of movingEntities) {
      const health = world.getComponent(id, 'health');
      if (health && !health.isAlive) continue;

      const selfDx = (velocity.vx ?? 0) * dt;
      const selfDy = (velocity.vy ?? 0) * dt;

      const extVx = velocity.externalVx ?? 0;
      const extVy = velocity.externalVy ?? 0;

      const totalDx = selfDx + extVx * dt;
      const totalDy = selfDy + extVy * dt;

      if (totalDx !== 0 || totalDy !== 0) {
        this.moveEntitySafe(world, id, totalDx, totalDy);
      }

      // Затухание внешнего импульса (трение / инерция)
      if (extVx !== 0 || extVy !== 0) {
        const damping = 5.0;
        const factor = Math.max(0, 1 - damping * dt);
        velocity.externalVx = extVx * factor;
        velocity.externalVy = extVy * factor;

        if (Math.abs(velocity.externalVx) < 0.01) velocity.externalVx = 0;
        if (Math.abs(velocity.externalVy) < 0.01) velocity.externalVy = 0;
      }
    }

    this.system.update();

    this.system.checkAll((response) => {
      const c1 = response.a;
      const c2 = response.b;
      if (c1.isStatic || c2.isStatic) return;

      const filter1 = this.getCollisionFilter(c1, world);
      const filter2 = this.getCollisionFilter(c2, world);

      // Проверяем взаимное столкновение групп
      if ((filter1.mask & filter2.category) === 0 || (filter2.mask & filter1.category) === 0)
        return;

      const id1 = this.bodyToEntityMap.get(c1);
      const id2 = this.bodyToEntityMap.get(c2);
      if (!id1 || !id2) return;

      const p1 = world.getComponent(id1, 'physicsBody');
      const p2 = world.getComponent(id2, 'physicsBody');
      if (!p1 || !p2) return;

      // Триггеры и сенсоры не должны физически выталкивать объекты
      if (p1.isTrigger || p2.isTrigger) return;

      const health1 = world.getComponent(id1, 'health');
      const valid1 = health1 ? health1.isAlive : true;

      const health2 = world.getComponent(id2, 'health');
      const valid2 = health2 ? health2.isAlive : true;

      if (!valid1 || !valid2) return;

      const p1Stats = world.getComponent(id1, 'physicsStats');
      const weight1 = p1Stats?.weight.current ?? 1;

      const p2Stats = world.getComponent(id2, 'physicsStats');
      const weight2 = p2Stats?.weight.current ?? 1;

      const overlapX = response.overlapV.x;
      const overlapY = response.overlapV.y;

      const totalMass = weight1 + weight2;
      const ratio1 = weight2 / totalMass;
      const ratio2 = weight1 / totalMass;

      const mult = Math.min(PHYSICS_CONFIG.C, dt * PHYSICS_CONFIG.A);
      const deltaX1 = mult * overlapX * ratio1;
      const deltaY1 = mult * overlapY * ratio1;
      const deltaX2 = mult * overlapX * ratio2;
      const deltaY2 = mult * overlapY * ratio2;

      if (Math.abs(deltaX1) > PHYSICS_CONFIG.d_min || Math.abs(deltaY1) > PHYSICS_CONFIG.d_min) {
        p1.body.setPosition(p1.body.x - deltaX1, p1.body.y - deltaY1);
        const t1 = world.getComponent(id1, 'transform');
        if (t1) {
          t1.x = p1.body.x;
          t1.y = p1.body.y;
        }
      }
      if (Math.abs(deltaX2) > PHYSICS_CONFIG.d_min || Math.abs(deltaY2) > PHYSICS_CONFIG.d_min) {
        p2.body.setPosition(p2.body.x + deltaX2, p2.body.y + deltaY2);
        const t2 = world.getComponent(id2, 'transform');
        if (t2) {
          t2.x = p2.body.x;
          t2.y = p2.body.y;
        }
      }
    });

    if (this.obstaclesEnabled) {
      const entities = world.getEntitiesWith('physicsBody', 'transform');
      for (const [id, { physicsBody, transform }] of entities) {
        const health = world.getComponent(id, 'health');
        if (health && !health.isAlive) continue;
        if (physicsBody.isTrigger || physicsBody.isStatic) continue;
        if ((physicsBody.mask & CollisionCategory.OBSTACLE) === 0) continue;

        if (physicsBody.body instanceof Circle) {
          this.resolveObstaclesForBody(physicsBody.body, world);
          transform.x = physicsBody.body.x;
          transform.y = physicsBody.body.y;
          this.system.updateBody(physicsBody.body);
        }
      }
    }

    // Финальная синхронизация позиций Body обратно в Transform для всех нестатичных тел после разрешения коллизий
    for (const [_id, { transform, physicsBody }] of allPhysEntities) {
      if (!physicsBody.isStatic && !physicsBody.isTrigger && physicsBody.body) {
        transform.x = physicsBody.body.x;
        transform.y = physicsBody.body.y;
      }
    }
  }

  private canRayReachTarget(
    from: Point,
    rayEnd: Point,
    targetId: EntityId,
    zone: HitZoneConfig,
    attackerId: EntityId,
    world: World
  ): boolean {
    const disabledBodies: any[] = [];
    let result = false;

    try {
      // Исключаем атакующего из проверки коллизий луча
      const attackerPhys = world.getComponent(attackerId, 'physicsBody');
      if (attackerPhys && attackerPhys.body) {
        this.system.remove(attackerPhys.body);
        disabledBodies.push(attackerPhys.body);
      }

      while (true) {
        const rayResult = this.system.raycast(from, rayEnd);

        // Если луч ни во что не уперся, значит путь чист
        if (!rayResult) {
          result = true;
          break;
        }

        const hitBody = rayResult.body;
        const hitEntityId = this.bodyToEntityMap.get(hitBody);

        // Если попали точно в цель
        if (hitEntityId === targetId) {
          result = true;
          break;
        }

        let canPierce = false;

        // Разбираемся с типом препятствия
        if (hitBody instanceof Line) {
          canPierce = !!zone.pierceObstacles;
        } else if (hitEntityId) {
          const hitHealth = world.getComponent(hitEntityId, 'health');
          const hitPhys = world.getComponent(hitEntityId, 'physicsBody');
          const hitPhysStats = world.getComponent(hitEntityId, 'physicsStats');

          const isDead = hitHealth && !hitHealth.isAlive;
          const isNonSolid =
            (hitPhys && hitPhys.mask === COLLISION_MASK_NONE) ||
            (hitPhysStats && !hitPhysStats.isSolid);

          // Мертвых, бестелесных и триггеры (например ауры) всегда игнорируем
          if (isDead || isNonSolid || hitPhys?.isTrigger) {
            canPierce = true;
          } else {
            const category = hitPhys?.category ?? CollisionCategory.NONE;
            if (category === CollisionCategory.CREATURE) {
              canPierce = !!zone.pierceCreatures;
            } else if (category === CollisionCategory.ITEM) {
              canPierce = !!zone.pierceItems;
            } else if (category === CollisionCategory.OBSTACLE) {
              canPierce = !!zone.pierceObstacles;
            }
          }
        } else {
          // Если это тело без Entity (например, статические линии геометрии)
          if (hitBody instanceof Line) {
            canPierce = !!zone.pierceObstacles;
          }
        }

        if (canPierce) {
          // Временно отключаем тело и продолжаем пускать луч
          this.system.remove(hitBody);
          disabledBodies.push(hitBody);
        } else {
          // Попали в непробиваемое препятствие
          result = false;
          break;
        }
      }
    } finally {
      // Обязательно возвращаем все временно отключенные тела обратно в физический движок
      for (const body of disabledBodies) {
        this.system.insert(body);
      }
    }

    return result;
  }

  private getDistanceToSegment(p: Point, a: Point, b: Point): number {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
      return Math.hypot(p.x - a.x, p.y - a.y);
    }
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = a.x + t * dx;
    const projY = a.y + t * dy;
    return Math.hypot(p.x - projX, p.y - projY);
  }

  public checkWeaponHits(attackerId: EntityId, zone: HitZoneConfig, world: World): EntityId[] {
    const hitEntities: EntityId[] = [];
    const attackerTransform = world.getComponent(attackerId, 'transform');
    if (!attackerTransform) return hitEntities;

    const pos = { x: attackerTransform.x, y: attackerTransform.y };
    const angle = attackerTransform.angle;

    const isTargetValid = (targetId: EntityId) => {
      if (targetId === attackerId) return false;
      const health = world.getComponent(targetId, 'health');
      if (!health || !health.isAlive) return false;

      const tag = world.getComponent(targetId, 'tag');
      const meta = world.getComponent(targetId, 'meta');
      if (tag?.archetype === 'obstacle' && meta?.destructible === false) {
        return false;
      }
      return true;
    };

    if (zone.hitZoneType === 'radius' || zone.hitZoneType === 'angle') {
      const checkRadius =
        zone.hitZoneType === 'radius' ? (zone.radius ?? 50) : (zone.length ?? 120);
      const testCircle = new Circle(pos, checkRadius);
      const candidates = new Set<EntityId>();

      this.system.checkOne(testCircle, (response) => {
        const otherBody = response.b === testCircle ? response.a : response.b;
        const targetId = this.bodyToEntityMap.get(otherBody);
        if (targetId && isTargetValid(targetId)) {
          candidates.add(targetId);
        }
      });

      for (const targetId of candidates) {
        const transform = world.getComponent(targetId, 'transform');
        if (!transform) continue;

        const targetPos = { x: transform.x, y: transform.y };

        if (zone.hitZoneType === 'angle') {
          const maxAngle = (zone.angle ?? Math.PI / 6) / 2;
          const physBody = world.getComponent(targetId, 'physicsBody');
          let inSector = false;

          if (physBody?.body instanceof Polygon) {
            for (const pt of physBody.body.calcPoints) {
              const wx = physBody.body.x + pt.x;
              const wy = physBody.body.y + pt.y;
              const a = Math.atan2(wy - pos.y, wx - pos.x);
              const diff = Math.abs(Math.atan2(Math.sin(a - angle), Math.cos(a - angle)));
              if (diff <= maxAngle) {
                inSector = true;
                break;
              }
            }
          }

          if (!inSector) {
            const targetAngle = Math.atan2(targetPos.y - pos.y, targetPos.x - pos.x);
            const diff = Math.abs(
              Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle))
            );
            const physStats = world.getComponent(targetId, 'physicsStats');
            const targetRadius = physStats?.radius.current ?? 16;
            const dist = Math.hypot(targetPos.x - pos.x, targetPos.y - pos.y);
            const angularTolerance = dist > 0 ? Math.asin(Math.min(1, targetRadius / dist)) : 0;
            if (diff <= maxAngle + angularTolerance) {
              inSector = true;
            }
          }

          if (!inSector) continue;
        }

        if (zone.pierceObstacles && zone.pierceCreatures && zone.pierceItems) {
          hitEntities.push(targetId);
        } else if (this.canRayReachTarget(pos, targetPos, targetId, zone, attackerId, world)) {
          hitEntities.push(targetId);
        }
      }

      return hitEntities;
    }

    const targets = world.getEntitiesWith('transform', 'physicsBody', 'health');

    for (const [targetId, { transform, physicsBody }] of targets) {
      if (!isTargetValid(targetId)) continue;

      const physStats = world.getComponent(targetId, 'physicsStats');
      const targetRadius = physStats?.radius.current ?? 16;
      let isHit = false;
      const targetPos = { x: transform.x, y: transform.y };

      switch (zone.hitZoneType) {
        case 'forward_line': {
          const len = zone.length ?? 150;
          const endPoint = {
            x: pos.x + Math.cos(angle) * len,
            y: pos.y + Math.sin(angle) * len,
          };
          const distToLine = this.getDistanceToSegment(targetPos, pos, endPoint);
          if (distToLine <= targetRadius) {
            if (this.canRayReachTarget(pos, endPoint, targetId, zone, attackerId, world)) {
              isHit = true;
            }
          }
          break;
        }
        case 'shrapnel': {
          const len = zone.length ?? 120;
          const maxAngle = (zone.angle ?? Math.PI / 3) / 2;
          const count = zone.rayCount ?? 5;
          for (let i = 0; i < count; i++) {
            const fraction = count > 1 ? i / (count - 1) - 0.5 : 0;
            const rayAngle = angle + fraction * (maxAngle * 2);
            const endPoint = {
              x: pos.x + Math.cos(rayAngle) * len,
              y: pos.y + Math.sin(rayAngle) * len,
            };
            const distToRay = this.getDistanceToSegment(targetPos, pos, endPoint);
            if (distToRay <= targetRadius) {
              if (this.canRayReachTarget(pos, endPoint, targetId, zone, attackerId, world)) {
                isHit = true;
                break;
              }
            }
          }
          break;
        }
      }

      if (isHit) {
        hitEntities.push(targetId);
      }
    }

    return hitEntities;
  }
}
