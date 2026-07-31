import { Circle } from 'detect-collisions';
import { World } from './ecs/World';
import { EntityId } from './ecs/types';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { MovementSystem } from './ecs/systems/MovementSystem';
import { AttackSystem } from './ecs/systems/AttackSystem';
import { DamageSystem } from './ecs/systems/DamageSystem';
import { Camera } from './Camera';
import { Renderer } from './Renderer';
import { createDefaultWeapons } from './Weapon';
import {
  CreatureType,
  CreatureState,
  ObstacleSegment,
  Point,
  WeaponConfig,
  IMovable,
} from './types';

// Адаптер для полной обратной совместимости с React-хуками и App.tsx
export class EntityAdapter implements IMovable {
  constructor(
    public readonly id: EntityId,
    private world: World,
    private physics: PhysicsSystem
  ) {}

  public get type(): CreatureType {
    return this.world.getComponent(this.id, 'meta')!.type;
  }
  public get state(): CreatureState {
    return this.world.getComponent(this.id, 'meta')!.state;
  }
  public get radius(): number {
    return this.world.getComponent(this.id, 'physicsBody')!.radius;
  }
  public get mass(): number {
    return this.world.getComponent(this.id, 'physicsBody')!.mass;
  }
  public get hp(): number {
    return this.world.getComponent(this.id, 'health')!.hp;
  }
  public get maxHp(): number {
    return this.world.getComponent(this.id, 'health')!.maxHp;
  }
  public get isAlive(): boolean {
    return this.world.getComponent(this.id, 'health')!.isAlive;
  }
  public get maxSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')!.maxSpeed;
  }
  public get maxTurnSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')!.maxTurnSpeed;
  }
  public get currentSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')!.currentSpeed;
  }
  public get currentTurnSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')!.currentTurnSpeed;
  }
  public get runSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'velocity')!.runSpeedMultiplier;
  }
  public get crouchSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'velocity')!.crouchSpeedMultiplier;
  }
  public get crouchStealthMultiplier(): number {
    return this.world.getComponent(this.id, 'stealth')!.crouchStealthMultiplier;
  }
  public get weapons(): WeaponConfig[] {
    return this.world.getComponent(this.id, 'weaponInventory')!.weapons;
  }

  public startMovingForward(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && health.hp > 0) input.isMovingForward = true;
  }
  public stopMovingForward(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isMovingForward = false;
  }
  public startTurning(direction: -1 | 1): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && health.hp > 0) input.turningDirection = direction;
  }
  public stopTurning(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.turningDirection = 0;
  }
  public startRunning(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && health.hp > 0) {
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
    if (input && health?.isAlive && health.hp > 0) {
      input.isCrouching = true;
      input.isRunning = false;
    }
  }
  public stopCrouching(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isCrouching = false;
  }
  public attack(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.wantsAttack = true;
  }

  public updateParams(params: {
    radius?: number;
    maxSpeed?: number;
    maxTurnSpeed?: number;
    hp?: number;
    maxHp?: number;
    runSpeedMultiplier?: number;
    crouchSpeedMultiplier?: number;
    crouchStealthMultiplier?: number;
  }): void {
    const phys = this.world.getComponent(this.id, 'physicsBody');
    const vel = this.world.getComponent(this.id, 'velocity');
    const health = this.world.getComponent(this.id, 'health');
    const stealth = this.world.getComponent(this.id, 'stealth');

    if (params.radius !== undefined && phys) {
      phys.radius = params.radius;
      phys.body.r = params.radius;
    }
    if (params.maxSpeed !== undefined && vel) vel.maxSpeed = Math.max(0, params.maxSpeed);
    if (params.maxTurnSpeed !== undefined && vel) vel.maxTurnSpeed = Math.max(0, params.maxTurnSpeed);
    if (params.maxHp !== undefined && health) health.maxHp = Math.max(1, params.maxHp);
    if (params.hp !== undefined && health) {
      health.hp = Math.min(health.maxHp, Math.max(0, params.hp));
      health.isAlive = health.hp > 0;
    }
    if (params.runSpeedMultiplier !== undefined && vel) vel.runSpeedMultiplier = Math.max(0.1, params.runSpeedMultiplier);
    if (params.crouchSpeedMultiplier !== undefined && vel) vel.crouchSpeedMultiplier = Math.max(0.1, params.crouchSpeedMultiplier);
    if (params.crouchStealthMultiplier !== undefined && stealth) stealth.crouchStealthMultiplier = Math.max(1, params.crouchStealthMultiplier);
  }
}

export class GameApp {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  public world: World;
  public physics: PhysicsSystem;
  private movementSystem: MovementSystem;
  private attackSystem: AttackSystem;
  private damageSystem: DamageSystem;
  public camera: Camera;

  public selectedCreature: EntityAdapter | null = null;
  public onFrame: (() => void) | null = null;

  private lastTime: number = 0;
  private isRunning: boolean = false;
  private handleResize = () => this.resizeCanvas();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.world = new World();
    this.physics = new PhysicsSystem();
    this.movementSystem = new MovementSystem();
    this.attackSystem = new AttackSystem();
    this.damageSystem = new DamageSystem();
    this.camera = new Camera();

    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);
  }

  private resizeCanvas(): void {
    const parent = this.canvas.parentElement;
    if (parent) {
      this.canvas.width = parent.clientWidth;
      this.canvas.height = parent.clientHeight;
    }
  }

  public spawnCreature(
    type: CreatureType,
    radius: number = 24,
    mass: number = 10,
    maxSpeed: number = 150,
    maxTurnSpeedDeg: number = 270,
    position?: Point,
    weapons?: WeaponConfig[],
    runSpeedMultiplier: number = 1.5,
    crouchSpeedMultiplier: number = 0.5,
    crouchStealthMultiplier: number = 1.5
  ): EntityAdapter {
    const prefix = type === 'player' ? 'player' : 'bot';
    const id = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const pos = position
      ? { ...position }
      : {
          x: 100 + Math.random() * (this.canvas.width - 200),
          y: 100 + Math.random() * (this.canvas.height - 200),
        };

    const body = new Circle({ x: pos.x, y: pos.y }, radius);
    body.isStatic = false;

    let initialWeapons = weapons;
    if (!initialWeapons || initialWeapons.length === 0) {
      const allWeapons = createDefaultWeapons();
      for (let i = allWeapons.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allWeapons[i], allWeapons[j]] = [allWeapons[j], allWeapons[i]];
      }
      initialWeapons = allWeapons.slice(0, 3);
    }

    this.world.createEntity(id);
    this.world.addComponent(id, 'transform', { x: pos.x, y: pos.y, angle: 0 });
    this.world.addComponent(id, 'physicsBody', { body, radius, mass: Math.max(0.1, mass), isStatic: false });
    this.world.addComponent(id, 'velocity', {
      maxSpeed: Math.max(0, maxSpeed),
      maxTurnSpeed: (Math.max(0, maxTurnSpeedDeg) * Math.PI) / 180,
      currentSpeed: 0,
      currentTurnSpeed: 0,
      runSpeedMultiplier: Math.max(0.1, runSpeedMultiplier),
      crouchSpeedMultiplier: Math.max(0.1, crouchSpeedMultiplier),
    });
    this.world.addComponent(id, 'input', {
      isMovingForward: false,
      turningDirection: 0,
      isRunning: false,
      isCrouching: false,
      wantsAttack: false,
    });
    this.world.addComponent(id, 'health', { hp: 100, maxHp: 100, isAlive: true, hitFlashTimer: 0 });
    this.world.addComponent(id, 'stealth', {
      stealth: 0,
      baseStealth: 0,
      crouchStealthMultiplier: Math.max(1, crouchStealthMultiplier),
    });
    this.world.addComponent(id, 'weaponInventory', { weapons: [...initialWeapons], activeAttacks: [] });
    this.world.addComponent(id, 'meta', { id, type, state: 'idle' });

    this.physics.registerBody(id, body);

    return new EntityAdapter(id, this.world, this.physics);
  }

  public deleteSelectedCreature(): void {
    if (!this.selectedCreature) return;
    const id = this.selectedCreature.id;
    const phys = this.world.getComponent(id, 'physicsBody');
    if (phys) {
      this.physics.unregisterBody(phys.body);
    }
    this.world.removeEntity(id);
    this.selectedCreature = null;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.loop(t));
  }

  public destroy(): void {
    this.isRunning = false;
    window.removeEventListener('resize', this.handleResize);
  }

  private loop(time: number): void {
    if (!this.isRunning) return;

    const dt = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;

    // Последовательный запуск изолированных систем ECS
    this.movementSystem.update(dt, this.world, this.physics);
    this.attackSystem.update(dt, this.world, this.physics);
    this.physics.update(dt, this.world);
    this.damageSystem.update(dt, this.world);

    this.renderer.render(
      this.camera,
      this.world,
      this.physics,
      this.selectedCreature ? this.selectedCreature.id : null
    );

    if (this.onFrame) this.onFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  public selectCreature(creature: EntityAdapter | null): void {
    this.selectedCreature = creature;
  }

  public pickCreatureAt(worldPoint: Point): EntityAdapter | null {
    const entities = this.world.getEntitiesWith('transform', 'physicsBody');
    for (let i = entities.length - 1; i >= 0; i--) {
      const [id, { transform, physicsBody }] = entities[i];
      const dist = Math.hypot(transform.x - worldPoint.x, transform.y - worldPoint.y);
      if (dist <= physicsBody.radius) {
        return new EntityAdapter(id, this.world, this.physics);
      }
    }
    return null;
  }

  public startPan(clientX: number, clientY: number): void {
    this.camera.startPan(clientX, clientY);
  }
  public pan(clientX: number, clientY: number): void {
    this.camera.pan(clientX, clientY);
  }
  public endPan(): boolean {
    return this.camera.endPan();
  }
  public zoomAt(clientX: number, clientY: number, deltaY: number): void {
    this.camera.zoomAt(clientX, clientY, deltaY, this.canvas);
  }
  public getCanvasPoint(clientX: number, clientY: number): Point {
    return this.camera.getCanvasPoint(clientX, clientY, this.canvas);
  }
  public loadObstaclesFromData(segments: ObstacleSegment[]): void {
    this.physics.loadObstacles(segments);
  }
}