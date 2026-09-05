import { World } from '../World';

export class StealthSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('stealthStats', 'input', 'health');

    for (const [id, { stealthStats, input, health }] of entities) {
      const healthStats = world.getComponent(id, 'healthStats');
      if (!health.isAlive || (healthStats && healthStats.hp.current <= 0)) {
        stealthStats.stealthPower.current = 0;
        continue;
      }

      if (input.isCrouching) {
        stealthStats.stealthPower.current =
          stealthStats.stealthPower.base * stealthStats.crouchStealthMultiplier.current;
      } else if (input.isRunning) {
        stealthStats.stealthPower.current =
          stealthStats.stealthPower.base * stealthStats.runStealthMultiplier.current;
      } else {
        stealthStats.stealthPower.current = stealthStats.stealthPower.base;
      }
    }
  }
}