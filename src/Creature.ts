import { Circle } from 'detect-collisions';
import { CreatureConfig, CreatureType, IMovable, Point } from './types';

export class Creature implements IMovable {
  public readonly id: string;
  public readonly type: CreatureType;
  public radius: number;
  public mass: number;
  public maxSpeed: number;
  public maxTurnSpeed: number;
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
    

    // Создаем физическое тело-окружность
    this.body = new Circle({ x: this.position.x, y: this.position.y }, this.radius);
    // Сохраняем ссылку на сам Creature внутри тела для удобной идентификации
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

  // --- Обновление логики движения ---
  public update(dt: number): void {
    // 1. Поворот (мгновенная скорость)
    if (this.turningDirection !== 0) {
      this.angle += this.turningDirection * this.maxTurnSpeed * dt;
    }

    // 2. Поступательное движение вперед (без инерции)
    if (this.isMovingForward) {
      this.position.x += Math.cos(this.angle) * this.maxSpeed * dt;
      this.position.y += Math.sin(this.angle) * this.maxSpeed * dt;
    }

    // 3. Синхронизация позиции физического тела
    this.body.setPosition(this.position.x, this.position.y);
  }

  // Синхронизация позиции обратно из физического тела (после решения коллизий)
  public syncFromPhysics(): void {
    this.position.x = this.body.x;
    this.position.y = this.body.y;
  }
}