import { Circle } from 'detect-collisions';
import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { CollisionCategory, ModifierType } from '../types';
import { applyDamage, applyHeal } from '../utils/health';
import { addModifier } from '../stats/StatEvaluator';

export class AreaEffectorSystem {
  private pulseTimer: number = 0;
  private readonly PULSE_INTERVAL: number = 0.4; // Интервал между вспышками (2.5 раза в сек)

  public update(dt: number, world: World, physics: PhysicsSystem): void {
    this.pulseTimer += dt;
    const isPulseTick = this.pulseTimer >= this.PULSE_INTERVAL;
    if (isPulseTick) {
      this.pulseTimer = 0;
    }

    const effectors = world.getEntitiesWith('areaEffector', 'transform', 'physicsBody');

    for (const [
      zoneId,
      { areaEffector, transform: zoneTransform, physicsBody: zonePhys },
    ] of effectors) {
      const attachment = world.getComponent(zoneId, 'attachment');

      // Поиск перекрывающихся тел через пространственный движок (с учетом радиусов существ)
      physics.system.checkOne(zonePhys.body, (response) => {
        const otherBody = response.b === zonePhys.body ? response.a : response.b;
        const targetId = physics.getEntityByBody(otherBody);
        if (!targetId) return;

        const targetPhys = world.getComponent(targetId, 'physicsBody');
        if (!targetPhys || (targetPhys.category & CollisionCategory.CREATURE) === 0) return;

        // Иммунитет носителя ауры
        if (areaEffector.ignoreParent && attachment && attachment.parentId === targetId) {
          return;
        }

        const health = world.getComponent(targetId, 'health');
        if (!health || !health.isAlive) return;

        const targetTs = world.getComponent(targetId, 'timeScale')?.multiplier.current ?? 1.0;
        const localDt = dt * targetTs;
        const deltaValue = areaEffector.valuePerSec * localDt;

        // Поле замедления/ускорения времени (с поддержкой плавного затухания от центра к краям)
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
              const targetTransform = world.getComponent(targetId, 'transform');
              const targetPhysStats = world.getComponent(targetId, 'physicsStats');
              if (targetTransform) {
                const targetRadius =
                  targetPhysStats?.radius.current ??
                  (targetPhys.body instanceof Circle ? targetPhys.body.r : 16);
                const effectiveRadius = areaEffector.radius + targetRadius;
                const dist = Math.hypot(
                  targetTransform.x - zoneTransform.x,
                  targetTransform.y - zoneTransform.y
                );
                const t = Math.min(1, Math.max(0, dist / effectiveRadius));
                timeMultiplier =
                  areaEffector.centerValue +
                  (areaEffector.boundaryValue - areaEffector.centerValue) * t;
              }
            }

            addModifier(targetTimeScale.multiplier, {
              id: `zone_td_${zoneId}`,
              type: ModifierType.PERCENT_MULT,
              value: Math.max(0, timeMultiplier),
              duration: 0.15, // Быстро спадает при выходе из зоны
            });
          }
          return;
        }

        // 1. Урон
        if (areaEffector.effect === 'damage') {
          applyDamage(world, targetId, deltaValue, isPulseTick);
        }
        // 2. Лечение
        else if (areaEffector.effect === 'heal') {
          applyHeal(world, targetId, deltaValue, isPulseTick);
        }
        // 3. Отталкивание (Repel) и Притягивание (Attract) импульсом с учетом массы и расстояния
        else if (areaEffector.effect === 'repel' || areaEffector.effect === 'attract') {
          const targetTransform = world.getComponent(targetId, 'transform');
          const targetPhysStats = world.getComponent(targetId, 'physicsStats');
          const velocity = world.getComponent(targetId, 'velocity');
          if (!targetTransform || !velocity) return;

          const targetRadius =
            targetPhysStats?.radius.current ??
            (targetPhys.body instanceof Circle ? targetPhys.body.r : 16);
          const effectiveRadius = areaEffector.radius + targetRadius;

          const dx = targetTransform.x - zoneTransform.x;
          const dy = targetTransform.y - zoneTransform.y;
          const dist = Math.hypot(dx, dy);

          if (areaEffector.effect === 'attract' && dist <= 4) return;

          const ux = dist > 0.001 ? dx / dist : Math.random() - 0.5;
          const uy = dist > 0.001 ? dy / dist : Math.random() - 0.5;
          const len = Math.hypot(ux, uy) || 1;

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

          const weight = targetPhysStats?.weight.current ?? 1;
          const acceleration = forceMagnitude / Math.max(0.1, weight);

          const sign = areaEffector.effect === 'repel' ? 1 : -1;
          velocity.externalVx = (velocity.externalVx ?? 0) + sign * (ux / len) * acceleration * dt;
          velocity.externalVy = (velocity.externalVy ?? 0) + sign * (uy / len) * acceleration * dt;
        }
      });
    }
  }
}
