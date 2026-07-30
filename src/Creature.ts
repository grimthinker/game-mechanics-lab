import { Circle } from 'detect-collisions';
import { CreatureConfig, CreatureType, IMovable, Point } from './types';

export class Creature implements IMovable {
  public readonly id: string;
  public readonly type: CreatureType;
  public radius: number;
  public mass: number;
  public maxSpeed: number;
  public maxTurnSpeed: number;
  public maxHp: number;
  public hp: number;
  public isAlive: boolean = true;
  public isPlayer: boolean = false;
  public isNPC: boolean = false;
  public position: Point;
  public angle: number = 0; // В радианах

  // Состояния движения
  private isMovingForward: boolean = false;
  private turningDirection: -1 | 0 | 1 = 0;

  // Коллайдер из detect-collisions
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
    this.hp = Math.min(this.maxHp, Math.max(0, config.hp ?? this.maxHp));
    this.isPlayer = this.type === 'player';
    this.isNPC = this.type === 'ai';

    this.body = new Circle({ x: this.position.x, y: this.position.y }, this.radius);
    (this.body as any).entity = this;
  }

  // --- Реализация IMovable ---
  public startMovingForward(): void {
    this.isMovingForward = true;
  }

  public stopMovingForward(): void {
    this.isMovingForward = false;
  }

  public startTurning(direction: -1 | 1): void {
    this.turningDirection = direction;
  }

  public stopTurning(): void {
    this.turningDirection = 0;
  }

  public get currentSpeed(): number {
    return this.isMovingForward ? this.maxSpeed : 0;
  }

  public get currentTurnSpeed(): number {
    return this.turningDirection * this.maxTurnSpeed;
  }

  public update(dt: number): void {
    if (this.turningDirection !== 0) {
      this.angle += this.turningDirection * this.maxTurnSpeed * dt;
    }

    if (this.isMovingForward) {
      this.position.x += Math.cos(this.angle) * this.maxSpeed * dt;
      this.position.y += Math.sin(this.angle) * this.maxSpeed * dt;
      this.body.setPosition(this.position.x, this.position.y);
    }
  }

  public syncFromPhysics(): void {
    this.position.x = this.body.x;
    this.position.y = this.body.y;
  }

  /**
   * Обновляет параметры существа (скорость, здоровье и физический радиус коллайдера)
   */
  public updateParams(params: {
    radius?: number;
    maxSpeed?: number;
    maxTurnSpeed?: number;
    hp?: number;
    maxHp?: number;
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
  }
}