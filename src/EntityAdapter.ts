import { World } from './ecs/World';
import {
  CreatureState,
  CreatureType,
  EntityId,
  IMovable,
  EquipComponent,
  InventoryComponent,
  EntityController,
  StandardRadius,
} from './ecs/types';
import {
  EntityUtils,
  BTLogicComponent,
  AttackStatus,
  BehaviorStatsConfig,
} from './ai/core';
import { Point } from './types';

export class EntityAdapter implements IMovable, EntityController {
  public dt: number = 0;
  public utils!: EntityUtils;

  constructor(
    public readonly id: EntityId,
    private world: World,
    // private physics: PhysicsSystem
  ) {}

  public get type(): CreatureType {
    return this.world.getComponent(this.id, 'meta')!.type;
  }
  public get state(): CreatureState {
    return this.world.getComponent(this.id, 'meta')!.state;
  }
  public get radius(): StandardRadius {
    return this.world.getComponent(this.id, 'physicsBody')!.radius;
  }
  public get mass(): number {
    return this.world.getComponent(this.id, 'physicsBody')!.mass;
  }
  public get hp(): number {
    return this.world.getComponent(this.id, 'stats')!.hp.current;
  }
  public get maxHp(): number {
    return this.world.getComponent(this.id, 'stats')!.maxHp.current;
  }
  public get isAlive(): boolean {
    return this.world.getComponent(this.id, 'health')!.isAlive;
  }
  public get maxSpeed(): number {
    return this.world.getComponent(this.id, 'stats')!.maxSpeed.current;
  }
  public get maxTurnSpeed(): number {
    return this.world.getComponent(this.id, 'stats')!.maxTurnSpeed.current;
  }
  public get currentSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')!.currentSpeed;
  }
  public get currentTurnSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')!.currentTurnSpeed;
  }
  public get runSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')!.runSpeedMultiplier.current;
  }
  public get crouchSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')!.crouchSpeedMultiplier.current;
  }
  public get crouchStealthMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')!.crouchStealthMultiplier.current;
  }
  public get equip(): EquipComponent | undefined {
    return this.world.getComponent(this.id, 'equip');
  }
  public get inventory(): InventoryComponent | undefined {
    return this.world.getComponent(this.id, 'inventory');
  }

  public get brain(): BTLogicComponent | undefined {
    return this.world.getComponent(this.id, 'brain') as BTLogicComponent | undefined;
  }
  public get attack_status(): AttackStatus {
    const input = this.world.getComponent(this.id, 'input');
    return input?.wantsAttack ? 'attacking' : 'idle';
  }
  public get ai_stats(): BehaviorStatsConfig {
    return {
      detect_dist: 500,
      lose_target_dist: 700,
      in_pos_dist: 10,
      follow_stop_dist: 40,
      follow_up_dist: 50,
    };
  }

  public startMovingForward(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) input.isMovingForward = true;
  }
  public stopMovingForward(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isMovingForward = false;
  }
  public startTurning(direction: -1 | 1): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) input.turningDirection = direction;
  }
  public stopTurning(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.turningDirection = 0;
  }
  public startRunning(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) {
      input.isRunning = true;
      input.isCrouching = false;
    }
  }
  public stopRunning(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isRunning = false;
  }
  public startCrouching(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) {
      input.isCrouching = true;
      input.isRunning = false;
    }
  }
  public stopCrouching(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isCrouching = false;
  }

  public stop(): boolean {
    const input = this.world.getComponent(this.id, 'input');
    if (input) {
      input.isMovingForward = false;
      input.turningDirection = 0;
      input.wantsAttack = false;
    }
    return true;
  }
  public look_in_dir(angle: number): boolean {
    const transform = this.world.getComponent(this.id, 'transform');
    if (transform) transform.angle = angle;
    return true;
  }
  public look_at_pos(target_pos: Point): boolean {
    const transform = this.world.getComponent(this.id, 'transform');
    if (transform) {
      const dx = target_pos.x - transform.x;
      const dy = target_pos.y - transform.y;
      transform.angle = Math.atan2(dy, dx);
    }
    return true;
  }
  public attack(_id_target?: string): boolean {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.wantsAttack = true;
    return true;
  }
  public getPos(): Point {
    const transform = this.world.getComponent(this.id, 'transform');
    return transform ? { x: transform.x, y: transform.y } : { x: 0, y: 0 };
  }

  public updateInventorySize(width: number, height: number): boolean {
    const inv = this.world.getComponent(this.id, 'inventory');
    if (!inv) return false;
    const isEmpty = inv.slots.every((row) => row.every((cell) => !cell.item));
    if (!isEmpty) return false;

    inv.size = { width, height };
    inv.slots = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ item: null, count: 0 }))
    );
    return true;
  }

  public updateParams(params: {
    radius?: StandardRadius;
    maxSpeed?: number;
    maxTurnSpeed?: number;
    hp?: number;
    maxHp?: number;
    runSpeedMultiplier?: number;
    crouchSpeedMultiplier?: number;
    crouchStealthMultiplier?: number;
  }): void {
    const phys = this.world.getComponent(this.id, 'physicsBody');
    const stats = this.world.getComponent(this.id, 'stats');
    const health = this.world.getComponent(this.id, 'health');

    if (params.radius !== undefined && phys) {
      phys.radius = params.radius;
      phys.body.r = params.radius;
    }
    if (stats) {
      if (params.maxSpeed !== undefined) {
        const val = Math.max(0, params.maxSpeed);
        stats.maxSpeed.base = val;
        stats.maxSpeed.current = val;
      }
      if (params.maxTurnSpeed !== undefined) {
        const val = Math.max(0, params.maxTurnSpeed);
        stats.maxTurnSpeed.base = val;
        stats.maxTurnSpeed.current = val;
      }
      if (params.maxHp !== undefined) {
        const val = Math.max(1, params.maxHp);
        stats.maxHp.base = val;
        stats.maxHp.current = val;
      }
      if (params.hp !== undefined) {
        const val = Math.min(stats.maxHp.current, Math.max(0, params.hp));
        stats.hp.base = val;
        stats.hp.current = val;
        if (health) health.isAlive = val > 0;
      }
      if (params.runSpeedMultiplier !== undefined) {
        const val = Math.max(0.1, params.runSpeedMultiplier);
        stats.runSpeedMultiplier.base = val;
        stats.runSpeedMultiplier.current = val;
      }
      if (params.crouchSpeedMultiplier !== undefined) {
        const val = Math.max(0.1, params.crouchSpeedMultiplier);
        stats.crouchSpeedMultiplier.base = val;
        stats.crouchSpeedMultiplier.current = val;
      }
      if (params.crouchStealthMultiplier !== undefined) {
        const val = Math.max(1, params.crouchStealthMultiplier);
        stats.crouchStealthMultiplier.base = val;
        stats.crouchStealthMultiplier.current = val;
      }
    }
  }

  public canInteractWith(targetId: EntityId): boolean {
    const transform = this.world.getComponent(this.id, 'transform');
    const targetTransform = this.world.getComponent(targetId, 'transform');
    const stats = this.world.getComponent(this.id, 'stats');
    if (!transform || !targetTransform || !stats) return false;

    const dist = Math.hypot(transform.x - targetTransform.x, transform.y - targetTransform.y);
    return dist <= stats.interactionRange.current;
  }
}