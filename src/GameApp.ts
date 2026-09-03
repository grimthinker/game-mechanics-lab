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
import { ItemAdapter } from './ItemAdapter';
import { EntityFactory } from './ecs/EntityFactory';
import { GameMode, CREATURE_HOVER_SCREEN_RATIO } from './constants';
import { WorldSerializer } from './ecs/WorldSerializer';

export { EntityAdapter } from './EntityAdapter';
export { ItemAdapter } from './ItemAdapter';

export class GameApp {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  public world: World;
  public physics: PhysicsSystem;
  private movementSystem: MovementSystem;
  private attackSystem: AttackSystem;
  private damageSystem: DamageSystem;
  private aiSystem: AISystem;
  public camera: Camera;
  public entityFactory: EntityFactory;
  private serializer: WorldSerializer;

  public selectedCreature: EntityAdapter | null = null;
  public selectedItem: ItemAdapter | null = null;
  public hoveredCreature: EntityAdapter | null = null;
  public hoveredItem: ItemAdapter | null = null;

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

  public spawnItemEntity(itemData: ItemData, forcedId?: string): string {
    return this.entityFactory.createEntityFromBlueprint(
      this.world,
      this.aiSystem,
      { kind: 'item', itemData },
      forcedId
    );
  }

  public spawnCreature(
    config: CreatureConfig,
    position?: Point,
    forcedId?: string
  ): EntityAdapter {
    const id = this.entityFactory.createEntityFromBlueprint(
      this.world,
      this.aiSystem,
      { kind: 'creature', config },
      forcedId
    );

    const pos = position
      ? { ...position }
      : {
          x: 100 + Math.random() * (this.canvas.width - 200),
          y: 100 + Math.random() * (this.canvas.height - 200),
        };

    this.entityFactory.spawnEntityInWorld(this.world, this.physics, id, pos);
    return new EntityAdapter(id, this.world);
  }

  public spawnWorldItem(
    itemData: ItemData,
    position: Point,
    isSolid?: boolean,
    radius?: StandardRadius
  ): string {
    const id = this.spawnItemEntity(itemData);
    this.entityFactory.spawnEntityInWorld(this.world, this.physics, id, position, {
      isSolid,
      radius,
    });
    return id;
  }

  public despawnEntityFromWorld(id: string): void {
    this.entityFactory.despawnEntityFromWorld(this.world, this.physics, id);
  }

  public deleteSelectedEntity(): void {
    if (this.selectedCreature) {
      const id = this.selectedCreature.id;
      
      const eq = this.world.getComponent(id, 'equip');
      if (eq) {
         for (const slot of eq.slots) {
            if (slot.itemId) {
               const inv = this.world.getComponent(slot.itemId, 'inventory');
               if (inv) {
                 for (const row of inv.slots) {
                    for (const cell of row) {
                       if (cell.itemId) {
                           const phys = this.world.getComponent(cell.itemId, 'physicsBody');
                           if (phys) this.physics.unregisterBody(phys.body);
                           this.world.removeEntity(cell.itemId);
                       }
                    }
                 }
               }

               const phys = this.world.getComponent(slot.itemId, 'physicsBody');
               if (phys) this.physics.unregisterBody(phys.body);
               this.world.removeEntity(slot.itemId);
            }
         }
      }

      const phys = this.world.getComponent(id, 'physicsBody');
      if (phys) this.physics.unregisterBody(phys.body);
      this.world.removeEntity(id);
      if (this.hoveredCreature?.id === id) this.hoveredCreature = null;
      this.selectedCreature = null;
    } else if (this.selectedItem) {
      const id = this.selectedItem.id;
      
      const inv = this.world.getComponent(id, 'inventory');
      if (inv) {
         for (const row of inv.slots) {
            for (const cell of row) {
               if (cell.itemId) {
                   const phys = this.world.getComponent(cell.itemId, 'physicsBody');
                   if (phys) this.physics.unregisterBody(phys.body);
                   this.world.removeEntity(cell.itemId);
               }
            }
         }
      }

      const phys = this.world.getComponent(id, 'physicsBody');
      if (phys) this.physics.unregisterBody(phys.body);
      this.world.removeEntity(id);
      if (this.hoveredItem?.id === id) this.hoveredItem = null;
      this.selectedItem = null;
    }
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
      this.movementSystem.update(dt, this.world, this.physics);
      this.attackSystem.update(dt, this.world, this.physics);
      this.physics.update(dt, this.world);
      this.damageSystem.update(dt, this.world);
    }

    this.renderer.render(
      this.camera,
      this.world,
      this.physics,
      this.selectedCreature?.id || this.selectedItem?.id || null,
      this.gameMode,
      this.hoveredCreature?.id || this.hoveredItem?.id || null
    );

    if (this.onFrame) this.onFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  public selectEntity(id: string | null): void {
    if (!id) {
      this.selectedCreature = null;
      this.selectedItem = null;
      return;
    }
    const meta = this.world.getComponent(id, 'meta');
    const item = this.world.getComponent(id, 'item');
    if (meta) {
      this.selectedCreature = new EntityAdapter(id, this.world);
      this.selectedItem = null;
    } else if (item) {
      this.selectedCreature = null;
      this.selectedItem = new ItemAdapter(id, this.world);
    }
  }

  public hoverEntity(id: string | null): void {
    if (!id) {
      this.hoveredCreature = null;
      this.hoveredItem = null;
      return;
    }
    const meta = this.world.getComponent(id, 'meta');
    const item = this.world.getComponent(id, 'item');
    if (meta) {
      this.hoveredCreature = new EntityAdapter(id, this.world);
      this.hoveredItem = null;
    } else if (item) {
      this.hoveredCreature = null;
      this.hoveredItem = new ItemAdapter(id, this.world);
    }
  }

  public pickEntityAt(worldPoint: Point): string | null {
    return this.physics.getEntityAt(worldPoint, this.world);
  }

  public pickNearestEntity(
    worldPoint: Point,
    maxDistanceRatio: number = CREATURE_HOVER_SCREEN_RATIO
  ): string | null {
    const maxScreenDistancePx = this.canvas.width * maxDistanceRatio;
    const maxWorldDist = maxScreenDistancePx / this.camera.scale;
    return this.physics.getNearestEntity(worldPoint, maxWorldDist, this.world);
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