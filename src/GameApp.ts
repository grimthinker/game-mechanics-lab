import { Creature } from './Creature';
import { PhysicsSystem } from './PhysicsSystem';
import { CreatureConfig, CreatureType, ObstacleSegment, Point, WeaponConfig } from './types';

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

  private isPanning: boolean = false;
  private panStartX: number = 0;
  private panStartY: number = 0;
  private totalPanDistance: number = 0;

  private handleResize = () => this.resizeCanvas();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.physics = new PhysicsSystem();

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
      maxHp: 100,
      hp: 100,
      weapons,
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

    this.render();
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
    this.isPanning = true;
    this.panStartX = clientX;
    this.panStartY = clientY;
    this.totalPanDistance = 0;
  }

  public pan(clientX: number, clientY: number): void {
    if (!this.isPanning) return;
    const dx = clientX - this.panStartX;
    const dy = clientY - this.panStartY;
    this.totalPanDistance += Math.hypot(dx, dy);
    this.camera.offsetX += dx;
    this.camera.offsetY += dy;
    this.panStartX = clientX;
    this.panStartY = clientY;
  }

  public endPan(): boolean {
    const wasDragging = this.totalPanDistance > 5;
    this.isPanning = false;
    return wasDragging;
  }

  public zoomAt(clientX: number, clientY: number, deltaY: number): void {
    const factor = deltaY < 0 ? 1.1 : 0.9;
    const newScale = Math.min(this.maxScale, Math.max(this.minScale, this.camera.scale * factor));
    const rect = this.canvas.getBoundingClientRect();
    const screen = { x: clientX - rect.left, y: clientY - rect.top };
    const world = {
      x: (screen.x - this.camera.offsetX) / this.camera.scale,
      y: (screen.y - this.camera.offsetY) / this.camera.scale,
    };
    this.camera.scale = newScale;
    this.camera.offsetX = screen.x - world.x * newScale;
    this.camera.offsetY = screen.y - world.y * newScale;
  }

  public getCanvasPoint(clientX: number, clientY: number): Point {
    const rect = this.canvas.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    return {
      x: (screenX - this.camera.offsetX) / this.camera.scale,
      y: (screenY - this.camera.offsetY) / this.camera.scale,
    };
  }

  public loadObstaclesFromData(segments: ObstacleSegment[]): void {
    this.physics.loadObstacles(segments);
  }

  private render(): void {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.translate(this.camera.offsetX, this.camera.offsetY);
    this.ctx.scale(this.camera.scale, this.camera.scale);

    this.renderGrid();
    this.renderObstacles();
    this.renderCreatures();

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

    this.ctx.strokeStyle = '#222';
    this.ctx.lineWidth = 1 / scale;
    this.ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSize) {
      this.ctx.moveTo(x, top);
      this.ctx.lineTo(x, bottom);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      this.ctx.moveTo(left, y);
      this.ctx.lineTo(right, y);
    }
    this.ctx.stroke();
  }

  private renderObstacles(): void {
    this.ctx.strokeStyle = '#555';
    this.ctx.lineWidth = 3 / this.camera.scale;
    this.ctx.beginPath();
    for (const line of this.physics.getObstacleLines()) {
      this.ctx.moveTo(line.start.x, line.start.y);
      this.ctx.lineTo(line.end.x, line.end.y);
    }
    this.ctx.stroke();
  }

  private renderCreatures(): void {
    for (const c of this.creatures) {
      this.ctx.save();
      this.ctx.translate(c.position.x, c.position.y);

      // Вращаем только тело существа и зоны атаки оружия
      this.ctx.save();
      this.ctx.rotate(c.angle);

      let color = c.type === 'player' ? '#3498db' : '#e74c3c';
      if (!c.isAlive) {
        color = '#7f8c8d';
      } else {
        switch (c.state) {
          case 'idle':
            color = c.type === 'player' ? '#2980b9' : '#c0392b';
            break;
          case 'moving':
            color = c.type === 'player' ? '#3498db' : '#e74c3c';
            break;
          case 'attacking':
            color = c.type === 'player' ? '#e67e22' : '#f39c12';
            break;
          case 'dead':
            color = '#7f8c8d';
            break;
        }
      }

      this.ctx.beginPath();
      this.ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();

      if (c === this.selectedCreature) {
        this.ctx.strokeStyle = '#f1c40f';
        this.ctx.lineWidth = 3 / this.camera.scale;
        this.ctx.stroke();
      }

      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.lineTo(c.radius + 10, 0);
      this.ctx.strokeStyle = '#f1c40f';
      this.ctx.lineWidth = 2 / this.camera.scale;
      this.ctx.stroke();

      const activeAtk = c.activeAttacks[0];
      const weaponToDraw = activeAtk ? activeAtk.weapon : c.getNextAvailableWeapon();

      if (weaponToDraw) {
        let zoneAlpha = 0.15;
        let zoneColor = '#f1c40f';

        if (c.hitFlashTimer > 0) {
          zoneColor = '#e74c3c';
          zoneAlpha = 0.9;
        } else if (activeAtk) {
          if (activeAtk.phase === 'prep') {
            zoneColor = '#f39c12';
            zoneAlpha = 0.5;
          } else if (activeAtk.phase === 'recovery') {
            zoneAlpha = 0;
          }
        }

        if (zoneAlpha > 0) {
          this.ctx.save();
          this.ctx.fillStyle = zoneColor;
          this.ctx.strokeStyle = zoneColor;
          this.ctx.globalAlpha = zoneAlpha;
          this.ctx.lineWidth = 2 / this.camera.scale;

          switch (weaponToDraw.hitZoneType) {
            case 'radius': {
              const r = weaponToDraw.radius ?? 50;
              this.ctx.beginPath();
              this.ctx.arc(0, 0, r, 0, Math.PI * 2);
              this.ctx.fill();
              this.ctx.stroke();
              break;
            }
            case 'angle': {
              const len = weaponToDraw.length ?? 100;
              const maxAngle = (weaponToDraw.angle ?? (Math.PI / 6)) / 2;
              this.ctx.beginPath();
              this.ctx.moveTo(0, 0);
              this.ctx.arc(0, 0, len, -maxAngle, maxAngle);
              this.ctx.closePath();
              this.ctx.fill();
              this.ctx.stroke();
              break;
            }
            case 'line':
            case 'forward_line': {
              const len = weaponToDraw.length ?? 150;
              this.ctx.beginPath();
              this.ctx.moveTo(0, -c.radius);
              this.ctx.lineTo(len, -c.radius);
              this.ctx.lineTo(len, c.radius);
              this.ctx.lineTo(0, c.radius);
              this.ctx.closePath();
              this.ctx.fill();
              this.ctx.stroke();
              break;
            }
            case 'shrapnel': {
              const len = weaponToDraw.length ?? 120;
              const maxAngle = (weaponToDraw.angle ?? Math.PI / 3) / 2;
              const count = weaponToDraw.rayCount ?? 5;
              for (let i = 0; i < count; i++) {
                const fraction = count > 1 ? i / (count - 1) - 0.5 : 0;
                const rayAngle = fraction * (maxAngle * 2);
                this.ctx.beginPath();
                this.ctx.moveTo(0, 0);
                this.ctx.lineTo(Math.cos(rayAngle) * len, Math.sin(rayAngle) * len);
                this.ctx.stroke();
              }
              break;
            }
            case 'offset_radius': {
              const offset = weaponToDraw.offsetDistance ?? 70;
              const r = weaponToDraw.radius ?? 35;
              this.ctx.beginPath();
              this.ctx.arc(offset, 0, r, 0, Math.PI * 2);
              this.ctx.fill();
              this.ctx.stroke();
              break;
            }
          }
          this.ctx.restore();
        }
      }

      // Восстанавливаем контекст после поворота, оставаясь в точке (c.position.x, c.position.y)
      this.ctx.restore();

      // Рисуем полоску здоровья горизонтально поверх изображения зоны попадания
      if (c.isAlive) {
        const barW = c.radius * 2;
        const barH = 4 / this.camera.scale;
        const hpRatio = Math.max(0, Math.min(1, c.hp / c.maxHp));
        this.ctx.fillStyle = '#c0392b';
        this.ctx.fillRect(-barW / 2, -c.radius - 10 / this.camera.scale, barW, barH);
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fillRect(-barW / 2, -c.radius - 10 / this.camera.scale, barW * hpRatio, barH);
      }

      this.ctx.restore();
    }
  }
}