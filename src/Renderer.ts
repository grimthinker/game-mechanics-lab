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
    selectedId: EntityId | null,
    gameMode: string = 'editor',
    hoveredId: EntityId | null = null
  ): void {
    this.ctx.save();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.translate(camera.offsetX, camera.offsetY);
    this.ctx.scale(camera.scale, camera.scale);

    this.renderGrid(camera);
    this.renderObstacles(camera, physics);
    this.renderEntities(world, camera, selectedId, gameMode, hoveredId);

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
    gameMode: string,
    hoveredId: EntityId | null
  ): void {
    const entities = world.getEntitiesWith('transform', 'physicsBody');

    // 1. Отрисовка предметов на земле
    for (const [id, { transform, physicsBody, item }] of entities) {
      if (item) {
        this.renderItemBody(id, transform, physicsBody.body.r, item, camera, selectedId, hoveredId);
      }
    }

    // 2. Отрисовка мертвых существ
    for (const [id, comp] of entities) {
      if (!comp.item && comp.healthStats && !this.isEntityAlive(world, id)) {
        const radius = comp.physicsStats?.radius.current ?? comp.physicsBody.body.r;
        const aiStats = world.getComponent(id, 'aiStats');
        this.renderCreatureBody(id, comp.transform, radius, false, comp.meta, aiStats, camera, selectedId, gameMode, hoveredId);
      }
    }

    // 3. Отрисовка атак оружия (под живыми существами)
    this.renderWeaponAttacks(world.getEntitiesWith('transform', 'activeAttacks'), world, camera);

    // 4. Отрисовка живых существ
    for (const [id, comp] of entities) {
      if (!comp.item && (!comp.healthStats || this.isEntityAlive(world, id))) {
        const radius = comp.physicsStats?.radius.current ?? comp.physicsBody.body.r;
        const aiStats = world.getComponent(id, 'aiStats');
        this.renderCreatureBody(id, comp.transform, radius, true, comp.meta, aiStats, camera, selectedId, gameMode, hoveredId);
      }
    }

    // 5. Отрисовка Гизмо (ТОЛЬКО В РЕЖИМЕ РЕДАКТОРА)
    if (gameMode === 'editor') {
      this.renderEditorGizmos(world, camera, selectedId, hoveredId);
    }

    // 6. Отрисовка Healthbars и ID-текстов
    this.renderUIOverlays(world.getEntitiesWith('transform', 'healthStats'), world, camera);

    // 7. Отрисовка Hover-текстов для предметов
    this.renderItemTooltips(world, camera, hoveredId);
  }

  // --- Вспомогательные методы рендеринга ---

  private isEntityAlive(world: World, id: EntityId): boolean {
    const healthComp = world.getComponent(id, 'health');
    const healthStats = world.getComponent(id, 'healthStats');
    const hp = healthStats?.hp.current ?? 0;
    return healthStats ? hp > 0 : (healthComp?.isAlive ?? hp > 0);
  }

  private renderCreatureBody(
    id: EntityId,
    transform: any,
    radius: number,
    isAlive: boolean,
    meta: any,
    aiStats: any,
    camera: Camera,
    selectedId: EntityId | null,
    gameMode: string,
    hoveredId: EntityId | null
  ): void {
    this.ctx.save();
    this.ctx.translate(transform.x, transform.y);

    this.ctx.save();
    this.ctx.rotate(transform.angle);

    const state = meta?.state ?? 'idle';
    let fillColor = '#34495e';
    if (!isAlive) {
      fillColor = '#7f8c8d';
    } else {
      switch (state) {
        case 'idle': fillColor = '#34495e'; break;
        case 'moving': fillColor = '#3498db'; break;
        case 'running': fillColor = '#2ecc71'; break;
        case 'crouching': fillColor = '#9b59b6'; break;
        case 'attacking': fillColor = '#e67e22'; break;
        case 'dead': fillColor = '#7f8c8d'; break;
      }
    }

    this.ctx.beginPath();
    this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
    this.ctx.fillStyle = fillColor;
    this.ctx.fill();

    const behavior = aiStats?.behavior?.current ?? meta?.config?.behavior ?? 'IdleTree';
    let borderColor = behavior === 'PlayerTree' ? '#2980b9' : '#c0392b';
    let lineWidth = 2 / camera.scale;

    this.ctx.strokeStyle = borderColor;
    this.ctx.lineWidth = lineWidth;
    this.ctx.stroke();

    if (id === selectedId) {
      this.ctx.strokeStyle = '#f1c40f';
      this.ctx.lineWidth = 3 / camera.scale;
      this.ctx.stroke();
    } else if (id === hoveredId) {
      this.ctx.strokeStyle = 'rgba(241, 196, 15, 0.4)';
      this.ctx.lineWidth = 3 / camera.scale;
      this.ctx.stroke();
    }

    this.ctx.beginPath();
    const arrowLen = radius;

    this.ctx.moveTo(arrowLen, 0);
    this.ctx.lineTo(0, -arrowLen);
    this.ctx.moveTo(arrowLen, 0);
    this.ctx.lineTo(0, arrowLen);
    this.ctx.lineTo(0, -arrowLen);

    this.ctx.strokeStyle = '#f1c40f';
    this.ctx.lineWidth = 2 / camera.scale;
    this.ctx.stroke();

    this.ctx.restore();
    this.ctx.restore();
  }

  private renderEditorGizmos(
    world: World,
    camera: Camera,
    selectedId: EntityId | null,
    hoveredId: EntityId | null
  ): void {
    const entities = world.getEntitiesWith('transform');
  
    for (const [id, comp] of entities) {
      // Рисуем только то, что НЕ имеет физического тела (или явно помечено как gizmo)
      const isIntangible = !comp.physicsBody && !comp.physicsStats;
      if (!isIntangible && !comp.gizmo) continue;
  
      const { x, y } = comp.transform;
      const isSelected = id === selectedId;
      const isHovered = id === hoveredId;
      const color = comp.gizmo?.color ?? '#9b59b6';
      const icon = comp.gizmo?.icon ?? '📍';
      const radius = (comp.gizmo?.radius ?? 14);
  
      this.ctx.save();
      this.ctx.translate(x, y);
  
      // 1. Пунктирный контур круга
      this.ctx.beginPath();
      this.ctx.setLineDash([4 / camera.scale, 4 / camera.scale]);
      this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
      this.ctx.fillStyle = 'rgba(155, 89, 182, 0.15)';
      this.ctx.fill();
      this.ctx.lineWidth = 1.5 / camera.scale;
      this.ctx.strokeStyle = color;
      this.ctx.stroke();
  
      // 2. Подсветка при наведении или выделении
      if (isSelected) {
        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 2.5 / camera.scale;
        this.ctx.strokeStyle = '#00e676';
        this.ctx.stroke();
      } else if (isHovered) {
        this.ctx.setLineDash([]);
        this.ctx.lineWidth = 2 / camera.scale;
        this.ctx.strokeStyle = 'rgba(0, 230, 118, 0.5)';
        this.ctx.stroke();
      }
  
      // 3. Иконка по центру
      this.ctx.setLineDash([]);
      this.ctx.font = `${Math.max(10, 14 / camera.scale)}px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(icon, 0, 0);
  
      // 4. Подпись имени/типа под объектом
      const label = comp.meta?.name ?? comp.gizmo?.type ?? comp.meta?.id ?? id;
      this.ctx.fillStyle = '#bbb';
      this.ctx.font = `${Math.max(9, 10 / camera.scale)}px sans-serif`;
      this.ctx.textBaseline = 'top';
      this.ctx.fillText(label, 0, radius + 4 / camera.scale);
  
      this.ctx.restore();
    }
  }

  private renderItemBody(
    id: EntityId,
    transform: any,
    radius: number,
    item: any,
    camera: Camera,
    selectedId: EntityId | null,
    hoveredId: EntityId | null
  ): void {
    this.ctx.save();
    this.ctx.translate(transform.x, transform.y);
    this.ctx.rotate(transform.angle);
    
    const size = radius * 1.6;
    
    let color = '#7f8c8d';
    if (item.type === 'weapon') color = '#f1c40f';
    else if (item.type === 'armor') color = '#3498db';
    else if (item.type === 'bag') color = '#2ecc71';
    
    this.ctx.fillStyle = color;
    this.ctx.fillRect(-size/2, -size/2, size, size);
    
    const isSelected = selectedId === id;
    const isHovered = hoveredId === id;
    
    if (isSelected) {
       this.ctx.strokeStyle = '#e74c3c';
       this.ctx.lineWidth = 3 / camera.scale;
       this.ctx.strokeRect(-size/2, -size/2, size, size);
    } else if (isHovered) {
       this.ctx.strokeStyle = 'rgba(231, 76, 60, 0.4)';
       this.ctx.lineWidth = 3 / camera.scale;
       this.ctx.strokeRect(-size/2, -size/2, size, size);
    }
    
    this.ctx.restore();
  }

  private renderWeaponAttacks(
    entities: Array<[EntityId, any]>,
    world: World,
    camera: Camera
  ): void {
    for (const [id, { transform }] of entities) {
      if (!this.isEntityAlive(world, id)) continue;

      const healthComp = world.getComponent(id, 'health');
      const equipComp = world.getComponent(id, 'equip' as any) as any;
      const hitFlashTimer = healthComp?.hitFlashTimer ?? 0;

      const slots = Array.isArray(equipComp)
        ? equipComp
        : equipComp?.slots || equipComp?.items || [];

      const weaponSlot = slots.find(
        (s: any) =>
          (s.type === 'weapon' || s.slotType === 'weapon') &&
          s.itemId !== null &&
          s.itemId !== undefined
      );

      let weaponToDraw: any = null;
      if (weaponSlot && weaponSlot.itemId) {
         const wItem = world.getComponent(weaponSlot.itemId, 'item');
         if (wItem) {
             weaponToDraw = wItem.config || wItem;
         }
      }

      if (!weaponToDraw || !weaponToDraw.zone) {
        continue;
      }

      const activeAttacksComp =
        world.getComponent(id, 'activeAttacks' as any) ||
        world.getComponent(id, 'activeAttack' as any) ||
        equipComp?.activeAttacks;

      const activeAtkList = Array.isArray(activeAttacksComp)
        ? activeAttacksComp
        : (activeAttacksComp as any)?.attacks || [];
      const activeAtk = activeAtkList[0];

      this.ctx.save();
      this.ctx.translate(transform.x, transform.y);
      this.ctx.rotate(transform.angle);

      let zoneAlpha = 0.15;
      let zoneColor = '#f1c40f';

      if (hitFlashTimer > 0 && activeAtk) {
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
        const zone = weaponToDraw.zone;

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
            const len = zone.length ?? zone.range ?? 100;
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
            const len = zone.length ?? zone.range ?? 150;
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.lineTo(len, 0);
            this.ctx.stroke();
            break;
          }
          case 'shrapnel': {
            const len = zone.length ?? zone.range ?? 120;
            const maxAngle = (zone.angle ?? Math.PI / 3) / 2;
            const count = zone.rayCount ?? zone.numLines ?? zone.lines ?? 5;
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

  private renderUIOverlays(
    entities: Array<[EntityId, any]>,
    world: World,
    camera: Camera
  ): void {
    // Healthbars & ID texts
    for (const [id, entity] of entities) {
      if (!this.isEntityAlive(world, id)) continue;

      const transform = entity.transform;
      const meta = entity.meta;
      const healthStats = world.getComponent(id, 'healthStats');
      const hp = healthStats?.hp.current ?? 0;
      const maxHp = healthStats?.maxHp.current ?? 100;
      
      const physStats = world.getComponent(id, 'physicsStats');
      const phys = world.getComponent(id, 'physicsBody');
      const radius = physStats?.radius.current ?? phys?.body.r ?? meta?.config?.radius ?? 16;

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
      const displayName = meta?.id ?? id;
      this.ctx.fillText(displayName, 0, -radius - 20 / camera.scale);
      this.ctx.restore();
    }
  }

  private renderItemTooltips(
    world: World,
    camera: Camera,
    hoveredId: EntityId | null
  ): void {
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
      this.ctx.shadowColor = "black";
      this.ctx.shadowBlur = 4;
      this.ctx.shadowOffsetX = 1;
      this.ctx.shadowOffsetY = 1;
      this.ctx.fillText(hoverComp.item.name, 0, -radius - 15 / camera.scale);
      this.ctx.restore();
    }
  }
}