import { World } from '../World';
import { StanceSystem } from './movement/StanceSystem';
import { MovementModifierSystem } from './movement/MovementModifierSystem';
import { VelocitySystem } from './movement/VelocitySystem';

export class MovementSystem {
  private stanceSystem = new StanceSystem();
  private movementModifierSystem = new MovementModifierSystem();
  private velocitySystem = new VelocitySystem();

  public update(dt: number, world: World): void {
    const localDt = dt;

    this.stanceSystem.update(localDt, world);
    this.movementModifierSystem.update(world);
    this.velocitySystem.update(dt, localDt, world);
  }
}
