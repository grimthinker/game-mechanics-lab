import { Creature } from './Creature';
import { PhysicsSystem } from './PhysicsSystem';
import { CreatureConfig, CreatureType, ObstacleSegment, Point } from './types';

export class GameApp {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public physics: PhysicsSystem;
  public creatures: Creature[] = [];
  public selectedCreature: Creature | null = null;
  public onFrame: (() => void) | null = null;

  private lastTime: number = 0;
  private isRunning: boolean = false;
  private camera = { scale: 1, offsetX: 0, offsetY: 0 };
  private readonly minScale = 0.25;
  private readonly maxScale = 4;

  // Переменные для панорамирования камеры
  private isPanning: boolean = false;
  private panStartScreenPos: Point = { x: 0, y: 0 };
  private isMouseDownOnCreature: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private totalPanDistance: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.physics = new PhysicsSystem();

    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
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
  ): Creature {
    const config: CreatureConfig = {
      id: `creature_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      type,
      position: position ? { ...position } : {
        x: 100 + Math.random() * (this.canvas.width - 200),
        y: 100 + Math.random() * (this.canvas.height - 200),
      },
      radius,
      mass,
      maxSpeed,
      maxTurnSpeed: (maxTurnSpeedDeg * Math.PI) / 180,
    };

    const creature = new Creature(config);

    creature.isAlive = true;
    creature.isPlayer = type === 'player';
    creature.isNPC = type === 'ai';

    this.creatures.push(creature);
    this.physics.addCreature(creature);
    this.selectCreature(creature);
    return creature;
  }

  public selectCreature(creature: Creature | null): void {
    this.selectedCreature = creature;
  }

  public pickCreatureAt(point: Point): Creature | null {
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const creature = this.creatures[i];
      const dx = point.x - creature.position.x;
      const dy = point.y - creature.position.y;
      if (dx * dx + dy * dy <= creature.radius * creature.radius) {
        return creature;
      }
    }
    return null;
  }

  public getCanvasPoint(clientX: number, clientY: number): Point {
    const screen = this.getScreenPoint(clientX, clientY);
    return this.screenToWorld(screen);
  }

  public zoomAt(clientX: number, clientY: number, deltaY: number): void {
    const screen = this.getScreenPoint(clientX, clientY);
    const factor = deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(
      this.maxScale,
      Math.max(this.minScale, this.camera.scale * factor),
    );

    const world = this.screenToWorld(screen);
    this.camera.scale = newScale;
    this.camera.offsetX = screen.x - world.x * newScale;
    this.camera.offsetY = screen.y - world.y * newScale;
  }

  // --- Перемещение камеры (Pan) ---

  public startPan(clientX: number, clientY: number): void {
    this.isPanning = true;
    this.panStartX = clientX;
    this.panStartY = clientY;
    this.totalPanDistance = 0;
  }

  public pan(clientX: number, clientY: number): void {
    if (!this.isPanning) return;
    const dx = clientX - this.panStartX;
    const dy = clientY - this.panStartY;
    this.camera.offsetX += dx;
    this.camera.offsetY += dy;
    this.panStartX = clientX;
    this.panStartY = clientY;
    this.totalPanDistance += Math.abs(dx) + Math.abs(dy);
  }

  public endPan(): boolean {
    if (!this.isPanning) return false;
    this.isPanning = false;
    return this.totalPanDistance > 4;
  }

  private getScreenPoint(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  private screenToWorld(screen: Point): Point {
    return {
      x: (screen.x - this.camera.offsetX) / this.camera.scale,
      y: (screen.y - this.camera.offsetY) / this.camera.scale,
    };
  }

  public loadObstaclesFromData(segments: ObstacleSegment[]): void {
    this.physics.loadObstacles(segments);
  }

  public start(): void {
    this.isRunning = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private loop(currentTime: number): void {
    if (!this.isRunning) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    for (const creature of this.creatures) {
      creature.update(dt);
    }

    this.physics.resolveCollisions(this.creatures, dt);
    this.render();

    this.onFrame?.();

    requestAnimationFrame(this.loop.bind(this));
  }

  private render(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.translate(this.camera.offsetX, this.camera.offsetY);
    this.ctx.scale(this.camera.scale, this.camera.scale);

    this.renderGrid();

    if (this.physics.obstaclesEnabled) {
      this.ctx.strokeStyle = '#e74c3c';
      this.ctx.lineWidth = 4 / this.camera.scale;
      this.ctx.beginPath();
      for (const line of this.physics.getObstacleLines()) {
        this.ctx.moveTo(line.start.x, line.start.y);
        this.ctx.lineTo(line.end.x, line.end.y);
      }
      this.ctx.stroke();
    }

    for (const c of this.creatures) {
      const isSelected = c === this.selectedCreature;

      this.ctx.save();
      this.ctx.translate(c.position.x, c.position.y);

      if (isSelected) {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, c.radius + 6, 0, Math.PI * 2);
        this.ctx.strokeStyle = '#f1c40f';
        this.ctx.lineWidth = 3 / this.camera.scale;
        this.ctx.stroke();
      }

      this.ctx.beginPath();
      this.ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = c.type === 'player' ? '#3498db' : '#9b59b6';
      this.ctx.fill();
      this.ctx.strokeStyle = isSelected ? '#f1c40f' : '#ffffff';
      this.ctx.lineWidth = (isSelected ? 3 : 2) / this.camera.scale;
      this.ctx.stroke();

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(Math.cos(c.angle) * (c.radius + 10), Math.sin(c.angle) * (c.radius + 10));
      this.ctx.strokeStyle = '#f1c40f';
      this.ctx.lineWidth = 3 / this.camera.scale;
      this.ctx.stroke();

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `${10 / this.camera.scale}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`m:${c.mass}`, 0, 4);

      this.ctx.restore();
    }

    this.ctx.restore();
  }

  private renderGrid(): void {
    const { scale, offsetX, offsetY } = this.camera;
    const gridSize = 64;

    const left = -offsetX / scale;
    const top = -offsetY / scale;
    const right = (this.canvas.width - offsetX) / scale;
    const bottom = (this.canvas.height - offsetY) / scale;

    const startX = Math.floor(left / gridSize) * gridSize;
    const endX = Math.ceil(right / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;
    const endY = Math.ceil(bottom / gridSize) * gridSize;

    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    this.ctx.lineWidth = 1 / scale;

    this.ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();
  }
}