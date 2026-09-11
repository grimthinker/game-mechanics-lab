import { Circle } from 'detect-collisions';
import { World } from '../ecs/World';
import { Camera } from '../Camera';
import { PhysicsSystem } from '../ecs/systems/PhysicsSystem';
import {
  EntityId,
  HitZoneConfig,
  RenderableComponent,
  RenderPrimitive,
  TransformComponent,
} from '../ecs/types';
import { Point } from '../types';
import { VISUAL_CONFIG } from '../../config/visualConfig';
import { IRenderer, RenderContext } from './IRenderer';

export class CanvasRenderer implements IRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private container: HTMLDivElement;

  constructor(container: HTMLDivElement) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.container.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  public screenToWorld(clientX: number, clientY: number, camera2D: Camera): Point {
    return camera2D.getCanvasPoint(clientX, clientY, this.canvas);
  }

  public resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  public destroy(): void {
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  public render(context: RenderContext): void {
    const { camera, world, gameMode, editorData } = context;
    const { selectedId, selectedIds, hoveredId, draggedGhosts, marqueeBox } = editorData;

    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.translate(camera.offsetX, camera.offsetY);
    this.ctx.scale(camera.scale, camera.scale);

    this.renderGrid(camera);
    this.renderEntities(
      world,
      camera,
      selectedId,
      selectedIds,
      hoveredId,
      gameMode,
      draggedGhosts,
      marqueeBox
    );

    this.ctx.restore();
  }

  private renderGrid(camera: Camera): void {
    const { scale, offsetX, offsetY } = camera;
    const gridSize = VISUAL_CONFIG.grid.size;
    const left = -offsetX / scale;
    const top = -offsetY / scale;
    const right = (this.canvas.width - offsetX) / scale;
    const bottom = (this.canvas.height - offsetY) / scale;

    const startX = Math.floor(left / gridSize) * gridSize;
    const endX = Math.ceil(right / gridSize) * gridSize;
    const startY = Math.floor(top / gridSize) * gridSize;
    const endY = Math.ceil(bottom / gridSize) * gridSize;

    this.ctx.strokeStyle = VISUAL_CONFIG.grid.color;
    this.ctx.lineWidth = VISUAL_CONFIG.grid.lineWidth / scale;
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

  private renderEntities(
    world: World,
    camera: Camera,
    selectedId: EntityId | null,
    selectedIds: Set<EntityId>,
    hoveredId: EntityId | null,
    gameMode: string = 'editor',
    draggedGhosts?: Array<{ id: EntityId; origPos: Point; pos: Point }> | null,
    marqueeBox?: { start: Point; current: Point } | null
  ): void {
    const renderables = world.getEntitiesWith('transform', 'renderable');

    // Сортировка по zIndex (от меньшего к большему)
    renderables.sort((a, b) => a[1].renderable.zIndex - b[1].renderable.zIndex);

    let attacksRendered = false;
    const draggingIds = new Set(draggedGhosts?.map((g) => g.id));

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

      const isBeingDragged = draggingIds.has(id);
      if (isBeingDragged) {
        this.ctx.save();
        this.ctx.globalAlpha = 0.35;
        this.renderEntityPrimitives(
          id,
          transform,
          renderable,
          camera,
          null,
          selectedIds,
          hoveredId,
          world
        );
        this.ctx.restore();
      } else {
        this.renderEntityPrimitives(
          id,
          transform,
          renderable,
          camera,
          selectedId,
          selectedIds,
          hoveredId,
          world
        );
      }
    }

    if (!attacksRendered) {
      this.renderWeaponAttacks(world.getEntitiesWith('transform', 'activeAttacks'), world, camera);
    }

    // Отрисовка эффектов взаимодействия
    this.renderPickupInteractions(world, camera);

    // Отрисовка призраков перетаскиваемой группы (Ghost Drag Preview)
    if (draggedGhosts) {
      for (const ghost of draggedGhosts) {
        this.renderGhostDrag(world, camera, ghost);
      }
    }

    // Отрисовка рамки выделения (Marquee Selection Box)
    if (marqueeBox) {
      this.renderMarqueeBox(camera, marqueeBox);
    }

    // Отрисовка Healthbars и ID-текстов
    this.renderUIOverlays(world.getEntitiesWith('transform', 'health'), world, camera, gameMode);

    // Отрисовка Hover-текстов для предметов
    this.renderItemTooltips(world, camera, hoveredId);
  }

  private renderMarqueeBox(camera: Camera, box: { start: Point; current: Point }): void {
    const minX = Math.min(box.start.x, box.current.x);
    const minY = Math.min(box.start.y, box.current.y);
    const width = Math.abs(box.current.x - box.start.x);
    const height = Math.abs(box.current.y - box.start.y);

    this.ctx.save();
    this.ctx.fillStyle = 'rgba(52, 152, 219, 0.15)';
    this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.85)';
    this.ctx.lineWidth = 1.5 / camera.scale;
    this.ctx.setLineDash([5 / camera.scale, 3 / camera.scale]);
    this.ctx.fillRect(minX, minY, width, height);
    this.ctx.strokeRect(minX, minY, width, height);
    this.ctx.restore();
  }

  private renderGhostDrag(
    world: World,
    camera: Camera,
    draggedGhost: { id: EntityId; origPos: Point; pos: Point }
  ): void {
    const entity = world.getEntity(draggedGhost.id);
    if (!entity || !entity.transform || !entity.renderable) return;

    const origPos = draggedGhost.origPos;
    const ghostPos = draggedGhost.pos;
    const angle = entity.transform.angle;

    // 1. Пунктирная направляющая линия
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.setLineDash([6 / camera.scale, 4 / camera.scale]);
    this.ctx.moveTo(origPos.x, origPos.y);
    this.ctx.lineTo(ghostPos.x, ghostPos.y);
    this.ctx.strokeStyle = 'rgba(52, 152, 219, 0.75)';
    this.ctx.lineWidth = 1.5 / camera.scale;
    this.ctx.stroke();
    this.ctx.restore();

    // 2. Отрисовка призрака дочерних объектов
    const attached = world.getEntitiesWith('attachment', 'renderable');
    for (const [, { attachment, renderable }] of attached) {
      if (attachment.parentId === draggedGhost.id && renderable.isVisible) {
        const childX = ghostPos.x + (attachment.offsetX ?? 0);
        const childY = ghostPos.y + (attachment.offsetY ?? 0);
        this.ctx.save();
        this.ctx.globalAlpha = 0.45;
        this.ctx.translate(childX, childY);
        this.ctx.rotate(angle);
        for (const prim of renderable.primitives) {
          this.drawPrimitive(prim, camera, angle);
        }
        this.ctx.restore();
      }
    }

    // 3. Отрисовка призрака объекта
    this.ctx.save();
    this.ctx.globalAlpha = 0.75;
    this.ctx.translate(ghostPos.x, ghostPos.y);
    this.ctx.rotate(angle);

    for (const prim of entity.renderable.primitives) {
      this.drawPrimitive(prim, camera, angle);
    }

    const strokeColor = VISUAL_CONFIG.selection.selectedColor;
    const lineWidth = (VISUAL_CONFIG.selection.lineWidth + 0.5) / camera.scale;
    this.drawSelectionOutline(entity.renderable.primitives[0], strokeColor, lineWidth);

    this.ctx.restore();
  }

  private renderEntityPrimitives(
    id: EntityId,
    transform: TransformComponent,
    renderable: RenderableComponent,
    camera: Camera,
    selectedId: EntityId | null,
    selectedIds: Set<EntityId>,
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
    const radius =
      physStats?.radius.current ?? (physBody?.body instanceof Circle ? physBody.body.r : 16);

    if (health?.hitFlashTimer && health.hitFlashTimer > 0) {
      const duration = VISUAL_CONFIG.flashes.duration;
      const progress = Math.min(1, Math.max(0, (duration - health.hitFlashTimer) / duration));
      const ringRadius =
        radius + 2 / camera.scale + (progress * VISUAL_CONFIG.flashes.maxOffset) / camera.scale;
      const alpha = Math.max(0.1, 1 - progress * 0.7);

      this.ctx.beginPath();
      this.ctx.setLineDash([]);
      this.ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(${VISUAL_CONFIG.flashes.hitRgb}, ${alpha})`;
      this.ctx.lineWidth =
        Math.max(1, VISUAL_CONFIG.flashes.baseWidth - progress * 1.5) / camera.scale;
      this.ctx.stroke();
    } else if (health?.healFlashTimer && health.healFlashTimer > 0) {
      const duration = VISUAL_CONFIG.flashes.duration;
      const progress = Math.min(1, Math.max(0, (duration - health.healFlashTimer) / duration));
      const ringRadius =
        radius + 2 / camera.scale + (progress * VISUAL_CONFIG.flashes.maxOffset) / camera.scale;
      const alpha = Math.max(0.1, 1 - progress * 0.7);

      this.ctx.beginPath();
      this.ctx.setLineDash([]);
      this.ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = `rgba(${VISUAL_CONFIG.flashes.healRgb}, ${alpha})`;
      this.ctx.lineWidth =
        Math.max(1, VISUAL_CONFIG.flashes.baseWidth - progress * 1.5) / camera.scale;
      this.ctx.stroke();
    }

    // Универсальная подсветка выбора и наведения
    const isActiveSelected = id === selectedId;
    const isGroupSelected = selectedIds.has(id);
    const isHovered = id === hoveredId;

    if (isActiveSelected || isGroupSelected || isHovered) {
      const strokeColor = isActiveSelected
        ? VISUAL_CONFIG.selection.selectedColor // Зеленый для активного
        : isGroupSelected
          ? '#3498db' // Синий для группы
          : VISUAL_CONFIG.selection.hoverColor;
      const lineWidth = VISUAL_CONFIG.selection.lineWidth / camera.scale;
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
      case 'polygon': {
        this.ctx.beginPath();
        if (prim.dash) {
          this.ctx.setLineDash(prim.dash.map((d) => d / camera.scale));
        } else {
          this.ctx.setLineDash([]);
        }
        if (prim.points.length > 0) {
          this.ctx.moveTo(prim.points[0].x, prim.points[0].y);
          for (let i = 1; i < prim.points.length; i++) {
            this.ctx.lineTo(prim.points[i].x, prim.points[i].y);
          }
          this.ctx.closePath();
        }
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
    } else if (firstPrim.kind === 'polygon') {
      if (firstPrim.points.length > 0) {
        this.ctx.beginPath();
        this.ctx.moveTo(firstPrim.points[0].x, firstPrim.points[0].y);
        for (let i = 1; i < firstPrim.points.length; i++) {
          this.ctx.lineTo(firstPrim.points[i].x, firstPrim.points[i].y);
        }
        this.ctx.closePath();
        this.ctx.stroke();
      }
    }
  }

  private isEntityAlive(world: World, id: EntityId): boolean {
    const healthComp = world.getComponent(id, 'health');
    return healthComp ? healthComp.isAlive : true;
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

        let zoneAlpha = VISUAL_CONFIG.weaponAttacks.defaultAlpha;
        let zoneColor = VISUAL_CONFIG.weaponAttacks.defaultColor;

        if (hitFlashTimer > 0) {
          zoneColor = VISUAL_CONFIG.weaponAttacks.hitColor;
          zoneAlpha = VISUAL_CONFIG.weaponAttacks.hitAlpha;
        } else if (activeAtk.phase === 'prep') {
          zoneColor = VISUAL_CONFIG.weaponAttacks.prepColor;
          zoneAlpha = VISUAL_CONFIG.weaponAttacks.prepAlpha;
        } else if (activeAtk.phase === 'recovery') {
          zoneAlpha = 0;
        }

        if (zoneAlpha > 0) {
          this.ctx.fillStyle = zoneColor;
          this.ctx.strokeStyle = zoneColor;
          this.ctx.globalAlpha = zoneAlpha;
          this.ctx.lineWidth = VISUAL_CONFIG.weaponAttacks.lineWidth / camera.scale;

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

  private renderUIOverlays(
    entities: Array<[EntityId, any]>,
    world: World,
    camera: Camera,
    gameMode: string
  ): void {
    // Healthbars & ID texts
    for (const [id, entity] of entities) {
      if (!this.isEntityAlive(world, id)) continue;

      const transform = entity.transform;
      const meta = entity.meta;
      const tag = world.getComponent(id, 'tag');
      const isObstacle = tag?.archetype === 'obstacle';

      if (isObstacle) {
        if (!meta?.destructible) continue;
        if (gameMode === 'game') {
          if (!entity.health?.healthBarTimer || entity.health.healthBarTimer <= 0) {
            continue;
          }
        }
      }

      let overlayAlpha = 1;
      if (isObstacle && gameMode === 'game' && entity.health?.healthBarTimer) {
        overlayAlpha = Math.min(1, Math.max(0, entity.health.healthBarTimer / 0.3));
      }

      const health = world.getComponent(id, 'health');
      const hp = health?.current ?? 0;
      const maxHp = health?.max.current ?? 100;

      const physStats = world.getComponent(id, 'physicsStats');
      const phys = world.getComponent(id, 'physicsBody');
      const radius = physStats?.radius.current ?? (phys?.body instanceof Circle ? phys.body.r : 16);

      // Healthbar
      this.ctx.save();
      this.ctx.globalAlpha = overlayAlpha;
      this.ctx.translate(transform.x, transform.y);
      const barW = Math.max(
        VISUAL_CONFIG.healthbar.minWidth,
        radius * VISUAL_CONFIG.healthbar.radiusMultiplier
      );
      const barH = VISUAL_CONFIG.healthbar.height / camera.scale;
      const hpRatio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
      this.ctx.fillStyle = VISUAL_CONFIG.healthbar.bgColor;
      this.ctx.fillRect(
        -barW / 2,
        -radius - VISUAL_CONFIG.healthbar.offsetY / camera.scale,
        barW,
        barH
      );
      this.ctx.fillStyle = VISUAL_CONFIG.healthbar.fillColor;
      this.ctx.fillRect(
        -barW / 2,
        -radius - VISUAL_CONFIG.healthbar.offsetY / camera.scale,
        barW * hpRatio,
        barH
      );
      this.ctx.restore();

      // ID / Name Text
      this.ctx.save();
      this.ctx.globalAlpha = overlayAlpha;
      this.ctx.translate(transform.x, transform.y);
      this.ctx.fillStyle = VISUAL_CONFIG.nameOverlay.color;
      this.ctx.font = `${Math.max(10, VISUAL_CONFIG.nameOverlay.fontSize / camera.scale)}px ${VISUAL_CONFIG.nameOverlay.font}`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      const displayName = meta?.name ?? id;
      this.ctx.fillText(displayName, 0, -radius - VISUAL_CONFIG.nameOverlay.offsetY / camera.scale);
      this.ctx.restore();
    }
  }

  private renderItemTooltips(world: World, camera: Camera, hoveredId: EntityId | null): void {
    if (!hoveredId) return;

    const hoverComp = world.getEntity(hoveredId);
    if (hoverComp && hoverComp.transform && hoverComp.item) {
      this.ctx.save();
      this.ctx.translate(hoverComp.transform.x, hoverComp.transform.y);
      const radius =
        hoverComp.physicsBody && hoverComp.physicsBody.body instanceof Circle
          ? hoverComp.physicsBody.body.r
          : 16;

      this.ctx.fillStyle = VISUAL_CONFIG.itemTooltip.color;
      this.ctx.font = `${Math.max(10, VISUAL_CONFIG.itemTooltip.fontSize / camera.scale)}px ${VISUAL_CONFIG.itemTooltip.font}`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      this.ctx.shadowColor = VISUAL_CONFIG.itemTooltip.shadowColor;
      this.ctx.shadowBlur = VISUAL_CONFIG.itemTooltip.shadowBlur;
      this.ctx.shadowOffsetX = 1;
      this.ctx.shadowOffsetY = 1;
      this.ctx.fillText(
        hoverComp.item.name,
        0,
        -radius - VISUAL_CONFIG.itemTooltip.offsetY / camera.scale
      );
      this.ctx.restore();
    }
  }

  private renderPickupInteractions(world: World, camera: Camera): void {
    const entities = world.getEntitiesWith('transform', 'interactionAction');

    for (const [id, { transform, interactionAction }] of entities) {
      if (interactionAction.type !== 'pickup' || !interactionAction.phase) continue;

      const health = world.getComponent(id, 'health');
      if (health && !health.isAlive) continue;

      let itemPos = interactionAction.targetItemPos;
      if (!itemPos && interactionAction.targetId) {
        const itemTrans = world.getComponent(interactionAction.targetId, 'transform');
        if (itemTrans) {
          itemPos = { x: itemTrans.x, y: itemTrans.y };
        }
      }
      if (!itemPos) continue;

      const creaturePos = { x: transform.x, y: transform.y };
      const phase = interactionAction.phase;
      const totalDuration =
        interactionAction.totalDuration > 0 ? interactionAction.totalDuration : 1;
      const timer = Math.max(0, interactionAction.timer);

      let color = VISUAL_CONFIG.pickupInteraction.reachColor;
      let ratio = 0; // 0 — у существа, 1 — у предмета

      if (phase === 'reach') {
        color = VISUAL_CONFIG.pickupInteraction.reachColor;
        ratio = Math.min(1, Math.max(0, 1 - timer / totalDuration));
      } else if (phase === 'lift') {
        color = VISUAL_CONFIG.pickupInteraction.liftColor;
        ratio = Math.min(1, Math.max(0, timer / totalDuration));
      } else if (phase === 'abort_reach' || phase === 'abort_lift') {
        color = VISUAL_CONFIG.pickupInteraction.abortColor;
        const startRatio = interactionAction.abortStartProgress ?? 0.5;
        const abortFactor = Math.min(1, Math.max(0, timer / totalDuration));
        ratio = startRatio * abortFactor;
      }

      const dotX = creaturePos.x + (itemPos.x - creaturePos.x) * ratio;
      const dotY = creaturePos.y + (itemPos.y - creaturePos.y) * ratio;

      const lineWidth = VISUAL_CONFIG.pickupInteraction.lineWidth / camera.scale;
      const dotRadius = VISUAL_CONFIG.pickupInteraction.dotRadius / camera.scale;

      // Расчет дальности взаимодействия ячейки (interactDist)
      const equip = world.getComponent(id, 'equip');
      const physStats = world.getComponent(id, 'physicsStats');
      const creatureRadius = physStats?.radius.current ?? 16;
      let interactDist: number | undefined = undefined;

      if (equip && interactionAction.slotIndex !== undefined) {
        interactDist = equip.interactionSlots[interactionAction.slotIndex]?.interactDist;
      }

      // Если индекс не указан, берем свободную ячейку с максимальной дальностью
      if (interactDist === undefined && equip) {
        let maxDist = -1;
        for (const slot of equip.interactionSlots) {
          if (slot.itemId === null && slot.interactDist > maxDist) {
            maxDist = slot.interactDist;
          }
        }
        if (maxDist > 0) interactDist = maxDist;
      }

      const totalReachRadius = creatureRadius + (interactDist ?? 15);

      this.ctx.save();

      // 1. Отрисовка окружности дальности взаимодействия (пунктир из конфига)
      const rangeConfig = VISUAL_CONFIG.pickupInteraction.rangeCircle;
      this.ctx.beginPath();
      this.ctx.setLineDash(rangeConfig.dash.map((d) => d / camera.scale));
      this.ctx.arc(creaturePos.x, creaturePos.y, totalReachRadius, 0, Math.PI * 2);
      this.ctx.strokeStyle = rangeConfig.color;
      this.ctx.lineWidth = rangeConfig.lineWidth / camera.scale;
      this.ctx.stroke();

      // Сброс пунктира перед рисованием луча
      this.ctx.setLineDash([]);

      // 2. Отрисовка линии связи
      this.ctx.beginPath();
      this.ctx.moveTo(creaturePos.x, creaturePos.y);
      this.ctx.lineTo(itemPos.x, itemPos.y);
      this.ctx.strokeStyle = color;
      this.ctx.lineWidth = lineWidth;
      this.ctx.stroke();

      // 3. Отрисовка анимированной точки
      this.ctx.beginPath();
      this.ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
      this.ctx.fillStyle = color;
      this.ctx.fill();

      this.ctx.restore();
    }
  }
}
