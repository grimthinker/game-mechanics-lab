import { World } from './ecs/World';
import { Camera } from './Camera';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import {
  EntityId,
  HitZoneConfig,
  RenderableComponent,
  RenderPrimitive,
  TransformComponent,
} from './ecs/types';

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
    selectedId: EntityId | null,
    _gameMode: string = 'editor',
    hoveredId: EntityId | null = null
  ): void {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.translate(camera.offsetX, camera.offsetY);
    this.ctx.scale(camera.scale, camera.scale);

    this.renderGrid(camera);
    this.renderObstacles(camera, physics);
    this.renderEntities(world, camera, selectedId, hoveredId);

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

  private renderEntities(
    world: World,
    camera: Camera,
    selectedId: EntityId | null,
    hoveredId: EntityId | null
  ): void {
    const renderables = world.getEntitiesWith('transform', 'renderable');

    // Сортировка по zIndex (от меньшего к большему)
    renderables.sort((a, b) => a[1].renderable.zIndex - b[1].renderable.zIndex);

    let attacksRendered = false;

    for (const [id, { transform, renderable }] of renderables) {
      if (!renderable.isVisible) continue;

      // Отрисовка зон удара оружия перед живыми существами (zIndex >= 40)
      if (!attacksRendered && renderable.zIndex >= 40) {
        this.renderWeaponAttacks(
          world.getEntitiesWith('transform', 'activeAttacks'),
          world,
          camera
        );
        attacksRendered = true;
      }

      this.renderEntityPrimitives(id, transform, renderable, camera, selectedId, hoveredId, world);
    }

    if (!attacksRendered) {
      this.renderWeaponAttacks(world.getEntitiesWith('transform', 'activeAttacks'), world, camera);
    }

    // Отрисовка Healthbars и ID-текстов
    this.renderUIOverlays(world.getEntitiesWith('transform', 'health'), world, camera);

    // Отрисовка Hover-текстов для предметов
    this.renderItemTooltips(world, camera, hoveredId);
  }

  private renderEntityPrimitives(
    id: EntityId,
    transform: TransformComponent,
    renderable: RenderableComponent,
    camera: Camera,
    selectedId: EntityId | null,
    hoveredId: EntityId | null,
    world: World
  ): void {
    this.ctx.save();
    this.ctx.translate(transform.x, transform.y);
    this.ctx.rotate(transform.angle);

    for (const prim of renderable.primitives) {
      this.drawPrimitive(prim, camera, transform.angle);
    }

    // Визуальный отклик урона и исцеления
    const health = world.getComponent(id, 'health');
    const physStats = world.getComponent(id, 'physicsStats');
    const physBody = world.getComponent(id, 'physicsBody');
    const radius = physStats?.radius.current ?? physBody?.body.r ?? 16;

    if (health?.hitFlashTimer && health.hitFlashTimer > 0) {
      const progress = Math.min(1, Math.max(0, (6 - health.hitFlashTimer) / 6));
      const ringRadius = radius + 2 / camera.scale + (progress * 6) / camera.scale;
      const alpha = Math.max(0.1, 1 - progress * 0.7);

      this.ctx.beginPath();
      this.ctx.setLineDash([]);
      this.ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(231, 76, 60, ${alpha})`;
      this.ctx.lineWidth = Math.max(1, 2.5 - progress * 1.5) / camera.scale;
      this.ctx.stroke();
    } else if (health?.healFlashTimer && health.healFlashTimer > 0) {
      const progress = Math.min(1, Math.max(0, (6 - health.healFlashTimer) / 6));
      const ringRadius = radius + 2 / camera.scale + (progress * 6) / camera.scale;
      const alpha = Math.max(0.1, 1 - progress * 0.7);

      this.ctx.beginPath();
      this.ctx.setLineDash([]);
      this.ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(46, 204, 113, ${alpha})`;
      this.ctx.lineWidth = Math.max(1, 2.5 - progress * 1.5) / camera.scale;
      this.ctx.stroke();
    }

    // Универсальная подсветка выбора и наведения
    const isSelected = id === selectedId;
    const isHovered = id === hoveredId;
    if (isSelected || isHovered) {
      const strokeColor = isSelected ? '#f1c40f' : 'rgba(241, 196, 15, 0.4)';
      const lineWidth = 3 / camera.scale;
      this.drawSelectionOutline(renderable.primitives[0], strokeColor, lineWidth);
    }

    this.ctx.restore();
  }

  private drawPrimitive(prim: RenderPrimitive, camera: Camera, angle: number): void {
    switch (prim.kind) {
      case 'circle': {
        this.ctx.beginPath();
        if (prim.dash) {
          this.ctx.setLineDash(prim.dash.map((d) => d / camera.scale));
        } else {
          this.ctx.setLineDash([]);
        }
        this.ctx.arc(0, 0, prim.radius, 0, Math.PI * 2);
        if (prim.fill) {
          this.ctx.fillStyle = prim.fill;
          this.ctx.fill();
        }
        if (prim.stroke) {
          this.ctx.strokeStyle = prim.stroke;
          this.ctx.lineWidth = (prim.strokeWidth ?? 1) / camera.scale;
          this.ctx.stroke();
        }
        this.ctx.setLineDash([]);
        break;
      }
      case 'rect': {
        this.ctx.beginPath();
        if (prim.dash) {
          this.ctx.setLineDash(prim.dash.map((d) => d / camera.scale));
        } else {
          this.ctx.setLineDash([]);
        }
        if (prim.fill) {
          this.ctx.fillStyle = prim.fill;
          this.ctx.fillRect(-prim.width / 2, -prim.height / 2, prim.width, prim.height);
        }
        if (prim.stroke) {
          this.ctx.strokeStyle = prim.stroke;
          this.ctx.lineWidth = (prim.strokeWidth ?? 1) / camera.scale;
          this.ctx.strokeRect(-prim.width / 2, -prim.height / 2, prim.width, prim.height);
        }
        this.ctx.setLineDash([]);
        break;
      }
      case 'line': {
        this.ctx.beginPath();
        if (prim.dash) {
          this.ctx.setLineDash(prim.dash.map((d) => d / camera.scale));
        } else {
          this.ctx.setLineDash([]);
        }
        this.ctx.moveTo(prim.from.x, prim.from.y);
        this.ctx.lineTo(prim.to.x, prim.to.y);
        this.ctx.strokeStyle = prim.stroke;
        this.ctx.lineWidth = (prim.strokeWidth ?? 1) / camera.scale;
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        break;
      }
      case 'arc': {
        this.ctx.beginPath();
        this.ctx.arc(0, 0, prim.radius, prim.startAngle, prim.endAngle);
        if (prim.closed) this.ctx.closePath();
        if (prim.fill) {
          this.ctx.fillStyle = prim.fill;
          this.ctx.fill();
        }
        if (prim.stroke) {
          this.ctx.strokeStyle = prim.stroke;
          this.ctx.lineWidth = (prim.strokeWidth ?? 1) / camera.scale;
          this.ctx.stroke();
        }
        break;
      }
      case 'text': {
        this.ctx.save();
        if (prim.ignoreRotation && angle !== 0) {
          this.ctx.rotate(-angle);
        }
        const offsetX = prim.offset?.x ?? 0;
        const offsetY = prim.offset?.y ?? 0;
        this.ctx.setLineDash([]);
        this.ctx.font = prim.font ?? `${Math.max(10, 14 / camera.scale)}px sans-serif`;
        this.ctx.textAlign = prim.align ?? 'center';
        this.ctx.textBaseline = prim.baseline ?? 'middle';
        this.ctx.fillStyle = prim.fill;
        this.ctx.fillText(prim.text, offsetX, offsetY);
        this.ctx.restore();
        break;
      }
    }
  }

  private drawSelectionOutline(
    firstPrim: RenderPrimitive | undefined,
    strokeColor: string,
    lineWidth: number
  ): void {
    if (!firstPrim) return;

    this.ctx.setLineDash([]);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = lineWidth;

    if (firstPrim.kind === 'circle') {
      this.ctx.beginPath();
      this.ctx.arc(0, 0, firstPrim.radius, 0, Math.PI * 2);
      this.ctx.stroke();
    } else if (firstPrim.kind === 'rect') {
      this.ctx.strokeRect(
        -firstPrim.width / 2,
        -firstPrim.height / 2,
        firstPrim.width,
        firstPrim.height
      );
    }
  }

  // --- Вспомогательные методы рендеринга боевых зон и оверлеев ---

  private isEntityAlive(world: World, id: EntityId): boolean {
    const healthComp = world.getComponent(id, 'health');
    return healthComp ? healthComp.isAlive && healthComp.current > 0 : true;
  }

  private renderWeaponAttacks(
    entities: Array<[EntityId, any]>,
    world: World,
    camera: Camera
  ): void {
    for (const [id, { transform, activeAttacks }] of entities) {
      if (!this.isEntityAlive(world, id)) continue;

      const healthComp = world.getComponent(id, 'health');
      const hitFlashTimer = healthComp?.hitFlashTimer ?? 0;
      const attacks = activeAttacks?.attacks || [];

      for (const activeAtk of attacks) {
        const zone = world.getComponent(activeAtk.weaponId, 'weaponZone');

        if (!zone) {
          continue;
        }

        this.ctx.save();
        this.ctx.translate(transform.x, transform.y);
        this.ctx.rotate(transform.angle);

        let zoneAlpha = 0.15;
        let zoneColor = '#f1c40f';

        if (hitFlashTimer > 0) {
          zoneColor = '#e74c3c';
          zoneAlpha = 0.9;
        } else if (activeAtk.phase === 'prep') {
          zoneColor = '#f39c12';
          zoneAlpha = 0.5;
        } else if (activeAtk.phase === 'recovery') {
          zoneAlpha = 0;
        }

        if (zoneAlpha > 0) {
          this.ctx.fillStyle = zoneColor;
          this.ctx.strokeStyle = zoneColor;
          this.ctx.globalAlpha = zoneAlpha;
          this.ctx.lineWidth = 2 / camera.scale;

          switch (zone.hitZoneType) {
            case 'radius': {
              const r = zone.radius ?? 50;
              this.ctx.beginPath();
              this.ctx.arc(0, 0, r, 0, Math.PI * 2);
              this.ctx.fill();
              this.ctx.stroke();
              break;
            }
            case 'angle': {
              const len = zone.length ?? 100;
              const maxAngle = (zone.angle ?? Math.PI / 6) / 2;
              this.ctx.beginPath();
              this.ctx.moveTo(0, 0);
              this.ctx.arc(0, 0, len, -maxAngle, maxAngle);
              this.ctx.closePath();
              this.ctx.fill();
              this.ctx.stroke();
              break;
            }
            case 'forward_line': {
              const len = zone.length ?? 150;
              this.ctx.beginPath();
              this.ctx.moveTo(0, 0);
              this.ctx.lineTo(len, 0);
              this.ctx.stroke();
              break;
            }
            case 'shrapnel': {
              const len = zone.length ?? 120;
              const maxAngle = (zone.angle ?? Math.PI / 3) / 2;
              const count = zone.rayCount ?? 5;
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
          }
        }
        this.ctx.restore();
      }
    }
  }

  private renderUIOverlays(entities: Array<[EntityId, any]>, world: World, camera: Camera): void {
    // Healthbars & ID texts
    for (const [id, entity] of entities) {
      if (!this.isEntityAlive(world, id)) continue;

      const transform = entity.transform;
      const meta = entity.meta;
      const health = world.getComponent(id, 'health');
      const hp = health?.current ?? 0;
      const maxHp = health?.max.current ?? 100;

      const physStats = world.getComponent(id, 'physicsStats');
      const phys = world.getComponent(id, 'physicsBody');
      const radius = physStats?.radius.current ?? phys?.body.r ?? 16;

      // Healthbar
      this.ctx.save();
      this.ctx.translate(transform.x, transform.y);
      const barW = radius * 2;
      const barH = 4 / camera.scale;
      const hpRatio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
      this.ctx.fillStyle = '#c0392b';
      this.ctx.fillRect(-barW / 2, -radius - 16 / camera.scale, barW, barH);
      this.ctx.fillStyle = '#2ecc71';
      this.ctx.fillRect(-barW / 2, -radius - 16 / camera.scale, barW * hpRatio, barH);
      this.ctx.restore();

      // ID Text
      this.ctx.save();
      this.ctx.translate(transform.x, transform.y);
      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `${Math.max(10, 11 / camera.scale)}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      const displayName = meta?.name ?? id;
      this.ctx.fillText(displayName, 0, -radius - 20 / camera.scale);
      this.ctx.restore();
    }
  }

  private renderItemTooltips(world: World, camera: Camera, hoveredId: EntityId | null): void {
    if (!hoveredId) return;

    const hoverComp = world.getEntity(hoveredId);
    if (hoverComp && hoverComp.transform && hoverComp.item && !hoverComp.meta) {
      this.ctx.save();
      this.ctx.translate(hoverComp.transform.x, hoverComp.transform.y);
      const radius = hoverComp.physicsBody ? hoverComp.physicsBody.body.r : 16;

      this.ctx.fillStyle = '#ffffff';
      this.ctx.font = `${Math.max(10, 12 / camera.scale)}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      this.ctx.shadowColor = 'black';
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetX = 1;
      this.ctx.shadowOffsetY = 1;
      this.ctx.fillText(hoverComp.item.name, 0, -radius - 15 / camera.scale);
      this.ctx.restore();
    }
  }
}
