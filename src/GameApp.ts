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
import { Radians } from './utils';

export { EntityAdapter } from './EntityAdapter';

export class GameApp {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  public world: World;
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
  public hoveredEntityId: string | null = null;
  private _cachedSelectedEntity: EntityAdapter | null = null;

  public get selectedEntity(): EntityAdapter | null {
    if (!this.selectedEntityId) return null;
    if (!this._cachedSelectedEntity || this._cachedSelectedEntity.id !== this.selectedEntityId) {
      this._cachedSelectedEntity = new EntityAdapter(this.selectedEntityId, this.world);
    }
    return this._cachedSelectedEntity;
  }

  public get hoveredEntity(): EntityAdapter | null {
    return this.hoveredEntityId ? new EntityAdapter(this.hoveredEntityId, this.world) : null;
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
    return this.interactionSystem.startPickup(this.world, entityId, targetItemId);
  }

  public cancelInteraction(entityId: string): boolean {
    return this.interactionSystem.cancelInteraction(this.world, this.physics, entityId);
  }

  public deleteSelectedEntity(): void {
    if (!this.selectedEntityId) return;
    const id = this.selectedEntityId;
    this.deleteEntityRecursive(id);
    if (this.hoveredEntityId === id) this.hoveredEntityId = null;
    this.selectEntity(null);
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
  }

  public serializeWorld(): any {
    return this.serializer.serializeWorld();
  }

  public deserializeWorld(data: any): void {
    this.serializer.deserializeWorld(data);
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

    this.renderer.render(
      this.camera,
      this.world,
      this.physics,
      this.selectedEntityId,
      this.gameMode,
      this.hoveredEntityId
    );
    if (this.onFrame) this.onFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  public selectEntity(id: string | null): void {
    if (this.selectedEntityId === id) return;
    this.selectedEntityId = id;
    this._cachedSelectedEntity = id ? new EntityAdapter(id, this.world) : null;
  }

  public hoverEntity(id: string | null): void {
    if (this.hoveredEntityId === id) return;
    this.hoveredEntityId = id;
  }

  public pickEntityAt(worldPoint: Point): string | null {
    const isEditor = this.gameMode === GameMode.EDITOR;
    const entities = this.world.getEntitiesWith('transform');
    const hits: { id: string; zIndex: number }[] = [];

    for (const [entityId, { transform, physicsBody }] of entities) {
      const physStats = this.world.getComponent(entityId, 'physicsStats');
      const gizmo = this.world.getComponent(entityId, 'gizmo');
      const renderable = this.world.getComponent(entityId, 'renderable');

      if (renderable && !renderable.isVisible) continue;
      if (!isEditor && !physicsBody && !physStats) continue;

      const bodyRadius =
        physicsBody && 'r' in physicsBody.body ? (physicsBody.body as any).r : undefined;
      const radius = physStats?.radius.current ?? bodyRadius ?? gizmo?.radius ?? 14;
      const dist = Math.hypot(transform.x - worldPoint.x, transform.y - worldPoint.y);
      if (dist <= radius) {
        hits.push({ id: entityId, zIndex: renderable?.zIndex ?? 0 });
      }
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

    let nearestId: string | null = null;
    let minDistance = Infinity;
    let bestZIndex = -Infinity;

    const entities = this.world.getEntitiesWith('transform');
    for (const [entityId, { transform, physicsBody }] of entities) {
      const physStats = this.world.getComponent(entityId, 'physicsStats');
      const gizmo = this.world.getComponent(entityId, 'gizmo');
      const renderable = this.world.getComponent(entityId, 'renderable');

      if (renderable && !renderable.isVisible) continue;
      if (!isEditor && !physicsBody && !physStats) continue;

      const bodyRadius =
        physicsBody && 'r' in physicsBody.body ? (physicsBody.body as any).r : undefined;
      const radius = physStats?.radius.current ?? bodyRadius ?? gizmo?.radius ?? 14;
      const distToCenter = Math.hypot(transform.x - worldPoint.x, transform.y - worldPoint.y);
      const distToBoundary = Math.max(0, distToCenter - radius);

      if (distToBoundary <= maxWorldDist) {
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

  private draggedEntityId: string | null = null;
  private draggedEntityOriginalPos: Point | null = null;
  private dragOffset: Point = { x: 0, y: 0 };

  public startDraggingEntity(id: string, clickWorldPoint: Point): boolean {
    if (!this.isPaused) return false;
    const transform = this.world.getComponent(id, 'transform');
    if (!transform) return false;

    this.draggedEntityId = id;
    this.draggedEntityOriginalPos = { x: transform.x, y: transform.y };
    this.dragOffset = {
      x: transform.x - clickWorldPoint.x,
      y: transform.y - clickWorldPoint.y,
    };
    return true;
  }

  public updateDraggedEntityPosition(worldPoint: Point): void {
    if (!this.draggedEntityId) return;
    const id = this.draggedEntityId;

    const transform = this.world.getComponent(id, 'transform');
    const phys = this.world.getComponent(id, 'physicsBody');

    const newX = worldPoint.x + this.dragOffset.x;
    const newY = worldPoint.y + this.dragOffset.y;

    if (transform) {
      transform.x = newX;
      transform.y = newY;
    }
    if (phys && phys.body) {
      phys.body.setPosition(newX, newY);
    }
    this.attachmentSystem.update(this.world, this.physics);
  }

  public cancelEntityDrag(): void {
    if (!this.draggedEntityId || !this.draggedEntityOriginalPos) {
      this.draggedEntityId = null;
      this.draggedEntityOriginalPos = null;
      return;
    }
    const id = this.draggedEntityId;
    const transform = this.world.getComponent(id, 'transform');
    const phys = this.world.getComponent(id, 'physicsBody');
    if (transform) {
      transform.x = this.draggedEntityOriginalPos.x;
      transform.y = this.draggedEntityOriginalPos.y;
    }
    if (phys && phys.body) {
      phys.body.setPosition(this.draggedEntityOriginalPos.x, this.draggedEntityOriginalPos.y);
    }
    this.attachmentSystem.update(this.world, this.physics);
    this.draggedEntityId = null;
    this.draggedEntityOriginalPos = null;
  }

  public endEntityDrag(): void {
    this.draggedEntityId = null;
    this.draggedEntityOriginalPos = null;
  }

  public isDraggingEntity(): boolean {
    return this.draggedEntityId !== null;
  }
}
