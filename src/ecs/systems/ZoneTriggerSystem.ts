import { World } from '../World';

export class ZoneTriggerSystem {
  private pulseTimer: number = 0;
  private readonly PULSE_INTERVAL: number = 0.4; // Интервал между вспышками (2.5 раза в сек)

  public update(dt: number, world: World): void {
    this.pulseTimer += dt;
    const isPulseTick = this.pulseTimer >= this.PULSE_INTERVAL;
    if (isPulseTick) {
      this.pulseTimer = 0;
    }

    const zones = world.getEntitiesWith('zoneTrigger', 'transform');
    const targets = world.getEntitiesWith('transform', 'health');

    for (const [_zoneId, { zoneTrigger, transform: zoneTransform }] of zones) {
      const radiusSq = zoneTrigger.radius * zoneTrigger.radius;
      const deltaValue = zoneTrigger.valuePerSec * dt;

      for (const [_targetId, { transform: targetTransform, health }] of targets) {
        if (!health.isAlive || health.current <= 0) continue;

        const dx = targetTransform.x - zoneTransform.x;
        const dy = targetTransform.y - zoneTransform.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
          if (zoneTrigger.effect === 'damage') {
            const nextHp = Math.max(0, health.current - deltaValue);
            health.current = Math.round(nextHp * 100) / 100;
            if (isPulseTick) {
              health.hitFlashTimer = 6;
            }
          } else if (zoneTrigger.effect === 'heal') {
            if (health.current < health.max.current) {
              const nextHp = Math.min(health.max.current, health.current + deltaValue);
              health.current = Math.round(nextHp * 100) / 100;
              if (isPulseTick) {
                health.healFlashTimer = 6;
              }
            }
          }
        }
      }
    }
  }
}
