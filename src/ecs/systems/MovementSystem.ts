import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { StanceSystem } from './movement/StanceSystem';
import { MovementModifierSystem } from './movement/MovementModifierSystem';
import { VelocitySystem } from './movement/VelocitySystem';

export class MovementSystem {
  private stanceSystem = new StanceSystem();
  private movementModifierSystem = new MovementModifierSystem();
  private velocitySystem = new VelocitySystem();

  public update(dt: number, world: World, physics?: PhysicsSystem): void {
    this.stanceSystem.update(dt, world, physics);
    this.velocitySystem.update(dt, world);
    this.movementModifierSystem.update(world);
  }
}
