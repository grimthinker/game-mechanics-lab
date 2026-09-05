import { World } from './ecs/World';
import {
  CreatureState,
  EntityId,
  IMovable,
  EquipComponent,
  InventoryComponent,
  EntityController,
  StandardRadius,
  CreatureConfig,
} from './ecs/types';
import {
  EntityUtils,
  BTLogicComponent,
  AttackStatus,
  BehaviorStatsConfig,
} from './ai/core';
import { AISystem } from './ecs/systems/AISystem';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { Circle } from 'detect-collisions';
import { Point } from './types';
import { COLLISION_MASK_ALL, COLLISION_MASK_NONE } from './ecs/types';

export class EntityAdapter implements IMovable, EntityController {
  public dt: number = 0;
  public utils!: EntityUtils;

  constructor(
    public readonly id: EntityId,
    private world: World
  ) {}

  public get behavior(): string {
    return this.world.getComponent(this.id, 'aiStats')?.behavior.current ?? this.world.getComponent(this.id, 'meta')?.config?.behavior ?? 'IdleTree';
  }
  public get state(): CreatureState {
    return this.world.getComponent(this.id, 'meta')?.state ?? 'idle';
  }
  public get pos(): Point {
    const transform = this.world.getComponent(this.id, 'transform');
    return transform ? { x: transform.x, y: transform.y } : { x: 0, y: 0 };
  }
  public get angle(): number {
    const transform = this.world.getComponent(this.id, 'transform');
    return transform ? transform.angle : 0;
  }
  public get radius(): StandardRadius {
    return this.world.getComponent(this.id, 'physicsStats')?.radius.current 
        ?? (this.world.getComponent(this.id, 'physicsBody')?.body.r as StandardRadius)
        ?? 16;
  }
  public get baseRadius(): StandardRadius {
    return this.world.getComponent(this.id, 'physicsStats')?.radius.base ?? this.radius;
  }
  public get weight(): number {
    return this.world.getComponent(this.id, 'physicsStats')?.weight.current
        ?? this.world.getComponent(this.id, 'meta')?.config?.weight 
        ?? 10;
  }
  public get baseWeight(): number {
    return this.world.getComponent(this.id, 'physicsStats')?.weight.base ?? this.weight;
  }
  public get isSolid(): boolean {
    return this.world.getComponent(this.id, 'physicsStats')?.isSolid.current ?? true;
  }
  public get hp(): number {
    return this.world.getComponent(this.id, 'healthStats')?.hp.current ?? 0;
  }
  public get maxHp(): number {
    return this.world.getComponent(this.id, 'healthStats')?.maxHp.current ?? 0;
  }
  public get isAlive(): boolean {
    return this.world.getComponent(this.id, 'health')?.isAlive ?? (this.hp > 0);
  }
  public get maxSpeed(): number {
    return this.world.getComponent(this.id, 'movementStats')?.maxSpeed.current ?? 0;
  }
  public get maxTurnSpeed(): number {
    return this.world.getComponent(this.id, 'movementStats')?.maxTurnSpeed.current ?? 0;
  }
  public get currentSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')?.currentSpeed ?? 0;
  }
  public get currentTurnSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')?.currentTurnSpeed ?? 0;
  }
  public get runSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'movementStats')?.runSpeedMultiplier.current ?? 1.5;
  }
  public get crouchSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'movementStats')?.crouchSpeedMultiplier.current ?? 0.5;
  }
  public get crouchStealthMultiplier(): number {
    return this.world.getComponent(this.id, 'stealthStats')?.crouchStealthMultiplier.current ?? 1.5;
  }
  public get stealthPower(): number {
    return this.world.getComponent(this.id, 'stealthStats')?.stealthPower.current ?? 10;
  }
  public get baseStealthPower(): number {
    return this.world.getComponent(this.id, 'stealthStats')?.stealthPower.base ?? this.stealthPower;
  }
  public get runStealthMultiplier(): number {
    return this.world.getComponent(this.id, 'stealthStats')?.runStealthMultiplier.current ?? 0.5;
  }
  public get runTurnMultiplier(): number {
    return this.world.getComponent(this.id, 'movementStats')?.runTurnMultiplier?.current ?? 0.8;
  }
  public get crouchTurnMultiplier(): number {
    return this.world.getComponent(this.id, 'movementStats')?.crouchTurnMultiplier?.current ?? 1.2;
  }
  public get equip(): EquipComponent | undefined {
    return this.world.getComponent(this.id, 'equip');
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
  public startTurning(direction: -1 | 1, ratio = 1): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    const moveStats = this.world.getComponent(this.id, 'movementStats');
    const maxTurnSpeed = moveStats ? moveStats.maxTurnSpeed.current : 0;
    const turnSpeed = maxTurnSpeed * ratio;
    if (input && health?.isAlive && this.hp > 0) {
      input.turnDirection = direction;
      input.turnSpeed = turnSpeed;
    }
  }
  public stopTurning(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.turnDirection = 0;
    if (input) input.turnSpeed = 0;
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
      input.turnDirection = 0;
      input.turnSpeed = 0;
      input.wantsAttack = false;
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

  public setBehavior(newBehavior: string, aiSystem: AISystem): void {
    const aiStats = this.world.getComponent(this.id, 'aiStats');
    const meta = this.world.getComponent(this.id, 'meta');
    if (!aiStats || !meta || aiStats.behavior.current === newBehavior) return;

    aiStats.behavior.current = newBehavior;
    if (meta.config) meta.config.behavior = newBehavior;
    aiSystem.initBotBrain(this.world, this.id, newBehavior);

    this.stop();
    const input = this.world.getComponent(this.id, 'input');
    if (input) {
      input.isRunning = false;
      input.isCrouching = false;
    }
  }

  public updateParams(
    params: {
      behavior?: string;
      radius?: StandardRadius;
      baseRadius?: StandardRadius;
      weight?: number;
      baseWeight?: number;
      isSolid?: boolean;
      maxSpeed?: number;
      maxTurnSpeed?: number;
      hp?: number;
      maxHp?: number;
      runSpeedMultiplier?: number;
      crouchSpeedMultiplier?: number;
      crouchStealthMultiplier?: number;
      runTurnMultiplier?: number;
      crouchTurnMultiplier?: number;
      stealthPower?: number;
      runStealthMultiplier?: number;
    },
    aiSystem?: AISystem,
    physicsSystem?: PhysicsSystem
  ): void {
    if (params.behavior !== undefined && aiSystem) {
      this.setBehavior(params.behavior, aiSystem);
    }

    const meta = this.world.getComponent(this.id, 'meta');
    const phys = this.world.getComponent(this.id, 'physicsBody');
    const physStats = this.world.getComponent(this.id, 'physicsStats');
    const healthStats = this.world.getComponent(this.id, 'healthStats');
    const moveStats = this.world.getComponent(this.id, 'movementStats');
    const stealthStats = this.world.getComponent(this.id, 'stealthStats');
    const health = this.world.getComponent(this.id, 'health');

    if (physStats) {
      if (params.baseRadius !== undefined) {
        physStats.radius.base = params.baseRadius;
        if (meta?.config) meta.config.radius = params.baseRadius;
      }
      if (params.radius !== undefined) {
        physStats.radius.current = params.radius;
      }
      if (params.baseWeight !== undefined) {
        const val = Math.max(0.1, params.baseWeight);
        physStats.weight.base = val;
        if (meta?.config) meta.config.weight = val;
      }
      if (params.weight !== undefined) {
        const val = Math.max(0.1, params.weight);
        physStats.weight.current = val;
      }
      if (params.isSolid !== undefined) {
        physStats.isSolid.base = params.isSolid;
        physStats.isSolid.current = params.isSolid;
        if (meta?.config) meta.config.isSolid = params.isSolid;
      }
    }

    if (moveStats) {
      if (params.maxSpeed !== undefined) {
        const val = Math.max(0, params.maxSpeed);
        moveStats.maxSpeed.base = val;
        moveStats.maxSpeed.current = val;
        if (meta?.config) meta.config.maxSpeed = val;
      }
      if (params.maxTurnSpeed !== undefined) {
        const val = Math.max(0, params.maxTurnSpeed);
        moveStats.maxTurnSpeed.base = val;
        moveStats.maxTurnSpeed.current = val;
        if (meta?.config) meta.config.maxTurnSpeed = (val * 180) / Math.PI; 
      }
      if (params.runSpeedMultiplier !== undefined) {
        const val = Math.max(0.1, params.runSpeedMultiplier);
        moveStats.runSpeedMultiplier.base = val;
        moveStats.runSpeedMultiplier.current = val;
        if (meta?.config) meta.config.runSpeedMultiplier = val;
      }
      if (params.crouchSpeedMultiplier !== undefined) {
        const val = Math.max(0.1, params.crouchSpeedMultiplier);
        moveStats.crouchSpeedMultiplier.base = val;
        moveStats.crouchSpeedMultiplier.current = val;
        if (meta?.config) meta.config.crouchSpeedMultiplier = val;
      }
      if (params.runTurnMultiplier !== undefined) {
        const val = Math.max(0.1, params.runTurnMultiplier);
        moveStats.runTurnMultiplier.base = val;
        moveStats.runTurnMultiplier.current = val;
        if (meta?.config) meta.config.runTurnMultiplier = val;
      }
      if (params.crouchTurnMultiplier !== undefined) {
        const val = Math.max(0.1, params.crouchTurnMultiplier);
        moveStats.crouchTurnMultiplier.base = val;
        moveStats.crouchTurnMultiplier.current = val;
        if (meta?.config) meta.config.crouchTurnMultiplier = val;
      }
    }

    if (healthStats) {
      if (params.maxHp !== undefined) {
        const val = Math.max(1, params.maxHp);
        healthStats.maxHp.base = val;
        healthStats.maxHp.current = val;
        if (meta?.config) meta.config.maxHp = val;
      }
      if (params.hp !== undefined) {
        const val = Math.min(healthStats.maxHp.current, Math.max(0, params.hp));
        healthStats.hp.base = val;
        healthStats.hp.current = val;
        if (health) health.isAlive = val > 0;
        if (meta?.config) meta.config.hp = val;
      }
    }

    if (stealthStats) {
      if (params.stealthPower !== undefined) {
        const val = Math.max(0, params.stealthPower);
        stealthStats.stealthPower.base = val;
        stealthStats.stealthPower.current = val;
        if (meta?.config) meta.config.stealthPower = val;
      }
      if (params.runStealthMultiplier !== undefined) {
        const val = Math.max(0, params.runStealthMultiplier);
        stealthStats.runStealthMultiplier.base = val;
        stealthStats.runStealthMultiplier.current = val;
        if (meta?.config) meta.config.runStealthMultiplier = val;
      }
      if (params.crouchStealthMultiplier !== undefined) {
        const val = Math.max(1, params.crouchStealthMultiplier);
        stealthStats.crouchStealthMultiplier.base = val;
        stealthStats.crouchStealthMultiplier.current = val;
        if (meta?.config) meta.config.crouchStealthMultiplier = val;
      }
    }

    if (phys && physStats) {
      phys.body.r = physStats.radius.current;
      if (params.isSolid !== undefined) {
        phys.mask = params.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
        (phys.body as any).mask = phys.mask;
      }
    }
  }
}