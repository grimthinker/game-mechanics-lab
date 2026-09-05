import { System, Line, Circle } from 'detect-collisions';
import { World } from '../World';
import {
  EntityId,
  WeaponConfig,
  CollisionCategory,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
} from '../types';
import { ObstacleSegment, Point } from '../../types';

const PHYSICS_CONFIG = {
  A: 10,
  C: 0.5,
  B: 0.01,
  d_min: 0.001,
  R_mult: Math.sin(Math.PI / 4),
};

export class PhysicsSystem {
  public system: System;
  private obstacleLines: Line[] = [];
  public obstaclesEnabled: boolean = true;
  private bodyToEntityMap: WeakMap<object, EntityId> = new WeakMap();

  constructor() {
    this.system = new System();
  }

  public registerBody(entityId: EntityId, body: Circle): void {
    this.bodyToEntityMap.set(body, entityId);
    this.system.insert(body);
  }

  public unregisterBody(body: Circle): void {
    this.bodyToEntityMap.delete(body);
    this.system.remove(body);
  }

  public loadObstacles(segments: ObstacleSegment[]): void {
    this.clearObstacles();
    for (const seg of segments) {
      const line = new Line(
        { x: seg.start.x, y: seg.start.y },
        { x: seg.end.x, y: seg.end.y },
        { isStatic: true }
      );
      (line as any).category = CollisionCategory.OBSTACLE;
      (line as any).mask = COLLISION_MASK_ALL;
      this.obstacleLines.push(line);
      if (this.obstaclesEnabled) {
        this.system.insert(line);
      }
    }
  }

  public setObstaclesEnabled(enabled: boolean): void {
    if (this.obstaclesEnabled === enabled) return;
    this.obstaclesEnabled = enabled;
    for (const line of this.obstacleLines) {
      if (enabled) {
        this.system.insert(line);
      } else {
        this.system.remove(line);
      }
    }
  }

  public clearObstacles(): void {
    for (const line of this.obstacleLines) {
      this.system.remove(line);
    }
    this.obstacleLines = [];
  }

  public getObstacleLines(): Line[] {
    return this.obstacleLines;
  }

  public moveEntitySafe(world: World, entityId: EntityId, dx: number, dy: number): void {
    const transform = world.getComponent(entityId, 'transform');
    const phys = world.getComponent(entityId, 'physicsBody');
    if (!transform || !phys) return;

    const body = phys.body;

    // Если тело не сталкивается с препятствиями (бестелесное), двигаем напрямую
    if ((phys.mask & CollisionCategory.OBSTACLE) === 0) {
      body.setPosition(body.x + dx, body.y + dy);
      transform.x = body.x;
      transform.y = body.y;
      return;
    }

    const moveSq = dx * dx + dy * dy;
    const radiusThreshold = body.r * PHYSICS_CONFIG.R_mult;

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
      this.resolveObstaclesForBody(body);
    }

    transform.x = body.x;
    transform.y = body.y;
  }

  private resolveObstaclesForBody(body: Circle): void {
    if (!this.obstaclesEnabled) return;
    if (((body as any).mask & CollisionCategory.OBSTACLE) === 0) return;

    this.system.checkOne(body, (response) => {
      const wall = response.b === body ? response.a : response.b;
      if (wall instanceof Line) {
        const pushX =
          response.overlap * response.overlapV.x +
          PHYSICS_CONFIG.B * Math.sign(response.overlapV.x);
        const pushY =
          response.overlap * response.overlapV.y +
          PHYSICS_CONFIG.B * Math.sign(response.overlapV.y);

        body.setPosition(body.x - pushX, body.y - pushY);
      }
    });
  }

  public getNearestEntity(
    worldPoint: Point,
    maxWorldDist: number,
    world?: World,
    isEditor: boolean = false // <-- передаем флаг режима редактора
  ): EntityId | null {
    if (!world) return null;
  
    let nearestId: EntityId | null = null;
    let minDistance = Infinity;
  
    const entities = world.getEntitiesWith('transform');
    for (const [entityId, { transform, physicsBody }] of entities) {
      const physStats = world.getComponent(entityId, 'physicsStats');
      const gizmo = world.getComponent(entityId, 'gizmo');
  
      // 1. В ИГРЕ И СИМУЛЯЦИИ:
      // Полностью игнорируем сущности без реального физ. тела
      if (!isEditor) {
        if (!physicsBody && !physStats) continue;
      }
  
      // 2. В РЕДАКТОРЕ:
      // Если объект бестелесный, берем радиус его гизмо (или дефолтный 14px).
      // Если физический — берем его настоящий физический радиус.
      const radius = physStats?.radius.current 
        ?? physicsBody?.body.r 
        ?? gizmo?.radius 
        ?? 14;
  
      const distToCenter = Math.hypot(transform.x - worldPoint.x, transform.y - worldPoint.y);
      const distToBoundary = Math.max(0, distToCenter - radius);
  
      if (distToBoundary <= maxWorldDist && distToBoundary < minDistance) {
        minDistance = distToBoundary;
        nearestId = entityId;
      }
    }
  
    return nearestId;
  }

public getEntityAt(worldPoint: Point, world?: World, isEditor: boolean = false): EntityId | null {
  if (!world) return null;

  const entities = world.getEntitiesWith('transform');
  for (const [entityId, { transform, physicsBody }] of entities) {
    const physStats = world.getComponent(entityId, 'physicsStats');
    const gizmo = world.getComponent(entityId, 'gizmo');

    if (!isEditor && !physicsBody && !physStats) continue;

    const radius = physStats?.radius.current ?? physicsBody?.body.r ?? gizmo?.radius ?? 14;
    const dist = Math.hypot(transform.x - worldPoint.x, transform.y - worldPoint.y);
    if (dist <= radius) {
      return entityId;
    }
  }

  return null;
}

  public update(dt: number, world: World): void {
    const movingEntities = world.getEntitiesWith('transform', 'velocity');
    for (const [id, { transform, velocity }] of movingEntities) {
      if (velocity.currentSpeed > 0) {
        const dx = Math.cos(transform.angle) * velocity.currentSpeed * dt;
        const dy = Math.sin(transform.angle) * velocity.currentSpeed * dt;
        this.moveEntitySafe(world, id, dx, dy);
      }
    }

    this.system.update();

    this.system.checkAll((response) => {
      const c1 = response.a;
      const c2 = response.b;
      if (c1.isStatic || c2.isStatic) return;

      const cat1 = (c1 as any).category ?? CollisionCategory.NONE;
      const mask1 = (c1 as any).mask ?? 0;
      const cat2 = (c2 as any).category ?? CollisionCategory.NONE;
      const mask2 = (c2 as any).mask ?? 0;

      // Проверяем взаимное столкновение групп
      if ((mask1 & cat2) === 0 || (mask2 & cat1) === 0) return;

      const id1 = this.bodyToEntityMap.get(c1);
      const id2 = this.bodyToEntityMap.get(c2);
      if (!id1 || !id2) return;

      const meta1 = world.getComponent(id1, 'meta');
      const health1 = world.getComponent(id1, 'health');
      const healthStats1 = world.getComponent(id1, 'healthStats');
      const valid1 = meta1 ? (health1?.isAlive && healthStats1 && healthStats1.hp.current > 0) : true;

      const meta2 = world.getComponent(id2, 'meta');
      const health2 = world.getComponent(id2, 'health');
      const healthStats2 = world.getComponent(id2, 'healthStats');
      const valid2 = meta2 ? (health2?.isAlive && healthStats2 && healthStats2.hp.current > 0) : true;

      if (!valid1 || !valid2) return;

      const p1 = world.getComponent(id1, 'physicsBody');
      const p2 = world.getComponent(id2, 'physicsBody');
      if (!p1 || !p2) return;

      const p1Stats = world.getComponent(id1, 'physicsStats');
      const weight1 = p1Stats?.weight.current ?? 1;

      const p2Stats = world.getComponent(id2, 'physicsStats');
      const weight2 = p2Stats?.weight.current ?? 1;

      const overlapX = response.overlap * response.overlapV.x;
      const overlapY = response.overlap * response.overlapV.y;

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
        const meta = world.getComponent(id, 'meta');
        if (meta && !world.getComponent(id, 'health')?.isAlive) continue;
        if ((physicsBody.mask & CollisionCategory.OBSTACLE) === 0) continue;
        
        this.resolveObstaclesForBody(physicsBody.body);
        transform.x = physicsBody.body.x;
        transform.y = physicsBody.body.y;
      }
    }
  }

  private isLineOfSightBlocked(from: Point, to: Point): boolean {
    if (!this.obstaclesEnabled) return false;
    const rayResult = this.system.raycast(from, to);
    return rayResult ? rayResult.body instanceof Line : false;
  }

  private canRayReachTarget(
    from: Point,
    rayEnd: Point,
    targetId: EntityId,
    weapon: WeaponConfig,
    attackerId: EntityId,
    world: World
  ): boolean {
    let currStart = { x: from.x, y: from.y };
    let currEnd = { x: rayEnd.x, y: rayEnd.y };

    const dirX = rayEnd.x - from.x;
    const dirY = rayEnd.y - from.y;
    const len = Math.hypot(dirX, dirY);
    if (len === 0) return true;
    const ux = dirX / len;
    const uy = dirY / len;

    const maxSteps = 10;
    for (let step = 0; step < maxSteps; step++) {
      const rayResult = this.system.raycast(currStart, currEnd);
      if (!rayResult) return true;

      const hitBody = rayResult.body;
      const hitPoint = rayResult.point;
      const hitEntityId = this.bodyToEntityMap.get(hitBody);

      if (hitEntityId) {
        const hitHealth = world.getComponent(hitEntityId, 'health');
        const hitStats = world.getComponent(hitEntityId, 'healthStats');
        const hitPhys = world.getComponent(hitEntityId, 'physicsBody');
        const hitPhysStats = world.getComponent(hitEntityId, 'physicsStats');
        const isDead = hitHealth && (!hitHealth.isAlive || (hitStats && hitStats.hp.current <= 0));
        const isNonSolid = (hitPhys && hitPhys.mask === COLLISION_MASK_NONE) || (hitPhysStats && !hitPhysStats.isSolid.current);

        if (isDead || isNonSolid) {
          currStart = {
            x: hitPoint.x + ux * 1,
            y: hitPoint.y + uy * 1,
          };
          continue;
        }
      }

      if (hitEntityId === targetId) {
        return true;
      }

      if (hitEntityId === attackerId) {
        const attackerPhysStats = world.getComponent(attackerId, 'physicsStats');
        const attackerBody = world.getComponent(attackerId, 'physicsBody');
        const r = attackerPhysStats?.radius.current ?? attackerBody?.body.r ?? 24;
        const stepDist = r + 1;
        if (stepDist >= len) return false;
        currStart = {
          x: from.x + ux * stepDist,
          y: from.y + uy * stepDist,
        };
        continue;
      }

      if (hitBody instanceof Line) {
        if (weapon.zone.pierceObstacles) {
          currStart = {
            x: hitPoint.x + ux * 1,
            y: hitPoint.y + uy * 1,
          };
        } else {
          return false;
        }
      } else if (hitEntityId) {
        const hitTransform = world.getComponent(hitEntityId, 'transform');
        const hitPhysStats = world.getComponent(hitEntityId, 'physicsStats');
        const hitBody = world.getComponent(hitEntityId, 'physicsBody');
        const r = hitPhysStats?.radius.current ?? hitBody?.body.r ?? 24;

        if (hitTransform) {
          const hitAiStats = world.getComponent(hitEntityId, 'aiStats');
          const hitMeta = world.getComponent(hitEntityId, 'meta');
          const hitBehavior = hitAiStats?.behavior?.current ?? hitMeta?.config?.behavior ?? 'IdleTree';
          
          if (hitBehavior === 'PlayerTree') {
            if (weapon.zone.piercePlayers) {
              const distToCenter =
                (hitTransform.x - from.x) * ux +
                (hitTransform.y - from.y) * uy;
              const stepDist = Math.max(0, distToCenter) + r + 1;
              if (stepDist >= len) return false;
              currStart = {
                x: from.x + ux * stepDist,
                y: from.y + uy * stepDist,
              };
            } else {
              return false;
            }
          } else {
            if (weapon.zone.pierceBots) {
              const distToCenter =
                (hitTransform.x - from.x) * ux +
                (hitTransform.y - from.y) * uy;
              const stepDist = Math.max(0, distToCenter) + r + 1;
              if (stepDist >= len) return false;
              currStart = {
                x: from.x + ux * stepDist,
                y: from.y + uy * stepDist,
              };
            } else {
              return false;
            }
          }
        } else {
          return false;
        }
      } else {
        return false;
      }
    }
    return false;
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

  public checkWeaponHits(
    attackerId: EntityId,
    weapon: WeaponConfig,
    world: World
  ): EntityId[] {
    const hitEntities: EntityId[] = [];
    const attackerTransform = world.getComponent(attackerId, 'transform');
    if (!attackerTransform) return hitEntities;

    const pos = { x: attackerTransform.x, y: attackerTransform.y };
    const angle = attackerTransform.angle;

    const targets = world.getEntitiesWith('transform', 'physicsBody', 'health', 'healthStats');

    for (const [targetId, { transform, physicsBody, health, healthStats }] of targets) {
      if (targetId === attackerId || !health.isAlive || healthStats.hp.current <= 0) continue;

      const physStats = world.getComponent(targetId, 'physicsStats');
      const isSolid = physStats ? physStats.isSolid.current : (physicsBody.mask !== COLLISION_MASK_NONE);
      if (!isSolid) continue;

      const targetRadius = physStats?.radius.current ?? physicsBody.body.r ?? 16;

      let isHit = false;
      const targetPos = { x: transform.x, y: transform.y };
      const dx = targetPos.x - pos.x;
      const dy = targetPos.y - pos.y;
      const dist = Math.hypot(dx, dy);

      switch (weapon.zone.hitZoneType) {
        case 'radius': {
          const r = weapon.zone.radius ?? 50;
          if (dist <= r + targetRadius) {
            isHit = !this.isLineOfSightBlocked(pos, targetPos);
          }
          break;
        }
        case 'angle': {
          const len = weapon.zone.length ?? 120;
          const maxAngle = (weapon.zone.angle ?? Math.PI / 6) / 2;
          const maxDist = len + targetRadius;

          if (dist <= maxDist) {
            const targetAngle = Math.atan2(targetPos.y - pos.y, targetPos.x - pos.x);
            let angleDiff = targetAngle - angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            angleDiff = Math.abs(angleDiff);

            const angularTolerance =
              dist > 0 ? Math.asin(Math.min(1, targetRadius / dist)) : 0;

            if (angleDiff <= maxAngle + angularTolerance) {
              if (!this.isLineOfSightBlocked(pos, targetPos)) {
                isHit = true;
              }
            }
          }
          break;
        }
        case 'forward_line': {
          const len = weapon.zone.length ?? 150;
          const endPoint = {
            x: pos.x + Math.cos(angle) * len,
            y: pos.y + Math.sin(angle) * len,
          };
          const distToLine = this.getDistanceToSegment(targetPos, pos, endPoint);
          if (distToLine <= targetRadius) {
            if (this.canRayReachTarget(pos, endPoint, targetId, weapon, attackerId, world)) {
              isHit = true;
            }
          }
          break;
        }
        case 'shrapnel': {
          const len = weapon.zone.length ?? 120;
          const maxAngle = (weapon.zone.angle ?? Math.PI / 3) / 2;
          const count = weapon.zone.rayCount ?? 5;
          for (let i = 0; i < count; i++) {
            const fraction = count > 1 ? i / (count - 1) - 0.5 : 0;
            const rayAngle = angle + fraction * (maxAngle * 2);
            const endPoint = {
              x: pos.x + Math.cos(rayAngle) * len,
              y: pos.y + Math.sin(rayAngle) * len,
            };
            const distToRay = this.getDistanceToSegment(targetPos, pos, endPoint);
            if (distToRay <= targetRadius) {
              if (this.canRayReachTarget(pos, endPoint, targetId, weapon, attackerId, world)) {
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