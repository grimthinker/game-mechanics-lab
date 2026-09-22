import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { CollisionCategory, ModifierType } from '../types';
import { applyDamage, applyHeal } from '../utils/health';
import { addModifier } from '../stats/StatEvaluator';
import { applyZoneDamageToCreature, applyZoneJointDamageToCreature } from '../utils/anatomyDamage';
import { EFFECTOR_CONFIG } from '../../config/effectorConfig';

export class AreaEffectorSystem {
  private pulseTimer: number = 0;
  private readonly PULSE_INTERVAL: number = EFFECTOR_CONFIG.pulseInterval;

  public update(dt: number, world: World, physics: PhysicsSystem): void {
    this.pulseTimer += dt;
    const isPulseTick = this.pulseTimer >= this.PULSE_INTERVAL;
    if (isPulseTick) {
      this.pulseTimer = 0;
    }

    // Зоны могут не иметь physicsBody, если мы удалим их физику, опираемся только на Transform
    const effectors = world.getEntitiesWith('areaEffector', 'transform');
    // Собираем всех потенциальных жертв заранее, чтобы избежать N*M запросов к ECS
    const targets = world.getEntitiesWith('transform', 'health', 'physicsStats', 'physicsBody');

    for (const [zoneId, { areaEffector, transform: zoneTransform }] of effectors) {
      const attachment = world.getComponent(zoneId, 'attachment');

      for (const [
        targetId,
        { transform: targetTransform, health, physicsStats, physicsBody },
      ] of targets) {
        if (!health.isAlive) continue;

        if ((physicsBody.category & (CollisionCategory.CREATURE | CollisionCategory.ITEM)) === 0) {
          continue;
        }

        // Иммунитет носителя ауры
        if (areaEffector.ignoreParent && attachment && attachment.parentId === targetId) {
          continue;
        }

        const targetRadius = physicsStats.radius.current ?? 0.4;

        // Цилиндрический расчет: горизонтальная дистанция в плоскости XZ + высота Y
        const dx = targetTransform.x - zoneTransform.x;
        const dy = Math.abs(targetTransform.y - zoneTransform.y);
        const dz = targetTransform.z - zoneTransform.z;
        const distXZ = Math.hypot(dx, dz);

        // Высота цилиндра зоны 2 метра (от -0.2м до +2.2м с запасом)
        if (dy > 2.5) continue;

        const effectiveRadius = areaEffector.radius + targetRadius;
        if (distXZ > effectiveRadius) continue; // Объект вне зоны
        const dist = distXZ;

        const targetTs = world.getComponent(targetId, 'timeScale')?.multiplier.current ?? 1.0;
        const localDt = dt * targetTs;
        const deltaValue = areaEffector.valuePerSec * localDt;

        // Поле замедления/ускорения времени
        if (areaEffector.effect === 'time_dilation') {
          const targetTimeScale = world.getComponent(targetId, 'timeScale');
          if (targetTimeScale) {
            let timeMultiplier = areaEffector.valuePerSec;

            // Плавное радиальное изменение эффекта времени от центра к границе
            if (
              areaEffector.distanceAttenuation &&
              areaEffector.centerValue !== undefined &&
              areaEffector.boundaryValue !== undefined
            ) {
              const t = Math.min(1, Math.max(0, dist / effectiveRadius));
              timeMultiplier =
                areaEffector.centerValue +
                (areaEffector.boundaryValue - areaEffector.centerValue) * t;
            }

            addModifier(targetTimeScale.multiplier, {
              id: `zone_td_${zoneId}`,
              type: ModifierType.PERCENT_MULT,
              value: Math.max(0, timeMultiplier),
              duration: 0.15, // Быстро спадает при выходе из зоны
            });
          }
          continue;
        }

        // 1. Урон
        if (areaEffector.effect === 'damage') {
          const tag = world.getComponent(targetId, 'tag');
          const hasAnatomy =
            world.getComponent(targetId, 'assemblyRoot') ||
            world.getComponent(targetId, 'socketDef') ||
            tag?.archetype === 'creature';

          if (hasAnatomy) {
            applyZoneDamageToCreature(world, physics, targetId, deltaValue);
          } else {
            applyDamage(world, targetId, deltaValue, isPulseTick);
          }
        }
        // 1.1. Урон только по соединениям (суставам) существ
        else if (areaEffector.effect === 'joint_damage') {
          const tag = world.getComponent(targetId, 'tag');
          const hasAnatomy =
            world.getComponent(targetId, 'assemblyRoot') ||
            world.getComponent(targetId, 'socketDef') ||
            tag?.archetype === 'creature';

          if (hasAnatomy) {
            applyZoneJointDamageToCreature(world, physics, targetId, deltaValue);
          }
        }
        // 2. Лечение
        else if (areaEffector.effect === 'heal') {
          applyHeal(world, targetId, deltaValue, isPulseTick);
        }
        // 3. Отталкивание (Repel) и Притягивание (Attract) импульсом с учетом массы и 3D вектора
        else if (areaEffector.effect === 'repel' || areaEffector.effect === 'attract') {
          // Защита от деления на ноль и дерганья в самом центре воронки
          if (areaEffector.effect === 'attract' && dist <= 0.2) continue;

          const ux = dist > 0.001 ? dx / dist : Math.random() - 0.5;
          const uy = dist > 0.001 ? dy / dist : Math.random() - 0.5;
          const uz = dist > 0.001 ? dz / dist : Math.random() - 0.5;
          const len = Math.hypot(ux, uy, uz) || 1;

          let forceMagnitude = areaEffector.valuePerSec;
          if (
            areaEffector.distanceAttenuation &&
            areaEffector.centerValue !== undefined &&
            areaEffector.boundaryValue !== undefined
          ) {
            const t = Math.min(1, Math.max(0, dist / effectiveRadius));
            forceMagnitude =
              areaEffector.centerValue +
              (areaEffector.boundaryValue - areaEffector.centerValue) * t;
          }

          const sign = areaEffector.effect === 'repel' ? 1 : -1;
          const weight = physicsStats.totalWeight ?? physicsStats.weight.current ?? 1;

          // Для динамических тел Rapier (ящики, выброшенные предметы) прикладываем физический импульс и будим тело
          if (physicsBody.rawBody && physicsBody.bodyType === 'dynamic') {
            if (physicsBody.rawBody.isSleeping()) {
              physicsBody.rawBody.wakeUp();
            }
            const impulseMag = forceMagnitude * dt;
            physicsBody.rawBody.applyImpulse(
              {
                x: sign * (ux / len) * impulseMag,
                y: sign * (uy / len) * impulseMag,
                z: sign * (uz / len) * impulseMag,
              },
              true
            );
            continue;
          }

          // Для кинематических персонажей передаем импульс в скорость ECS
          const velocity = world.getComponent(targetId, 'velocity');
          if (!velocity) continue;

          const acceleration = forceMagnitude / Math.max(1, weight);
          velocity.externalVx = (velocity.externalVx ?? 0) + sign * (ux / len) * acceleration * dt;
          velocity.externalVy = (velocity.externalVy ?? 0) + sign * (uy / len) * acceleration * dt;
          velocity.externalVz = (velocity.externalVz ?? 0) + sign * (uz / len) * acceleration * dt;
        }
      }
    }
  }
}
