import { World } from '../World';
import {
  EntityId,
  CreatureMovementMode,
  CreatureDirectionMode,
  CreatureActionMode,
} from '../types';
import { Point } from '../../types';
import { Radians } from '../../utils';

export class MovementAdapter {
  constructor(
    public readonly id: EntityId,
    private world: World
  ) {}

  private getComponent<K extends keyof import('../types').EntityComponents>(key: K) {
    return this.world.getComponent(this.id, key);
  }

  private getInputIfActive() {
    const health = this.getComponent('health');
    if (!health?.isAlive) return undefined;
    return this.getComponent('input');
  }

  public get pos(): Point {
    const transform = this.getComponent('transform');
    return transform ? { x: transform.x, y: transform.y } : { x: 0, y: 0 };
  }

  public get angle(): Radians {
    const transform = this.getComponent('transform');
    return (transform ? transform.angle : 0) as Radians;
  }

  public get radius(): number {
    return this.getComponent('physicsStats')?.radius.current ?? 16;
  }

  public get stance(): import('../types').CreatureStance {
    return this.getComponent('meta')?.stance ?? 'standing';
  }

  public get desiredStance(): import('../types').BaseCreatureStance {
    return this.getComponent('input')?.desiredStance ?? 'standing';
  }

  public get movementMode(): CreatureMovementMode {
    return this.getComponent('meta')?.movementMode ?? 'immobile';
  }

  public get directionMode(): CreatureDirectionMode {
    return this.getComponent('meta')?.directionMode ?? 'immobile';
  }

  public get actionMode(): CreatureActionMode {
    return this.getComponent('meta')?.actionMode ?? 'idle';
  }

  public get maxSpeed(): number {
    return this.getComponent('movementStats')?.maxSpeed.current ?? 0;
  }

  public get maxTurnSpeed(): Radians {
    return (this.getComponent('movementStats')?.maxTurnSpeed.current ?? 0) as Radians;
  }

  public setDesiredMoveVector(vec: Point | null): void {
    const input = this.getInputIfActive();
    if (input) {
      input.desiredMoveVector = vec ? { x: vec.x, y: vec.y } : null;
    }
  }

  public startMovingForward(): void {
    const input = this.getInputIfActive();
    if (input) {
      input.isMovingForward = true;
      input.moveForward = 1;
      const angle = this.angle;
      input.desiredMoveVector = { x: Math.cos(angle), y: Math.sin(angle) };
    }
  }

  public stopMovingForward(): void {
    const input = this.getComponent('input');
    if (input) {
      input.isMovingForward = false;
      if (input.moveForward === 1) input.moveForward = 0;
      input.desiredMoveVector = null;
    }
  }

  public startTurning(direction: -1 | 1, ratio = 1): void {
    const input = this.getInputIfActive();
    if (input) {
      input.turnDirection = direction;
      input.turnRatio = Math.max(0, Math.min(1, ratio));
    }
  }

  public stopTurning(): void {
    const input = this.getComponent('input');
    if (input) {
      input.turnDirection = 0;
      input.turnRatio = 0;
    }
  }

  public startRunning(): void {
    const input = this.getInputIfActive();
    if (input) input.isRunning = true;
  }

  public stopRunning(): void {
    const input = this.getComponent('input');
    if (input) input.isRunning = false;
  }

  public setDesiredStance(stance: import('../types').BaseCreatureStance): void {
    const input = this.getInputIfActive();
    if (input) {
      input.desiredStance = stance;
      input.isCrouching = stance === 'crouching';
    }
  }

  public stop(): boolean {
    const input = this.getComponent('input');
    if (input) {
      input.desiredMoveVector = null;
      input.moveForward = 0;
      input.moveStrafe = 0;
      input.isMovingForward = false;
      input.turnDirection = 0;
      input.turnRatio = 0;
    }
    return true;
  }
}
