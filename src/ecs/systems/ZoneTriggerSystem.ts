import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { CollisionCategory } from '../types';

export class ZoneTriggerSystem {
  private pulseTimer: number = 0;
  private readonly PULSE_INTERVAL: number = 0.4; // Интервал между вспышками (2.5 раза в сек)

  public update(dt: number, world: World, physics: PhysicsSystem): void {
    this.pulseTimer += dt;
    const isPulseTick = this.pulseTimer >= this.PULSE_INTERVAL;
    if (isPulseTick) {
      this.pulseTimer = 0;
    }

    const zones = world.getEntitiesWith('zoneTrigger', 'transform', 'physicsBody');

    for (const [
      zoneId,
      { zoneTrigger, transform: zoneTransform, physicsBody: zonePhys },
    ] of zones) {
      const deltaValue = zoneTrigger.valuePerSec * dt;
      const attachment = world.getComponent(zoneId, 'attachment');

      // Поиск перекрывающихся тел через пространственный движок (с учетом радиусов существ)
      physics.system.checkOne(zonePhys.body, (response) => {
        const otherBody = response.b === zonePhys.body ? response.a : response.b;
        const targetId = physics.getEntityByBody(otherBody);
        if (!targetId) return;

        const targetCat = (otherBody as any).category ?? CollisionCategory.NONE;
        if ((targetCat & CollisionCategory.CREATURE) === 0) return;

        // Иммунитет носителя ауры
        if (zoneTrigger.ignoreParent && attachment && attachment.parentId === targetId) {
          return;
        }

        const health = world.getComponent(targetId, 'health');
        if (!health || !health.isAlive || health.current <= 0) return;

        // 1. Урон
        if (zoneTrigger.effect === 'damage') {
          const nextHp = Math.max(0, health.current - deltaValue);
          health.current = Math.round(nextHp * 100) / 100;
          if (isPulseTick) {
            health.hitFlashTimer = 0.2;
          }
        }
        // 2. Лечение
        else if (zoneTrigger.effect === 'heal') {
          if (health.current < health.max.current) {
            const nextHp = Math.min(health.max.current, health.current + deltaValue);
            health.current = Math.round(nextHp * 100) / 100;
            if (isPulseTick) {
              health.healFlashTimer = 0.2;
            }
          }
        }
        // 3. Отталкивание (Repel) и Притягивание (Attract) импульсом с учетом массы и расстояния
        else if (zoneTrigger.effect === 'repel' || zoneTrigger.effect === 'attract') {
          const targetTransform = world.getComponent(targetId, 'transform');
          const targetPhysStats = world.getComponent(targetId, 'physicsStats');
          const velocity = world.getComponent(targetId, 'velocity');
          if (!targetTransform || !velocity) return;

          const dx = targetTransform.x - zoneTransform.x;
          const dy = targetTransform.y - zoneTransform.y;
          const dist = Math.hypot(dx, dy);

          if (zoneTrigger.effect === 'attract' && dist <= 4) return;

          const ux = dist > 0.001 ? dx / dist : Math.random() - 0.5;
          const uy = dist > 0.001 ? dy / dist : Math.random() - 0.5;
          const len = Math.hypot(ux, uy) || 1;

          let forceMagnitude = zoneTrigger.valuePerSec;
          if (
            zoneTrigger.distanceAttenuation &&
            zoneTrigger.centerValue !== undefined &&
            zoneTrigger.boundaryValue !== undefined
          ) {
            const radius = zoneTrigger.radius;
            const t = Math.min(1, Math.max(0, dist / radius));
            forceMagnitude =
              zoneTrigger.centerValue + (zoneTrigger.boundaryValue - zoneTrigger.centerValue) * t;
          }

          const weight = targetPhysStats?.weight.current ?? 1;
          const acceleration = forceMagnitude / Math.max(0.1, weight);

          const sign = zoneTrigger.effect === 'repel' ? 1 : -1;
          velocity.externalVx = (velocity.externalVx ?? 0) + sign * (ux / len) * acceleration * dt;
          velocity.externalVy = (velocity.externalVy ?? 0) + sign * (uy / len) * acceleration * dt;
        }
      });
    }
  }
}
