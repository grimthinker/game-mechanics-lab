import { Circle } from 'detect-collisions';
import { CreatureConfig, CreatureType, CreatureState, IMovable, Point, WeaponConfig, ActiveAttack } from './types';
import { createDefaultWeapons } from './Weapon';
import type { PhysicsSystem } from './PhysicsSystem';

export class Creature implements IMovable {
  public readonly id: string;
  public readonly type: CreatureType;
  public radius: number;
  public mass: number;
  public maxSpeed: number;
  public maxTurnSpeed: number;
  public maxHp: number;
  public hp: number;
  public stealth: number;
  public baseStealth: number;
  public isAlive: boolean = true;
  public position: Point;
  public angle: number = 0;

  public weapons: WeaponConfig[] = [];
  public activeAttacks: ActiveAttack[] = [];
  public hitFlashTimer: number = 0;

  private isMovingForward: boolean = false;
  private turningDirection: -1 | 0 | 1 = 0;

  public body: Circle;

  constructor(config: CreatureConfig) {
    this.id = config.id;
    this.type = config.type;
    this.position = { ...config.position };
    this.radius = config.radius;
    this.mass = Math.max(0.1, config.mass);
    this.maxSpeed = Math.max(0, config.maxSpeed);
    this.maxTurnSpeed = Math.max(0, config.maxTurnSpeed);
    this.maxHp = Math.max(1, config.maxHp ?? 100);
    this.hp = Math.min(this.maxHp, config.hp ?? this.maxHp);
    this.baseStealth = config.baseStealth ?? 0;
    this.stealth = config.stealth ?? this.baseStealth;
    
    if (config.weapons && config.weapons.length > 0) {
      this.weapons = [...config.weapons];
    } else {
      const allWeapons = createDefaultWeapons();
      for (let i = allWeapons.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allWeapons[i], allWeapons[j]] = [allWeapons[j], allWeapons[i]];
      }
      this.weapons = allWeapons.slice(0, 3);
    }

    this.body = new Circle({ x: this.position.x, y: this.position.y }, this.radius);
    this.body.isStatic = false;
  }

  public get state(): CreatureState {
    if (!this.isAlive || this.hp <= 0) return 'dead';
    if (this.activeAttacks.length > 0) return 'attacking';
    if (this.isMovingForward || this.turningDirection !== 0) return 'moving';
    return 'idle';
  }

  public get currentSpeed(): number {
    if (!this.isAlive || this.hp <= 0) return 0;
    let slow = 1;
    for (const atk of this.activeAttacks) {
      const mult = atk.phase === 'prep' ? atk.weapon.prepMoveSlow : atk.weapon.recoveryMoveSlow;
      if (mult < slow) slow = mult;
    }
    return (this.isMovingForward ? this.maxSpeed : 0) * slow;
  }

  public get currentTurnSpeed(): number {
    if (!this.isAlive || this.hp <= 0) return 0;
    let slow = 1;
    for (const atk of this.activeAttacks) {
      const mult = atk.phase === 'prep' ? atk.weapon.prepTurnSlow : atk.weapon.recoveryTurnSlow;
      if (mult < slow) slow = mult;
    }
    return this.turningDirection * this.maxTurnSpeed * slow;
  }

  public getNextAvailableWeapon(): WeaponConfig | undefined {
    return this.weapons.find(w => !this.activeAttacks.some(a => a.weapon === w));
  }

  public startMovingForward(): void {
    if (this.isAlive && this.hp > 0) this.isMovingForward = true;
  }

  public stopMovingForward(): void {
    this.isMovingForward = false;
  }

  public startTurning(direction: -1 | 1): void {
    if (this.isAlive && this.hp > 0) this.turningDirection = direction;
  }

  public stopTurning(): void {
    this.turningDirection = 0;
  }

  public attack(): WeaponConfig | null {
    if (!this.isAlive || this.hp <= 0) return null;
    const freeWeapon = this.getNextAvailableWeapon();
    if (!freeWeapon) return null;

    this.activeAttacks.push({
      weapon: freeWeapon,
      phase: 'prep',
      timer: freeWeapon.prepTime,
      totalDuration: freeWeapon.prepTime,
    });
    return freeWeapon;
  }

  public update(
    dt: number,
    onHitCallback?: (attacker: Creature, weapon: WeaponConfig) => void,
    physics?: PhysicsSystem
  ): void {
    if (!this.isAlive || this.hp <= 0) return;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer--;
    }

    const turnSpeed = this.currentTurnSpeed;
    if (turnSpeed !== 0) {
      this.angle += turnSpeed * dt;
    }

    const speed = this.currentSpeed;
    if (speed > 0) {
      const dx = Math.cos(this.angle) * speed * dt;
      const dy = Math.sin(this.angle) * speed * dt;

      if (physics) {
        physics.moveCreatureSafe(this, dx, dy);
      } else {
        this.position.x += dx;
        this.position.y += dy;
        this.body.setPosition(this.position.x, this.position.y);
      }
    }

    for (let i = this.activeAttacks.length - 1; i >= 0; i--) {
      const atk = this.activeAttacks[i];
      atk.timer -= dt;
      if (atk.timer <= 0) {
        if (atk.phase === 'prep') {
          if (onHitCallback) {
            onHitCallback(this, atk.weapon);
          }
          this.hitFlashTimer = 6;
          atk.phase = 'recovery';
          atk.timer = atk.weapon.recoveryTime;
          atk.totalDuration = atk.weapon.recoveryTime;
        } else {
          this.activeAttacks.splice(i, 1);
        }
      }
    }
  }

  public syncFromPhysics(): void {
    this.position.x = this.body.x;
    this.position.y = this.body.y;
  }

  public takeDamage(amount: number): void {
    if (!this.isAlive || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.isAlive = false;
      this.isMovingForward = false;
      this.turningDirection = 0;
      this.activeAttacks = [];
      this.hitFlashTimer = 0;
    }
  }

  public updateParams(params: {
    radius?: number;
    maxSpeed?: number;
    maxTurnSpeed?: number;
    hp?: number;
    maxHp?: number;
    stealth?: number;
    baseStealth?: number;
  }): void {
    if (params.radius !== undefined) {
      this.radius = params.radius;
      this.body.r = params.radius;
    }
    if (params.maxSpeed !== undefined) {
      this.maxSpeed = Math.max(0, params.maxSpeed);
    }
    if (params.maxTurnSpeed !== undefined) {
      this.maxTurnSpeed = Math.max(0, params.maxTurnSpeed);
    }
    if (params.maxHp !== undefined) {
      this.maxHp = Math.max(1, params.maxHp);
    }
    if (params.hp !== undefined) {
      this.hp = Math.min(this.maxHp, Math.max(0, params.hp));
    }
    if (params.stealth !== undefined) {
      this.stealth = params.stealth;
    }
    if (params.baseStealth !== undefined) {
      this.baseStealth = params.baseStealth;
    }
    this.hp = Math.min(this.hp, this.maxHp);
    this.isAlive = this.hp > 0;
  }
}