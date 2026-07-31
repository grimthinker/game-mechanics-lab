import { Creature } from './Creature';
import { PhysicsSystem } from './PhysicsSystem';
import { Camera } from './Camera';
import { Renderer } from './Renderer';
import { CreatureConfig, CreatureType, ObstacleSegment, Point, WeaponConfig } from './types';

export class GameApp {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  public physics: PhysicsSystem;
  public camera: Camera;
  public creatures: Creature[] = [];
  public selectedCreature: Creature | null = null;
  public onFrame: (() => void) | null = null;

  private lastTime: number = 0;
  private isRunning: boolean = false;

  private handleResize = () => this.resizeCanvas();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.physics = new PhysicsSystem();
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
    crouchStealthMultiplier: number = 1.5,
  ): Creature {
    const prefix = type === 'player' ? 'player' : 'bot';
    const config: CreatureConfig = {
      id: `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      type,
      position: position ? { ...position } : {
        x: 100 + Math.random() * (this.canvas.width - 200),
        y: 100 + Math.random() * (this.canvas.height - 200),
      },
      radius,
      mass,
      maxSpeed,
      maxTurnSpeed: (maxTurnSpeedDeg * Math.PI) / 180,
      maxHp: 100,
      hp: 100,
      weapons,
      runSpeedMultiplier,
      crouchSpeedMultiplier,
      crouchStealthMultiplier,
    };

    const creature = new Creature(config);
    this.creatures.push(creature);
    this.physics.addCreature(creature);
    return creature;
  }

  public deleteSelectedCreature(): void {
    if (!this.selectedCreature) return;
    const idx = this.creatures.indexOf(this.selectedCreature);
    if (idx !== -1) {
      this.physics.removeCreature(this.selectedCreature);
      this.creatures.splice(idx, 1);
      this.selectedCreature = null;
    }
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

    for (const creature of this.creatures) {
      creature.update(
        dt,
        (attacker, weapon) => {
          const targets = this.physics.checkWeaponHits(attacker, weapon, this.creatures);
          for (const target of targets) {
            const mult = weapon.minMultiplier + Math.random() * (weapon.maxMultiplier - weapon.minMultiplier);
            let damage = weapon.baseDamage * mult;
            const isCrit = Math.random() < weapon.critChance;
            if (isCrit) damage *= weapon.critMultiplier;
            target.takeDamage(Math.round(damage));
          }
        },
        this.physics
      );
    }

    this.physics.update(dt, this.creatures);
    for (const c of this.creatures) {
      c.syncFromPhysics();
    }

    this.renderer.render(this.camera, this.creatures, this.physics, this.selectedCreature);
    if (this.onFrame) this.onFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  public selectCreature(creature: Creature | null): void {
    this.selectedCreature = creature;
  }

  public pickCreatureAt(worldPoint: Point): Creature | null {
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const c = this.creatures[i];
      const dist = Math.hypot(c.position.x - worldPoint.x, c.position.y - worldPoint.y);
      if (dist <= c.radius) return c;
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