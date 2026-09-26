import { World } from '../World';

export class EnvironmentSystem {
  public update(dt: number, world: World): void {
    const envEntities = world.getEntitiesWith('environment');
    for (const [, { environment }] of envEntities) {
      if (environment.dayDuration <= 0) continue;

      const hoursPerSecond = 24.0 / environment.dayDuration;
      environment.timeOfDay = (environment.timeOfDay + dt * hoursPerSecond) % 24.0;
      if (environment.timeOfDay < 0) {
        environment.timeOfDay += 24.0;
      }
    }
  }
}
