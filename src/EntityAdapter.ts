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

export class EntityAdapter implements IMovable, EntityController {
  public dt: number = 0;
  public utils!: EntityUtils;

  constructor(
    public readonly id: EntityId,
    private world: World
  ) {}

  public get behavior(): string {
    return this.world.getComponent(this.id, 'stats')?.behavior.current ?? this.world.getComponent(this.id, 'meta')?.config?.behavior ?? 'IdleTree';
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
    return this.world.getComponent(this.id, 'stats')?.radius.current 
        ?? this.world.getComponent(this.id, 'physicsBody')?.radius 
        ?? 16;
  }
  public get baseRadius(): number {
    return this.world.getComponent(this.id, 'stats')?.radius.base ?? this.radius;
  }
  public get weight(): number {
    return this.world.getComponent(this.id, 'stats')?.weight.current
        ?? this.world.getComponent(this.id, 'physicsBody')?.weight 
        ?? this.world.getComponent(this.id, 'meta')?.config?.weight 
        ?? 10;
  }
  public get hp(): number {
    return this.world.getComponent(this.id, 'stats')?.hp.current ?? 0;
  }
  public get maxHp(): number {
    return this.world.getComponent(this.id, 'stats')?.maxHp.current ?? 0;
  }
  public get isAlive(): boolean {
    return this.world.getComponent(this.id, 'health')?.isAlive ?? (this.hp > 0);
  }
  public get maxSpeed(): number {
    return this.world.getComponent(this.id, 'stats')?.maxSpeed.current ?? 0;
  }
  public get maxTurnSpeed(): number {
    return this.world.getComponent(this.id, 'stats')?.maxTurnSpeed.current ?? 0;
  }
  public get currentSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')?.currentSpeed ?? 0;
  }
  public get currentTurnSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')?.currentTurnSpeed ?? 0;
  }
  public get runSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')?.runSpeedMultiplier.current ?? 1.5;
  }
  public get crouchSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')?.crouchSpeedMultiplier.current ?? 0.5;
  }
  public get crouchStealthMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')?.crouchStealthMultiplier.current ?? 1.5;
  }
  public get runTurnMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')?.runTurnMultiplier?.current ?? 0.8;
  }
  public get crouchTurnMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')?.crouchTurnMultiplier?.current ?? 1.2;
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
    const stats = this.world.getComponent(this.id, 'stats');
    const maxTurnSpeed = stats ? stats.maxTurnSpeed.current : 0;
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
    const stats = this.world.getComponent(this.id, 'stats');
    const meta = this.world.getComponent(this.id, 'meta');
    if (!stats || !meta || stats.behavior.current === newBehavior) return;

    stats.behavior.current = newBehavior;
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
    },
    aiSystem?: AISystem,
    physicsSystem?: PhysicsSystem
  ): void {
    if (params.behavior !== undefined && aiSystem) {
      this.setBehavior(params.behavior, aiSystem);
    }

    const meta = this.world.getComponent(this.id, 'meta');
    const phys = this.world.getComponent(this.id, 'physicsBody');
    const stats = this.world.getComponent(this.id, 'stats');
    const health = this.world.getComponent(this.id, 'health');

    if (stats) {
      if (params.baseRadius !== undefined) {
        stats.radius.base = params.baseRadius;
        if (meta?.config) meta.config.radius = params.baseRadius;
      }
      if (params.radius !== undefined) {
        stats.radius.current = params.radius;
      }
      if (params.weight !== undefined) {
        const val = Math.max(0.1, params.weight);
        stats.weight.base = val;
        stats.weight.current = val;
        if (meta?.config) meta.config.weight = val;
      }
      if (params.isSolid !== undefined) {
        stats.isSolid.base = params.isSolid;
        stats.isSolid.current = params.isSolid;
        if (meta?.config) meta.config.isSolid = params.isSolid;
      }
      if (params.maxSpeed !== undefined) {
        const val = Math.max(0, params.maxSpeed);
        stats.maxSpeed.base = val;
        stats.maxSpeed.current = val;
        if (meta?.config) meta.config.maxSpeed = val;
      }
      if (params.maxTurnSpeed !== undefined) {
        const val = Math.max(0, params.maxTurnSpeed);
        stats.maxTurnSpeed.base = val;
        stats.maxTurnSpeed.current = val;
        if (meta?.config) meta.config.maxTurnSpeed = (val * 180) / Math.PI; 
      }
      if (params.maxHp !== undefined) {
        const val = Math.max(1, params.maxHp);
        stats.maxHp.base = val;
        stats.maxHp.current = val;
        if (meta?.config) meta.config.maxHp = val;
      }
      if (params.hp !== undefined) {
        const val = Math.min(stats.maxHp.current, Math.max(0, params.hp));
        stats.hp.base = val;
        stats.hp.current = val;
        if (health) health.isAlive = val > 0;
        if (meta?.config) meta.config.hp = val;
      }
      if (params.runSpeedMultiplier !== undefined) {
        const val = Math.max(0.1, params.runSpeedMultiplier);
        stats.runSpeedMultiplier.base = val;
        stats.runSpeedMultiplier.current = val;
        if (meta?.config) meta.config.runSpeedMultiplier = val;
      }
      if (params.crouchSpeedMultiplier !== undefined) {
        const val = Math.max(0.1, params.crouchSpeedMultiplier);
        stats.crouchSpeedMultiplier.base = val;
        stats.crouchSpeedMultiplier.current = val;
        if (meta?.config) meta.config.crouchSpeedMultiplier = val;
      }
      if (params.crouchStealthMultiplier !== undefined) {
        const val = Math.max(1, params.crouchStealthMultiplier);
        stats.crouchStealthMultiplier.base = val;
        stats.crouchStealthMultiplier.current = val;
        if (meta?.config) meta.config.crouchStealthMultiplier = val;
      }
      if (params.runTurnMultiplier !== undefined) {
        const val = Math.max(0.1, params.runTurnMultiplier);
        stats.runTurnMultiplier.base = val;
        stats.runTurnMultiplier.current = val;
        if (meta?.config) meta.config.runTurnMultiplier = val;
      }
      if (params.crouchTurnMultiplier !== undefined) {
        const val = Math.max(0.1, params.crouchTurnMultiplier);
        stats.crouchTurnMultiplier.base = val;
        stats.crouchTurnMultiplier.current = val;
        if (meta?.config) meta.config.crouchTurnMultiplier = val;
      }
      
      if (phys) {
        phys.radius = stats.radius.current as StandardRadius;
        phys.body.r = stats.radius.current;
        phys.weight = stats.weight.current;
      }

      if (physicsSystem) {
        const wasSolid = !!phys;
        const isSolidNow = stats.isSolid.current;
        if (!wasSolid && isSolidNow) {
          const transform = this.world.getComponent(this.id, 'transform');
          if (transform) {
            const body = new Circle({ x: transform.x, y: transform.y }, stats.radius.current as StandardRadius);
            body.isStatic = false;
            this.world.addComponent(this.id, 'physicsBody', { body, radius: stats.radius.current as StandardRadius, weight: stats.weight.current, isStatic: false });
            physicsSystem.registerBody(this.id, body);
          }
        } else if (wasSolid && !isSolidNow) {
          physicsSystem.unregisterBody(phys!.body);
          this.world.removeComponent(this.id, 'physicsBody');
        }
      }
    }
  }
}