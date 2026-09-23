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

  /**
   * Применяет ручные трансформации (из редактора/UI), помеченные флагом isDirty,
   * напрямую к телам Rapier3D. Гарантирует отсутствие гонок данных.
   */
  public syncDirtyTransforms(world: World): void {
    if (!this.driver || !this.driver.isReady) return;

    let anyDirty = false;
    const entities = world.getEntitiesWith('transform', 'physicsBody');
    for (const [id, { transform, physicsBody }] of entities) {
      if (transform.isDirty) {
        transform.isDirty = false;
        anyDirty = true;

        if (physicsBody.rawBody) {
          const pos = { x: transform.x, y: transform.y, z: transform.z };
          const rot = transform.rotation;

          if (physicsBody.bodyType === 'kinematicPositionBased') {
            physicsBody.rawBody.setTranslation(pos, true);
            physicsBody.rawBody.setNextKinematicTranslation(pos);
            if (rot) {
              physicsBody.rawBody.setRotation(rot, true);
              physicsBody.rawBody.setNextKinematicRotation(rot);
            }
            const vel = world.getComponent(id, 'velocity');
            if (vel) {
              vel.vx = 0;
              vel.vy = 0;
              vel.vz = 0;
            }
          } else {
            physicsBody.rawBody.setTranslation(pos, true);
            physicsBody.rawBody.setRotation(rot, true);
            // При ручном перемещении гасим текущий импульс (останавливаем полет/падение)
            physicsBody.rawBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
            physicsBody.rawBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
            if (physicsBody.rawBody.isSleeping()) {
              physicsBody.rawBody.wakeUp();
            }
          }
        }
      }
    }

    if (anyDirty) {
      this.driver.updateSceneQueries();
    }
  }

  public updateCreatureColliderStance(
    world: World,
    id: EntityId,
    stance: string,
    radius: number
  ): void {
    if (!this.driver || !this.driver.isReady) return;
    const phys = world.getComponent(id, 'physicsBody');
    if (!phys?.rawCollider) return;

    if (phys.currentColliderStance === stance) return;
    phys.currentColliderStance = stance;

    let targetHeight = 1.8;
    let capRadius = radius;

    if (stance === 'crouching' || stance === 'stand_to_crouch' || stance === 'crouch_to_stand') {
      targetHeight = 1.2;
    } else if (stance === 'prone' || stance.includes('prone')) {
      targetHeight = 0.4;
      capRadius = Math.min(radius, 0.2);
    } else if (stance === 'airborne') {
      targetHeight = 1.8;
      capRadius = radius;
    }

    const halfHeight = Math.max(0.01, (targetHeight - 2 * capRadius) / 2);
    const offsetY = halfHeight + capRadius;

    this.driver.updateCapsuleCollider(phys.rawCollider, halfHeight, capRadius, offsetY);
  }

  public update(dt: number, world: World): void {
    // Синхронизация полного веса и коллизий физических тел с актуальными статами
    const statEntities = world.getEntitiesWith('physicsBody', 'physicsStats');
    for (const [id, { physicsBody, physicsStats }] of statEntities) {
      physicsStats.totalWeight = calculateTotalEntityWeight(world, id);

      const health = world.getComponent(id, 'health');
      const isAlive = health ? health.isAlive : true;
      const tag = world.getComponent(id, 'tag');

      if (tag?.archetype !== 'zone' && tag?.archetype !== 'marker') {
        const expectedMask =
          physicsStats.isSolid && isAlive ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
        if (physicsBody.mask !== expectedMask) {
          physicsBody.mask = expectedMask;
        }
      }
    }

    // 1. Движение персонажей через Kinematic Character Controller (KCC) с 3D-гравитацией
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
      const extVy = velocity.externalVy ?? 0;
      const extVz = velocity.externalVz ?? 0;

      // Гравитация (-9.81 м/с²) и предел скорости свободного падения
      velocity.vy = (velocity.vy ?? 0) - 9.81 * localDt;
      velocity.vy = Math.max(-20.0, velocity.vy);

      const desiredDx = selfDx + extVx * localDt;
      const desiredDy = (velocity.vy + extVy) * localDt;
      const desiredDz = selfDz + extVz * localDt;

      if (phys?.rawCollider && phys.bodyType === 'kinematicPositionBased' && this.driver?.isReady) {
        const physStats = world.getComponent(id, 'physicsStats');
        const characterMass = physStats?.totalWeight ?? physStats?.weight.current ?? 75;

        // Расчет перемещения через KCC контроллер
        const { movement, isGrounded } = this.driver.computeCharacterMovement(
          phys.rawCollider,
          { x: desiredDx, y: desiredDy, z: desiredDz },
          characterMass
        );

        transform.x += movement.x;
        transform.y += movement.y;
        transform.z += movement.z;

        // Фиксируем реальную скорость (фактическое перемещение) для синхронизации анимаций
        velocity.actualSpeed = localDt > 0 ? Math.hypot(movement.x, movement.z) / localDt : 0;

        // Если персонаж достиг уровня пола или зафиксирован KCC как стоящий на земле
        let grounded = isGrounded;
        if (transform.y <= 0) {
          transform.y = 0;
          velocity.vy = 0;
          grounded = true;
        } else if (isGrounded) {
          velocity.vy = 0;
          grounded = true;
        } else if (Math.abs(movement.y - desiredDy) > 0.0001 && desiredDy < 0) {
          // Если движение по Y вниз ограничено коллизией с препятствием — уперлись в поверхность
          velocity.vy = 0;
          grounded = true;
        }

        velocity.isGrounded = grounded;

        if (phys.rawBody) {
          // Мгновенная синхронизация положения коллайдера в Rapier для исключения задержек между подшагами
          phys.rawBody.setTranslation(
            {
              x: transform.x,
              y: transform.y,
              z: transform.z,
            },
            true
          );
          phys.rawBody.setNextKinematicTranslation({
            x: transform.x,
            y: transform.y,
            z: transform.z,
          });
          if (transform.rotation) {
            phys.rawBody.setRotation(transform.rotation, true);
            phys.rawBody.setNextKinematicRotation(transform.rotation);
          }
        }
      } else {
        transform.x += desiredDx;
        transform.z += desiredDz;
        velocity.actualSpeed = localDt > 0 ? Math.hypot(desiredDx, desiredDz) / localDt : 0;
        velocity.isGrounded = transform.y <= 0;
      }

      // Затухание внешнего импульса (трение / инерция)
      if (extVx !== 0 || extVy !== 0 || extVz !== 0) {
        const damping = 5.0;
        const factor = Math.max(0, 1 - damping * localDt);
        velocity.externalVx = extVx * factor;
        velocity.externalVy = extVy * factor;
        velocity.externalVz = extVz * factor;

        if (Math.abs(velocity.externalVx) < 0.01) velocity.externalVx = 0;
        if (Math.abs(velocity.externalVy) < 0.01) velocity.externalVy = 0;
        if (Math.abs(velocity.externalVz) < 0.01) velocity.externalVz = 0;
      }
    }

    // 2. Мягкое расталкивание существ (Soft Collision) пропорционально массе
    const activeCreatures = world
      .getEntitiesWith('transform', 'physicsStats', 'health', 'physicsBody')
      .filter(
        ([, comp]) =>
          comp.health.isAlive &&
          comp.physicsBody.bodyType === 'kinematicPositionBased' &&
          comp.physicsStats.isSolid
      );

    for (let i = 0; i < activeCreatures.length; i++) {
      const [, compA] = activeCreatures[i];
      const rA = compA.physicsStats.radius.current ?? 0.4;
      const mA = compA.physicsStats.totalWeight ?? compA.physicsStats.weight.current ?? 75;

      for (let j = i + 1; j < activeCreatures.length; j++) {
        const [, compB] = activeCreatures[j];
        const rB = compB.physicsStats.radius.current ?? 0.4;
        const mB = compB.physicsStats.totalWeight ?? compB.physicsStats.weight.current ?? 75;

        const dx = compA.transform.x - compB.transform.x;
        const dz = compA.transform.z - compB.transform.z;
        const distSq = dx * dx + dz * dz;
        const minDist = rA + rB;

        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - (dist > 0.0001 ? dist : 0);
          const nx = dist > 0.0001 ? dx / dist : 1;
          const nz = dist > 0.0001 ? dz / dist : 0;

          const totalMass = Math.max(0.1, mA + mB);
          const ratioA = mB / totalMass;
          const ratioB = mA / totalMass;

          const pushFactor = 0.5; // Плавное демпфирование расталкивания
          const pushX = nx * overlap * pushFactor;
          const pushZ = nz * overlap * pushFactor;

          compA.transform.x += pushX * ratioA;
          compA.transform.z += pushZ * ratioA;

          compB.transform.x -= pushX * ratioB;
          compB.transform.z -= pushZ * ratioB;

          if (compA.physicsBody.rawBody) {
            compA.physicsBody.rawBody.setNextKinematicTranslation({
              x: compA.transform.x,
              y: compA.transform.y,
              z: compA.transform.z,
            });
          }
          if (compB.physicsBody.rawBody) {
            compB.physicsBody.rawBody.setNextKinematicTranslation({
              x: compB.transform.x,
              y: compB.transform.y,
              z: compB.transform.z,
            });
          }
        }
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
