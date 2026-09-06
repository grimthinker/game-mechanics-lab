import { World } from '../World';

export class ZoneTriggerSystem {
  public update(dt: number, world: World): void {
    const zones = world.getEntitiesWith('zoneTrigger', 'transform');
    const targets = world.getEntitiesWith('transform', 'health', 'healthStats');

    for (const [_zoneId, { zoneTrigger, transform: zoneTransform }] of zones) {
      const radiusSq = zoneTrigger.radius * zoneTrigger.radius;
      const deltaValue = zoneTrigger.valuePerSec * dt;

      for (const [_targetId, { transform: targetTransform, health, healthStats }] of targets) {
        if (!health.isAlive || healthStats.hp.current <= 0) continue;

        const dx = targetTransform.x - zoneTransform.x;
        const dy = targetTransform.y - zoneTransform.y;
        const distSq = dx * dx + dy * dy;

        if (distSq <= radiusSq) {
            if (zoneTrigger.effect === 'damage') {
              const nextHp = Math.max(0, healthStats.hp.current - deltaValue);
              healthStats.hp.current = Math.round(nextHp * 100) / 100;
              health.hitFlashTimer = 2;
            } else if (zoneTrigger.effect === 'heal') {
              const nextHp = Math.min(healthStats.maxHp.current, healthStats.hp.current + deltaValue);
              healthStats.hp.current = Math.round(nextHp * 100) / 100;
            }
          }
      }
    }
  }
}