import { World } from './ecs/World';
import { Camera } from './Camera';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { EntityId } from './ecs/types';

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  public render(
    camera: Camera,
    world: World,
    physics: PhysicsSystem,
    selectedId: EntityId | null
  ): void {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.translate(camera.offsetX, camera.offsetY);
    this.ctx.scale(camera.scale, camera.scale);

    this.renderGrid(camera);
    this.renderObstacles(camera, physics);
    this.renderEntities(world, camera, selectedId);

    this.ctx.restore();
  }

  private renderGrid(camera: Camera): void {
    const { scale, offsetX, offsetY } = camera;
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

  private renderObstacles(camera: Camera, physics: PhysicsSystem): void {
    this.ctx.strokeStyle = '#555';
    this.ctx.lineWidth = 3 / camera.scale;
    this.ctx.beginPath();
    for (const line of physics.getObstacleLines()) {
      this.ctx.moveTo(line.start.x, line.start.y);
      this.ctx.lineTo(line.end.x, line.end.y);
    }
    this.ctx.stroke();
  }

  private renderEntities(world: World, camera: Camera, selectedId: EntityId | null): void {
    const entities = world.getEntitiesWith(
      'transform',
      'physicsBody',
      'health',
      'weaponInventory',
      'meta'
    );

    // 1. Отрисовка зон атак живых существ
    for (const [, { transform, health, weaponInventory }] of entities) {
      const activeAtk = weaponInventory.activeAttacks[0];
      const weaponToDraw =
        activeAtk?.weapon ||
        weaponInventory.weapons.find(
          (w) => !weaponInventory.activeAttacks.some((a) => a.weapon === w)
        );

      if (health.isAlive && weaponToDraw) {
        this.ctx.save();
        this.ctx.translate(transform.x, transform.y);
        this.ctx.rotate(transform.angle);

        let zoneAlpha = 0.15;
        let zoneColor = '#f1c40f';

        if (health.hitFlashTimer > 0) {
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
          this.ctx.fillStyle = zoneColor;
          this.ctx.strokeStyle = zoneColor;
          this.ctx.globalAlpha = zoneAlpha;
          this.ctx.lineWidth = 2 / camera.scale;

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
              const maxAngle = (weaponToDraw.angle ?? Math.PI / 6) / 2;
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
              this.ctx.moveTo(0, 0);
              this.ctx.lineTo(len, 0);
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
        }
        this.ctx.restore();
      }
    }

    const renderBody = (
      id: EntityId,
      transform: any,
      phys: any,
      health: any,
      meta: any
    ) => {
      this.ctx.save();
      this.ctx.translate(transform.x, transform.y);

      this.ctx.save();
      this.ctx.rotate(transform.angle);

      let fillColor = '#34495e';
      if (!health.isAlive) {
        fillColor = '#7f8c8d';
      } else {
        switch (meta.state) {
          case 'idle':
            fillColor = '#34495e';
            break;
          case 'moving':
            fillColor = '#3498db';
            break;
          case 'running':
            fillColor = '#2ecc71';
            break;
          case 'crouching':
            fillColor = '#9b59b6';
            break;
          case 'attacking':
            fillColor = '#e67e22';
            break;
          case 'dead':
            fillColor = '#7f8c8d';
            break;
        }
      }

      this.ctx.beginPath();
      this.ctx.arc(0, 0, phys.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = fillColor;
      this.ctx.fill();

      const borderColor = meta.type === 'player' ? '#2980b9' : '#c0392b';
      this.ctx.strokeStyle = borderColor;
      this.ctx.lineWidth = 2 / camera.scale;
      this.ctx.stroke();

      if (id === selectedId) {
        this.ctx.strokeStyle = '#f1c40f';
        this.ctx.lineWidth = 3 / camera.scale;
        this.ctx.stroke();
      }

      this.ctx.beginPath();
      const arrowLen = phys.radius;
      const headLen = 12;
      const headWidth = headLen * 1;

      this.ctx.moveTo(arrowLen, 0);
      this.ctx.lineTo(arrowLen - headLen, -headWidth);
      this.ctx.moveTo(arrowLen, 0);
      this.ctx.lineTo(arrowLen - headLen, headWidth);
      this.ctx.lineTo(arrowLen - headLen, -headWidth);

      this.ctx.strokeStyle = '#f1c40f';
      this.ctx.lineWidth = 2 / camera.scale;
      this.ctx.stroke();

      this.ctx.restore();

      if (health.isAlive) {
        const barW = phys.radius * 2;
        const barH = 4 / camera.scale;
        const hpRatio = Math.max(0, Math.min(1, health.hp / health.maxHp));
        this.ctx.fillStyle = '#c0392b';
        this.ctx.fillRect(-barW / 2, -phys.radius - 16 / camera.scale, barW, barH);
        this.ctx.fillStyle = '#2ecc71';
        this.ctx.fillRect(-barW / 2, -phys.radius - 16 / camera.scale, barW * hpRatio, barH);

        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = `${Math.max(10, 11 / camera.scale)}px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(meta.id, 0, -phys.radius - 20 / camera.scale);
      }

      this.ctx.restore();
    };

    // 2. Мертвые существа (слой ниже)
    for (const [id, { transform, physicsBody, health, meta }] of entities) {
      if (!health.isAlive) {
        renderBody(id, transform, physicsBody, health, meta);
      }
    }

    // 3. Живые существа (верхний слой)
    for (const [id, { transform, physicsBody, health, meta }] of entities) {
      if (health.isAlive) {
        renderBody(id, transform, physicsBody, health, meta);
      }
    }
  }
}