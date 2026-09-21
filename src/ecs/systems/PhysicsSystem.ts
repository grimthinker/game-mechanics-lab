import { World } from '../World';
import {
  EntityId,
  HitZoneConfig,
  CollisionCategory,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
} from '../types';
import { calculateTotalEntityWeight } from '../utils/hierarchy';
import { IPhysicsDriver } from '../../physics/IPhysicsDriver';

export class PhysicsSystem {
  public obstaclesEnabled: boolean = true;
  public driver: IPhysicsDriver | null = null;

  constructor() {}

  public setObstaclesEnabled(enabled: boolean): void {
    this.obstaclesEnabled = enabled;
  }

  public update(dt: number, world: World): void {
    // Синхронизация полного веса и коллизий физических тел с актуальными статами
    const statEntities = world.getEntitiesWith('physicsBody', 'physicsStats');
    for (const [id, { physicsBody, physicsStats }] of statEntities) {
      physicsStats.totalWeight = calculateTotalEntityWeight(world, id);

      // Синхронизация isSolid (включение/отключение коллизий)
      const health = world.getComponent(id, 'health');
      const isAlive = health ? health.isAlive : true;
      const tag = world.getComponent(id, 'tag');

      // Зоны и маркеры имеют свои особые маски, их не перезаписываем
      if (tag?.archetype !== 'zone' && tag?.archetype !== 'marker') {
        const expectedMask =
          physicsStats.isSolid && isAlive ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
        if (physicsBody.mask !== expectedMask) {
          physicsBody.mask = expectedMask;
        }
      }
    }

    const movingEntities = world.getEntitiesWith('transform', 'velocity');
    for (const [id, { transform, velocity }] of movingEntities) {
      const phys = world.getComponent(id, 'physicsBody');
      if (phys?.rawBody && phys.bodyType === 'dynamic') continue;

      const health = world.getComponent(id, 'health');
      if (health && !health.isAlive) continue;

      const ts = world.getComponent(id, 'timeScale')?.multiplier.current ?? 1.0;
      const localDt = dt * ts;

      const selfDx = (velocity.vx ?? 0) * localDt;
      const selfDz = (velocity.vz ?? 0) * localDt;

      const extVx = velocity.externalVx ?? 0;
      const extVz = velocity.externalVz ?? 0;

      const totalDx = selfDx + extVx * localDt;
      const totalDz = selfDz + extVz * localDt;

      // Перемещение персонажей по плоскости пола XZ
      if (totalDx !== 0 || totalDz !== 0) {
        transform.x += totalDx;
        transform.z += totalDz;
      }

      // Синхронизируем положение и ориентацию кинематического тела в Rapier3D
      if (phys?.rawBody && phys.bodyType === 'kinematicPositionBased') {
        phys.rawBody.setNextKinematicTranslation({
          x: transform.x,
          y: transform.y,
          z: transform.z,
        });
        if (transform.rotation) {
          phys.rawBody.setNextKinematicRotation(transform.rotation);
        }
      }

      // Затухание внешнего импульса (трение / инерция)
      if (extVx !== 0 || extVz !== 0) {
        const damping = 5.0;
        const factor = Math.max(0, 1 - damping * localDt);
        velocity.externalVx = extVx * factor;
        velocity.externalVz = extVz * factor;

        if (Math.abs(velocity.externalVx) < 0.01) velocity.externalVx = 0;
        if (Math.abs(velocity.externalVz) < 0.01) velocity.externalVz = 0;
      }
    }
  }

  public checkWeaponHits(attackerId: EntityId, zone: HitZoneConfig, world: World): EntityId[] {
    const hitEntities: EntityId[] = [];
    const attackerTransform = world.getComponent(attackerId, 'transform');
    if (!attackerTransform || !this.driver) return hitEntities;

    // Смещение по высоте, чтобы луч/сфера исходили из груди, а не скользили по полу (ступням)
    const heightOffset = 0.9;
    const pos = {
      x: attackerTransform.x,
      y: attackerTransform.y + heightOffset,
      z: attackerTransform.z,
    };
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
        zone.hitZoneType === 'radius' ? (zone.radius ?? 2.5) : (zone.length ?? 4.5);

      const candidates = this.driver.queryEntitiesInSphere(pos, checkRadius);

      for (const targetId of candidates) {
        if (!isTargetValid(targetId)) continue;

        const transform = world.getComponent(targetId, 'transform');
        if (!transform) continue;

        const targetY = transform.y + heightOffset;

        if (zone.hitZoneType === 'angle') {
          const maxAngle = (zone.angle ?? Math.PI / 6) / 2;
          const targetAngle = Math.atan2(transform.z - pos.z, transform.x - pos.x);

          let diff = Math.abs(
            Math.atan2(Math.sin(targetAngle - angle), Math.cos(targetAngle - angle))
          );

          const physStats = world.getComponent(targetId, 'physicsStats');
          const targetRadius = physStats?.radius.current ?? 0.4;
          const dist = Math.hypot(transform.x - pos.x, transform.z - pos.z);
          const angularTolerance = dist > 0 ? Math.asin(Math.min(1, targetRadius / dist)) : 0;

          if (diff > maxAngle + angularTolerance) {
            continue;
          }
        }

        // Проверка препятствий (Line of Sight)
        if (zone.pierceObstacles && zone.pierceCreatures && zone.pierceItems) {
          hitEntities.push(targetId);
        } else {
          // Пускаем луч к цели, чтобы проверить перекрытие
          const dx = transform.x - pos.x;
          const dy = targetY - pos.y;
          const dz = transform.z - pos.z;
          const dist = Math.hypot(dx, dy, dz);

          if (dist > 0.001) {
            const dir = { x: dx / dist, y: dy / dist, z: dz / dist };
            const hitList = this.driver.castRayMultiple(pos, dir, dist, true, attackerId);

            let blocked = false;
            for (const hit of hitList) {
              if (hit.entityId === targetId) break; // Дошли до цели

              const tag = world.getComponent(hit.entityId, 'tag');
              const meta = world.getComponent(hit.entityId, 'meta');
              const arch = tag?.archetype ?? meta?.entityType;
              const phys = world.getComponent(hit.entityId, 'physicsBody');
              const health = world.getComponent(hit.entityId, 'health');

              if (health && !health.isAlive) continue;
              if (phys?.isTrigger) continue;

              let canPierce = false;
              if (arch === 'creature') canPierce = !!zone.pierceCreatures;
              else if (arch === 'item') canPierce = !!zone.pierceItems;
              else if (arch === 'obstacle') canPierce = !!zone.pierceObstacles;

              if (!canPierce) {
                blocked = true;
                break;
              }
            }

            if (!blocked) {
              hitEntities.push(targetId);
            }
          } else {
            hitEntities.push(targetId);
          }
        }
      }
      return hitEntities;
    }

    const hitSet = new Set<string>();

    const processRayHits = (hitList: Array<{ entityId: string; toi: number }>) => {
      for (const hit of hitList) {
        const targetId = hit.entityId;

        const tag = world.getComponent(targetId, 'tag');
        const meta = world.getComponent(targetId, 'meta');
        const arch = tag?.archetype ?? meta?.entityType;
        const phys = world.getComponent(targetId, 'physicsBody');
        const health = world.getComponent(targetId, 'health');

        const isDead = health && !health.isAlive;
        const isTrigger = phys?.isTrigger;

        // Мертвецов и триггеры всегда прошиваем насквозь
        if (isDead || isTrigger) continue;

        let canPierce = false;
        if (arch === 'creature') canPierce = !!zone.pierceCreatures;
        else if (arch === 'item') canPierce = !!zone.pierceItems;
        else if (arch === 'obstacle') canPierce = !!zone.pierceObstacles;

        if (isTargetValid(targetId)) {
          hitSet.add(targetId);
        }

        // Если пробитие для данного типа не разрешено — луч прерывается
        if (!canPierce) {
          break;
        }
      }
    };

    if (zone.hitZoneType === 'forward_line') {
      const length = zone.length ?? 6.0;
      const dir = { x: Math.cos(angle), y: 0, z: Math.sin(angle) };
      const hitList = this.driver.castRayMultiple(pos, dir, length, true, attackerId);
      processRayHits(hitList);
    } else if (zone.hitZoneType === 'shrapnel') {
      const length = zone.length ?? 5.0;
      const maxAngle = (zone.angle ?? Math.PI / 3) / 2;
      const count = zone.rayCount ?? 5;

      for (let i = 0; i < count; i++) {
        const fraction = count > 1 ? i / (count - 1) - 0.5 : 0;
        const rayAngle = angle + fraction * (maxAngle * 2);
        const dir = { x: Math.cos(rayAngle), y: 0, z: Math.sin(rayAngle) };

        const hitList = this.driver.castRayMultiple(pos, dir, length, true, attackerId);
        processRayHits(hitList);
      }
    }

    return Array.from(hitSet);
  }
}
