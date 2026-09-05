import { Circle } from 'detect-collisions';
import { World } from './ecs/World';
import {
  WeaponConfig,
  ItemData,
  StandardRadius,
  CreatureConfig,
  InventoryConfig,
} from './ecs/types';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { MovementSystem } from './ecs/systems/MovementSystem';
import { AttackSystem } from './ecs/systems/AttackSystem';
import { DamageSystem } from './ecs/systems/DamageSystem';
import { AISystem } from './ecs/systems/AISystem';
import { Camera } from './Camera';
import { Renderer } from './Renderer';
import { createRandomWeaponItem } from './Weapon';
import { createDefaultArmorItem, createDefaultBagItem } from './DefaultItems';
import { ObstacleSegment, Point } from './types';
import { EntityAdapter } from './EntityAdapter';
import { EntityFactory } from './ecs/EntityFactory';
import { GameMode, CREATURE_HOVER_SCREEN_RATIO } from './constants';
import { WorldSerializer } from './ecs/WorldSerializer';
import { EntityConfig } from './ecs/types';

export { EntityAdapter } from './EntityAdapter';

export class GameApp {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  public world: World;
  public physics: PhysicsSystem;
  private movementSystem: MovementSystem;
  private attackSystem: AttackSystem;
  private damageSystem: DamageSystem;
  public aiSystem: AISystem;
  public camera: Camera;
  public entityFactory: EntityFactory;
  private serializer: WorldSerializer;

  public selectedEntity: EntityAdapter | null = null;
  public hoveredEntity: EntityAdapter | null = null;

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
    this.attackSystem = new AttackSystem();
    this.damageSystem = new DamageSystem();
    this.aiSystem = new AISystem();
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
    return this.entityFactory.spawnEntity(this.world, this.physics, this.aiSystem, config, position, forcedId);
  }

  public spawnCreature(
    config: CreatureConfig,
    position?: Point,
    forcedId?: string
  ): EntityAdapter {
    const entityConfig: EntityConfig = {
      physics: { radius: config.radius, weight: config.weight, isSolid: config.isSolid },
      health: { maxHp: config.maxHp, hp: config.hp },
      movement: { maxSpeed: config.maxSpeed, maxTurnSpeed: config.maxTurnSpeed, runSpeedMultiplier: config.runSpeedMultiplier, crouchSpeedMultiplier: config.crouchSpeedMultiplier, runTurnMultiplier: config.runTurnMultiplier, crouchTurnMultiplier: config.crouchTurnMultiplier },
      stealth: { stealthPower: config.stealthPower, runStealthMultiplier: config.runStealthMultiplier, crouchStealthMultiplier: config.crouchStealthMultiplier },
      ai: { behavior: config.behavior },
      equip: [ { type: 'armor', itemId: null }, { type: 'bag', itemId: null }, { type: 'weapon', itemId: null } ],
      meta: { id: forcedId, entityType: 'creature' }
    };

    const pos = position
      ? { ...position }
      : {
          x: 100 + Math.random() * (this.canvas.width - 200),
          y: 100 + Math.random() * (this.canvas.height - 200),
        };

    const id = this.spawnEntity(entityConfig, pos, forcedId);
    return new EntityAdapter(id, this.world);
  }

  public spawnItemEntity(itemData: ItemData, forcedId?: string): string {
    const config: EntityConfig = { item: itemData };
    if (itemData.type === 'bag' && itemData.config) {
      config.inventory = { ...itemData.config as InventoryConfig };
    }
    // Синхронизируем ID сущности в ECS с внутренним ID предмета
    return this.spawnEntity(config, undefined, forcedId || itemData.id);
  }

  public spawnWorldItem(
    itemData: ItemData,
    position: Point,
    isSolid?: boolean,
    radius?: StandardRadius
  ): string {
    const config: EntityConfig = {
       item: itemData,
       physics: {
         radius: radius ?? itemData.config?.radius ?? 16,
         weight: itemData.config?.weight ?? 1,
         isSolid: isSolid ?? itemData.config?.isSolid ?? true
       }
    };
    if (itemData.type === 'bag' && itemData.config) {
      config.inventory = { ...itemData.config as InventoryConfig };
    }
    // Синхронизируем ID сущности в мире с внутренним ID предмета
    return this.spawnEntity(config, position, itemData.id);
  }

  public despawnEntityFromWorld(id: string): void {
    this.entityFactory.despawnEntityFromWorld(this.world, this.physics, id);
  }

  public deleteSelectedEntity(): void {
    if (!this.selectedEntity) return;
    const id = this.selectedEntity.id;
    this.deleteEntityRecursive(id);
    if (this.hoveredEntity?.id === id) this.hoveredEntity = null;
    this.selectedEntity = null;
  }

  private deleteEntityRecursive(id: string): void {
    const eq = this.world.getComponent(id, 'equip');
    if (eq) {
      for (const slot of eq.slots) {
        if (slot.itemId) this.deleteEntityRecursive(slot.itemId);
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
    this.physics.loadObstacles([]);
    this.selectEntity(null);
    this.hoverEntity(null);
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
      this.aiSystem.update(dt, this.world);
      this.movementSystem.update(dt, this.world);
      this.attackSystem.update(dt, this.world, this.physics);
      this.physics.update(dt, this.world);
      this.damageSystem.update(dt, this.world);
    }

    this.renderer.render(
      this.camera,
      this.world,
      this.physics,
      this.selectedEntity?.id || null,
      this.gameMode,
      this.hoveredEntity?.id || null
    );

    if (this.onFrame) this.onFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  public selectEntity(id: string | null): void {
    if (!id) {
      this.selectedEntity = null;
      return;
    }
    this.selectedEntity = new EntityAdapter(id, this.world);
  }

  public hoverEntity(id: string | null): void {
    if (!id) {
      this.hoveredEntity = null;
      return;
    }
    this.hoveredEntity = new EntityAdapter(id, this.world);
  }

  public pickEntityAt(worldPoint: Point): string | null {
    const isEditor = this.gameMode === GameMode.EDITOR;
    return this.physics.getEntityAt(worldPoint, this.world, isEditor);
  }
  
  public pickNearestEntity(worldPoint: Point, maxDistanceRatio: number = CREATURE_HOVER_SCREEN_RATIO): string | null {
    const isEditor = this.gameMode === GameMode.EDITOR;
    const maxScreenDistancePx = this.canvas.width * maxDistanceRatio;
    const maxWorldDist = maxScreenDistancePx / this.camera.scale;
    return this.physics.getNearestEntity(worldPoint, maxWorldDist, this.world, isEditor);
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
      phys.body.x = newX;
      phys.body.y = newY;
    }
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
      phys.body.x = this.draggedEntityOriginalPos.x;
      phys.body.y = this.draggedEntityOriginalPos.y;
    }
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