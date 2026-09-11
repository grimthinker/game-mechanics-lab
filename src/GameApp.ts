import { World } from './ecs/World';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { MovementSystem } from './ecs/systems/MovementSystem';
import { StealthSystem } from './ecs/systems/StealthSystem';
import { AttackSystem } from './ecs/systems/AttackSystem';
import { DamageSystem } from './ecs/systems/DamageSystem';
import { AISystem } from './ecs/systems/AISystem';
import { RenderSyncSystem } from './ecs/systems/RenderSyncSystem';
import { InteractionSystem } from './ecs/systems/InteractionSystem';
import { ZoneTriggerSystem } from './ecs/systems/ZoneTriggerSystem';
import { ModifierSystem } from './ecs/systems/ModifierSystem';
import { AttachmentSystem } from './ecs/systems/AttachmentSystem';
import { Camera } from './Camera';
import { Renderer } from './Renderer';
import { Point } from './types';
import { EntityAdapter } from './EntityAdapter';
import { EntityFactory } from './ecs/EntityFactory';
import { GameMode, CREATURE_HOVER_SCREEN_RATIO } from './constants';
import { WorldSerializer } from './ecs/WorldSerializer';
import { EntityConfig } from './ecs/types';
import { createDefaultCreatureConfig } from './Creature';
import { createZoneConfig } from './ecs/archetypes/ZoneArchetype';
import { deg2Rad, Radians } from './utils';
import { HistoryManager, HistoryRecord } from './history/HistoryManager';

export { EntityAdapter } from './EntityAdapter';

export class GameApp {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  public world: World;
  public history: HistoryManager = new HistoryManager(50);
  private isHistoryAction: boolean = false;
  private mouseScreenPos: Point | null = null;
  public physics: PhysicsSystem;
  private movementSystem: MovementSystem;
  private stealthSystem: StealthSystem;
  private attackSystem: AttackSystem;
  private damageSystem: DamageSystem;
  public aiSystem: AISystem;
  private renderSyncSystem: RenderSyncSystem;
  public interactionSystem: InteractionSystem;
  private zoneTriggerSystem: ZoneTriggerSystem;
  private modifierSystem: ModifierSystem;
  private attachmentSystem: AttachmentSystem;
  public camera: Camera;
  public entityFactory: EntityFactory;
  private serializer: WorldSerializer;

  public selectedEntityId: string | null = null;
  public selectedEntityIds: Set<string> = new Set();
  public hoveredEntityId: string | null = null;
  private _cachedSelectedEntity: EntityAdapter | null = null;

  // Рамка выделения
  public marqueeBox: { start: Point; current: Point } | null = null;

  // Массовое перемещение (Ghost Dragging)
  public draggedEntities: Map<string, Point> = new Map();
  public draggedAnchorId: string | null = null;
  public draggedAnchorOriginalPos: Point | null = null;
  public draggedAnchorCurrentPos: Point | null = null;
  private dragOffset: Point = { x: 0, y: 0 };

  public get draggedEntityId(): string | null {
    return this.draggedAnchorId;
  }
  public get draggedCurrentPos(): Point | null {
    return this.draggedAnchorCurrentPos;
  }

  public get selectedEntity(): EntityAdapter | null {
    if (!this.selectedEntityId) return null;
    if (!this.world.getEntity(this.selectedEntityId)) {
      this.selectedEntityId = null;
      this._cachedSelectedEntity = null;
      return null;
    }
    if (!this._cachedSelectedEntity || this._cachedSelectedEntity.id !== this.selectedEntityId) {
      this._cachedSelectedEntity = new EntityAdapter(this.selectedEntityId, this.world);
    }
    return this._cachedSelectedEntity;
  }

  public get hoveredEntity(): EntityAdapter | null {
    if (!this.hoveredEntityId) return null;
    if (!this.world.getEntity(this.hoveredEntityId)) {
      this.hoveredEntityId = null;
      return null;
    }
    return new EntityAdapter(this.hoveredEntityId, this.world);
  }

  public onFrame: (() => void) | null = null;

  private lastTime: number = 0;
  private isRunning: boolean = false;
  public isPaused: boolean = false;

  public gameMode: GameMode = GameMode.EDITOR;

  private handleResize = () => this.resizeCanvas();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.world = new World();
    this.physics = new PhysicsSystem();
    this.movementSystem = new MovementSystem();
    this.stealthSystem = new StealthSystem();
    this.attackSystem = new AttackSystem();
    this.damageSystem = new DamageSystem();
    this.aiSystem = new AISystem();
    this.renderSyncSystem = new RenderSyncSystem();
    this.interactionSystem = new InteractionSystem();
    this.zoneTriggerSystem = new ZoneTriggerSystem();
    this.modifierSystem = new ModifierSystem();
    this.attachmentSystem = new AttachmentSystem();
    this.camera = new Camera();
    this.entityFactory = new EntityFactory();
    this.serializer = new WorldSerializer(this);

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

  public spawnEntity(config: EntityConfig, position?: Point, forcedId?: string): string {
    return this.entityFactory.spawnEntity(
      this.world,
      this.physics,
      this.aiSystem,
      config,
      position,
      forcedId
    );
  }

  public startPickup(entityId: string, targetItemId: string): boolean {
    return InteractionSystem.requestPickup(this.world, entityId, targetItemId);
  }

  public cancelInteraction(entityId: string): boolean {
    return this.interactionSystem.cancelInteraction(this.world, this.physics, entityId);
  }

  public deleteSelectedEntity(): void {
    this.deleteSelectedEntities();
  }

  public deleteSelectedEntities(): void {
    const ids = Array.from(
      this.selectedEntityIds.size > 0
        ? this.selectedEntityIds
        : this.selectedEntityId
          ? [this.selectedEntityId]
          : []
    );

    if (ids.length === 0) return;

    this.commitHistory('Удаление объектов');

    for (const id of ids) {
      this.deleteEntityRecursive(id);
      if (this.hoveredEntityId === id) this.hoveredEntityId = null;
    }

    this.selectedEntityIds.clear();
    this.selectEntity(null, true);
  }

  private deleteEntityRecursive(id: string): void {
    if (!this.world.getEntity(id)) return;

    // Каскадное удаление привязанных дочерних сущностей (ауры, зоны и т.д.)
    const attachedEntities = this.world.getEntitiesWith('attachment');
    for (const [childId, { attachment }] of attachedEntities) {
      if (attachment.parentId === id) {
        this.deleteEntityRecursive(childId);
      }
    }

    const eq = this.world.getComponent(id, 'equip');
    if (eq) {
      if (eq.interactionSlots) {
        for (const slot of eq.interactionSlots) {
          if (slot.itemId) this.deleteEntityRecursive(slot.itemId);
        }
      }
      if (eq.equipmentAreas) {
        for (const area of eq.equipmentAreas) {
          for (const itemId of area.itemIds) {
            this.deleteEntityRecursive(itemId);
          }
        }
      }
    }
    const inv = this.world.getComponent(id, 'inventory');
    if (inv) {
      for (const row of inv.slots) {
        for (const cell of row) {
          if (cell.itemId) this.deleteEntityRecursive(cell.itemId);
        }
      }
    }
    const phys = this.world.getComponent(id, 'physicsBody');
    if (phys) this.physics.unregisterBody(phys.body);
    this.aiSystem.unregisterEntity(id);
    this.world.removeEntity(id);
  }

  public clearWorld(): void {
    const entities = this.world.getAllEntities();
    for (const [id, comp] of entities) {
      if (comp.physicsBody) {
        this.physics.unregisterBody(comp.physicsBody.body);
      }
      this.world.removeEntity(id);
    }
    this.aiSystem.clear();
    this.selectEntity(null);
    this.hoverEntity(null);
  }

  public initDefaultWorld(center?: Point): void {
    this.clearWorld();
    this.history.clear();
    const spawnPos: Point = center ?? {
      x: this.canvas.width / 2,
      y: this.canvas.height / 2,
    };

    this.spawnEntity(createDefaultCreatureConfig('PlayerTree'), spawnPos);
    this.spawnEntity(createZoneConfig('damage', 70, 15), { x: spawnPos.x + 180, y: spawnPos.y });
    this.spawnEntity(createZoneConfig('heal', 70, 15), { x: spawnPos.x - 180, y: spawnPos.y });
    this.spawnEntity(
      createZoneConfig('repel', 70, 200, 'Зона отталкивания', false, false, false, true, 7000, 0),
      {
        x: spawnPos.x - 180,
        y: spawnPos.y - 180,
      }
    );
    this.spawnEntity(
      createZoneConfig('attract', 70, 200, 'Зона притягивания', false, false, false, true, 7000, 0),
      {
        x: spawnPos.x + 180,
        y: spawnPos.y - 180,
      }
    );

    // Начальное разрушаемое препятствие по умолчанию
    this.spawnEntity(
      {
        tag: { archetype: 'obstacle' },
        meta: { name: 'Каменная стена', entityType: 'obstacle', destructible: true },
        health: { hp: 100, maxHp: 100 },
        physics: {
          radius: 65,
          weight: 1000,
          isSolid: true,
          points: [
            { x: -60, y: -25 },
            { x: 60, y: -25 },
            { x: 60, y: 25 },
            { x: -60, y: 25 },
          ],
        },
      },
      { x: spawnPos.x, y: spawnPos.y + 160 }
    );

    // Начальный спавн предметов в вертикальный ряд
    const itemsX = spawnPos.x + 80;

    // 1. Оружие с атакой в радиусе (Аура)
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        item: {
          name: 'Аура разрушения',
          type: 'weapon',
          maxStack: 1,
          size: 10,
          equipType: null,
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 1, isSolid: true },
        weaponStats: {
          baseDamage: 30,
          prepTime: 0.3,
          castTime: 0,
          recoveryTime: 0.4,
        },
        weaponZone: {
          hitZoneType: 'radius',
          radius: 50,
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: itemsX, y: spawnPos.y - 100 }
    );

    // 2. Оружие с атакой шрапнелью
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        item: {
          name: 'Шрапнельный дробовик',
          type: 'weapon',
          maxStack: 1,
          size: 10,
          equipType: null,
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 1, isSolid: true },
        weaponStats: {
          baseDamage: 15,
          prepTime: 0.4,
          castTime: 0,
          recoveryTime: 0.5,
        },
        weaponZone: {
          hitZoneType: 'shrapnel',
          length: 120,
          angle: deg2Rad(60),
          rayCount: 5,
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: itemsX, y: spawnPos.y - 50 }
    );

    // 3. Оружие с атакой на линии
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        item: {
          name: 'Копьё пронзания',
          type: 'weapon',
          maxStack: 1,
          size: 10,
          equipType: null,
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 1, isSolid: true },
        weaponStats: {
          baseDamage: 25,
          prepTime: 0.2,
          castTime: 0,
          recoveryTime: 0.3,
        },
        weaponZone: {
          hitZoneType: 'forward_line',
          length: 150,
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: itemsX, y: spawnPos.y }
    );

    // 4. Броня для туловища, вес 20
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'armor' },
        item: {
          name: 'Тяжёлый нагрудник',
          type: 'armor',
          maxStack: 1,
          size: 20,
          equipType: 'torso',
          equippable: true,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 20, isSolid: true },
        armorStats: {
          defense: 25,
          flatReduction: 5,
        },
      },
      { x: itemsX, y: spawnPos.y + 50 }
    );

    // 5. Броня для головы, вес 10
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'armor' },
        item: {
          name: 'Стальной шлем',
          type: 'armor',
          maxStack: 1,
          size: 10,
          equipType: 'head',
          equippable: true,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 10, isSolid: true },
        armorStats: {
          defense: 15,
          flatReduction: 2,
        },
      },
      { x: itemsX, y: spawnPos.y + 100 }
    );
  }

  public serializeWorld(): any {
    return this.serializer.serializeWorld();
  }

  public deserializeWorld(data: any): void {
    this.serializer.deserializeWorld(data);
  }

  public captureHistoryRecord(description: string = 'Действие'): HistoryRecord {
    return {
      description,
      worldSnapshot: this.serializeWorld(),
      selectedEntityIds: Array.from(this.selectedEntityIds),
      selectedEntityId: this.selectedEntityId,
    };
  }

  public commitHistory(description: string = 'Изменение'): void {
    if (this.gameMode !== GameMode.EDITOR || this.isHistoryAction) return;
    this.history.pushState(this.captureHistoryRecord(description));
  }

  public undo(): boolean {
    if (this.gameMode !== GameMode.EDITOR || !this.history.canUndo()) return false;

    this.isHistoryAction = true;
    try {
      const current = this.captureHistoryRecord('Текущее состояние');
      const target = this.history.undo(current);
      if (target) {
        this.restoreHistoryRecord(target);
        return true;
      }
    } finally {
      this.isHistoryAction = false;
    }
    return false;
  }

  public redo(): boolean {
    if (this.gameMode !== GameMode.EDITOR || !this.history.canRedo()) return false;

    this.isHistoryAction = true;
    try {
      const current = this.captureHistoryRecord('Текущее состояние');
      const target = this.history.redo(current);
      if (target) {
        this.restoreHistoryRecord(target);
        return true;
      }
    } finally {
      this.isHistoryAction = false;
    }
    return false;
  }

  private restoreHistoryRecord(record: HistoryRecord): void {
    this.deserializeWorld(record.worldSnapshot);
    this.selectedEntityIds.clear();
    for (const id of record.selectedEntityIds) {
      if (this.world.getEntity(id)) {
        this.selectedEntityIds.add(id);
      }
    }
    const targetId =
      record.selectedEntityId && this.world.getEntity(record.selectedEntityId)
        ? record.selectedEntityId
        : (this.selectedEntityIds.values().next().value ?? null);
    this.selectEntity(targetId, false);
    this.hoverEntity(null);
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

    if (!this.isPaused) {
      if (this.gameMode === GameMode.GAME && this.mouseScreenPos) {
        const worldPoint = this.camera.getCanvasPoint(
          this.mouseScreenPos.x,
          this.mouseScreenPos.y,
          this.canvas
        );
        this.updatePlayerAim(worldPoint);
      }

      this.modifierSystem.update(dt, this.world);
      this.aiSystem.update(dt, this.world);
      this.interactionSystem.update(dt, this.world, this.physics);
      this.attackSystem.update(dt, this.world, this.physics);
      this.movementSystem.update(dt, this.world);
      this.stealthSystem.update(dt, this.world);
      this.physics.update(dt, this.world);
      this.attachmentSystem.update(this.world, this.physics);
      this.zoneTriggerSystem.update(dt, this.world, this.physics);
      this.damageSystem.update(dt, this.world);
    }

    this.renderSyncSystem.update(dt, this.world, this.gameMode);

    // Подготовка данных призраков для всех перемещаемых объектов группы
    let draggedGhosts: Array<{ id: string; origPos: Point; pos: Point }> | null = null;
    if (this.draggedAnchorId && this.draggedAnchorCurrentPos && this.draggedAnchorOriginalPos) {
      const dx = this.draggedAnchorCurrentPos.x - this.draggedAnchorOriginalPos.x;
      const dy = this.draggedAnchorCurrentPos.y - this.draggedAnchorOriginalPos.y;
      draggedGhosts = Array.from(this.draggedEntities.entries()).map(([id, origPos]) => ({
        id,
        origPos,
        pos: { x: origPos.x + dx, y: origPos.y + dy },
      }));
    }

    this.renderer.render(
      this.camera,
      this.world,
      this.physics,
      this.selectedEntityId,
      this.selectedEntityIds,
      this.gameMode,
      this.hoveredEntityId,
      draggedGhosts,
      this.marqueeBox
    );
    if (this.onFrame) this.onFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  public selectEntity(id: string | null, clearGroup: boolean = false): void {
    if (clearGroup) {
      this.selectedEntityIds.clear();
      if (id) this.selectedEntityIds.add(id);
    } else if (id && !this.selectedEntityIds.has(id)) {
      this.selectedEntityIds.add(id);
    }

    if (this.selectedEntityId === id) return;
    this.selectedEntityId = id;
    this._cachedSelectedEntity = id ? new EntityAdapter(id, this.world) : null;
  }

  public selectEntities(ids: string[]): void {
    this.selectedEntityIds = new Set(ids);
    this.selectEntity(ids.length > 0 ? ids[0] : null, false);
  }

  public deselectEntity(id: string): void {
    this.selectedEntityIds.delete(id);
    if (this.selectedEntityId === id) {
      const next = this.selectedEntityIds.values().next().value ?? null;
      this.selectEntity(next, false);
    }
  }

  public startMarquee(startPoint: Point): void {
    this.marqueeBox = { start: startPoint, current: startPoint };
  }

  public updateMarquee(currentPoint: Point): void {
    if (this.marqueeBox) {
      this.marqueeBox.current = currentPoint;
    }
  }

  public endMarquee(typeFilters: Record<string, boolean>): string[] {
    if (!this.marqueeBox) return [];
    const start = this.marqueeBox.start;
    const current = this.marqueeBox.current;
    this.marqueeBox = null;

    const minX = Math.min(start.x, current.x);
    const maxX = Math.max(start.x, current.x);
    const minY = Math.min(start.y, current.y);
    const maxY = Math.max(start.y, current.y);

    // Если клик без растягивания (< 5px) — клик по пустому месту сбрасывает выбор
    if (Math.hypot(maxX - minX, maxY - minY) < 5) {
      this.selectEntity(null, true);
      return [];
    }

    const rawIds = this.physics.queryEntitiesInBox(minX, minY, maxX, maxY);
    const filteredIds: string[] = [];

    for (const id of rawIds) {
      const renderable = this.world.getComponent(id, 'renderable');
      if (renderable && !renderable.isVisible) continue;

      const tag = this.world.getComponent(id, 'tag');
      const meta = this.world.getComponent(id, 'meta');
      const archetype = tag?.archetype ?? meta?.entityType ?? 'creature';

      if (typeFilters && typeFilters[archetype] === false) {
        continue;
      }

      filteredIds.push(id);
    }

    this.selectedEntityIds = new Set(filteredIds);
    this.selectEntity(filteredIds.length > 0 ? filteredIds[0] : null, false);
    return filteredIds;
  }

  public hoverEntity(id: string | null): void {
    if (this.hoveredEntityId === id) return;
    this.hoveredEntityId = id;
  }

  public pickEntityAt(worldPoint: Point): string | null {
    const isEditor = this.gameMode === GameMode.EDITOR;
    const hitIds = this.physics.queryPointAt(worldPoint);
    const hits: { id: string; zIndex: number }[] = [];

    for (const entityId of hitIds) {
      const renderable = this.world.getComponent(entityId, 'renderable');
      if (renderable && !renderable.isVisible) continue;

      const physicsBody = this.world.getComponent(entityId, 'physicsBody');
      const physStats = this.world.getComponent(entityId, 'physicsStats');
      if (!isEditor && !physicsBody && !physStats) continue;

      hits.push({ id: entityId, zIndex: renderable?.zIndex ?? 0 });
    }

    if (hits.length === 0) return null;
    hits.sort((a, b) => b.zIndex - a.zIndex);
    return hits[0].id;
  }

  public setMouseScreenPos(clientX: number | null, clientY: number | null): void {
    if (clientX === null || clientY === null) {
      this.mouseScreenPos = null;
    } else {
      this.mouseScreenPos = { x: clientX, y: clientY };
    }
  }

  public updatePlayerAim(worldPoint: Point): void {
    const entities = this.world.getEntitiesWith('transform', 'input', 'health', 'aiStats');
    for (const [, { transform, input, health, aiStats }] of entities) {
      if (health.isAlive && aiStats.behavior.current === 'PlayerTree') {
        const dx = worldPoint.x - transform.x;
        const dy = worldPoint.y - transform.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          input.targetLookAngle = Math.atan2(dy, dx) as Radians;
        }
      }
    }
  }

  public clearPlayerAim(): void {
    const entities = this.world.getEntitiesWith('input');
    for (const [, { input }] of entities) {
      input.targetLookAngle = undefined;
    }
  }

  public pickNearestEntity(
    worldPoint: Point,
    maxDistanceRatio: number = CREATURE_HOVER_SCREEN_RATIO
  ): string | null {
    const isEditor = this.gameMode === GameMode.EDITOR;
    const maxScreenDistancePx = this.canvas.width * maxDistanceRatio;
    const maxWorldDist = maxScreenDistancePx / this.camera.scale;

    const candidates = this.physics.queryEntitiesInRadius(worldPoint, maxWorldDist);

    let nearestId: string | null = null;
    let minDistance = Infinity;
    let bestZIndex = -Infinity;

    for (const { id: entityId, overlap } of candidates) {
      const renderable = this.world.getComponent(entityId, 'renderable');
      if (renderable && !renderable.isVisible) continue;

      const physicsBody = this.world.getComponent(entityId, 'physicsBody');
      const physStats = this.world.getComponent(entityId, 'physicsStats');
      if (!isEditor && !physicsBody && !physStats) continue;

      const distToBoundary = Math.max(0, maxWorldDist - overlap);
      const zIndex = renderable?.zIndex ?? 0;

      if (distToBoundary < minDistance - 0.001) {
        minDistance = distToBoundary;
        nearestId = entityId;
        bestZIndex = zIndex;
      } else if (Math.abs(distToBoundary - minDistance) <= 0.001 && zIndex > bestZIndex) {
        nearestId = entityId;
        bestZIndex = zIndex;
      }
    }

    return nearestId;
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

  public startDraggingEntity(id: string, clickWorldPoint: Point): boolean {
    if (!this.isPaused) return false;
    const anchorTransform = this.world.getComponent(id, 'transform');
    if (!anchorTransform) return false;

    // Если перетаскиваемый объект входит в группу, перемещаем всю группу
    if (!this.selectedEntityIds.has(id)) {
      this.selectEntity(id, true);
    }

    this.draggedEntities.clear();
    for (const entId of this.selectedEntityIds) {
      const t = this.world.getComponent(entId, 'transform');
      if (t) {
        this.draggedEntities.set(entId, { x: t.x, y: t.y });
      }
    }

    this.draggedAnchorId = id;
    this.draggedAnchorOriginalPos = { x: anchorTransform.x, y: anchorTransform.y };
    this.dragOffset = {
      x: anchorTransform.x - clickWorldPoint.x,
      y: anchorTransform.y - clickWorldPoint.y,
    };
    this.draggedAnchorCurrentPos = { x: anchorTransform.x, y: anchorTransform.y };
    return true;
  }

  public updateDraggedEntityPosition(worldPoint: Point): void {
    if (!this.draggedAnchorId) return;
    this.draggedAnchorCurrentPos = {
      x: worldPoint.x + this.dragOffset.x,
      y: worldPoint.y + this.dragOffset.y,
    };
  }

  public cancelEntityDrag(): void {
    this.draggedEntities.clear();
    this.draggedAnchorId = null;
    this.draggedAnchorOriginalPos = null;
    this.draggedAnchorCurrentPos = null;
  }

  public endEntityDrag(): void {
    if (!this.draggedAnchorId || !this.draggedAnchorCurrentPos || !this.draggedAnchorOriginalPos) {
      this.cancelEntityDrag();
      return;
    }

    const dx = this.draggedAnchorCurrentPos.x - this.draggedAnchorOriginalPos.x;
    const dy = this.draggedAnchorCurrentPos.y - this.draggedAnchorOriginalPos.y;

    if (Math.hypot(dx, dy) < 0.01) {
      this.cancelEntityDrag();
      return;
    }

    this.commitHistory('Перемещение объектов');

    // Фиксируем новые позиции для всех объектов группы (включая препятствия)
    for (const [entId, origPos] of this.draggedEntities.entries()) {
      const newX = origPos.x + dx;
      const newY = origPos.y + dy;

      const transform = this.world.getComponent(entId, 'transform');
      const phys = this.world.getComponent(entId, 'physicsBody');

      if (transform) {
        transform.x = newX;
        transform.y = newY;
      }
      if (phys && phys.body) {
        phys.body.setPosition(newX, newY);
        this.physics.system.updateBody(phys.body);
      }
    }

    this.attachmentSystem.update(this.world, this.physics);
    this.cancelEntityDrag();
  }

  public isDraggingEntity(): boolean {
    return this.draggedAnchorId !== null;
  }
}
