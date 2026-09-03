import { Circle } from 'detect-collisions';
import { World } from './ecs/World';
import {
  CreatureType,
  WeaponConfig,
  ItemData,
  StandardRadius,
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
import { GameMode, CREATURE_HOVER_SCREEN_RATIO } from './constants';

export { EntityAdapter } from './EntityAdapter';

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

  public selectedCreature: EntityAdapter | null = null;
  public selectedItem: { id: string, data: ItemData } | null = null;
  public hoveredCreature: EntityAdapter | null = null;
  public hoveredItem: { id: string, data: ItemData } | null = null;

  public onFrame: (() => void) | null = null;

  private lastTime: number = 0;
  private isRunning: boolean = false;
  public isPaused: boolean = false;
  
  public gameMode: GameMode = GameMode.EDITOR;
  public playerId: string | null = null;

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
    radius: StandardRadius = 8,
    mass: number = 10,
    maxSpeed: number = 150,
    maxTurnSpeedDeg: number = 270,
    position?: Point,
    _weapons?: WeaponConfig[],
    runSpeedMultiplier: number = 2.5,
    crouchSpeedMultiplier: number = 0.3,
    crouchStealthMultiplier: number = 2.5,
    forcedId?: string
  ): EntityAdapter {
    const prefix = type === 'player' ? 'player' : 'bot';
    const id = forcedId || `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const pos = position
      ? { ...position }
      : {
          x: 100 + Math.random() * (this.canvas.width - 200),
          y: 100 + Math.random() * (this.canvas.height - 200),
        };

    const body = new Circle({ x: pos.x, y: pos.y }, radius);
    body.isStatic = false;

    const initialWeaponItem: ItemData = createRandomWeaponItem();
    const initialArmorItem: ItemData = createDefaultArmorItem();
    const initialBagItem: ItemData = createDefaultBagItem();

    this.world.createEntity(id);
    this.world.addComponent(id, 'transform', { x: pos.x, y: pos.y, angle: 0 });
    this.world.addComponent(id, 'physicsBody', { body, radius, mass: Math.max(0.1, mass), isStatic: false });
    this.world.addComponent(id, 'velocity', { currentSpeed: 0, currentTurnSpeed: 0 });
    this.world.addComponent(id, 'input', {
      isMovingForward: false,
      turnDirection: 0,
      isRunning: false,
      isCrouching: false,
      wantsAttack: false,
      turnSpeed: 0
    });
    this.world.addComponent(id, 'health', { isAlive: true, hitFlashTimer: 0 });
    this.world.addComponent(id, 'stealth', { isCrouching: false });
    this.world.addComponent(id, 'stats', {
      hp: { base: 100, current: 100 },
      maxHp: { base: 100, current: 100 },
      radius: { base: radius, current: radius },
      maxSpeed: { base: Math.max(0, maxSpeed), current: Math.max(0, maxSpeed) },
      maxTurnSpeed: {
        base: (Math.max(0, maxTurnSpeedDeg) * Math.PI) / 180,
        current: (Math.max(0, maxTurnSpeedDeg) * Math.PI) / 180,
      },
      stealth: { base: 0, current: 0 },
      runSpeedMultiplier: {
        base: Math.max(0.1, runSpeedMultiplier),
        current: Math.max(0.1, runSpeedMultiplier),
      },
      crouchSpeedMultiplier: {
        base: Math.max(0.1, crouchSpeedMultiplier),
        current: Math.max(0.1, crouchSpeedMultiplier),
      },
      crouchStealthMultiplier: {
        base: Math.max(1, crouchStealthMultiplier),
        current: Math.max(1, crouchStealthMultiplier),
      },
      interactionRange: { base: 100, current: 100 },
      runTurnMultiplier: { base: 0.8, current: 0.8 },  
      crouchTurnMultiplier: { base: 1.2, current: 1.2 },   
    });

    const emptySlots = Array.from({ length: 4 }, () =>
      Array.from({ length: 6 }, () => ({ item: null, count: 0 }))
    );
    this.world.addComponent(id, 'inventory', {
      size: { width: 6, height: 4 },
      slots: emptySlots,
    });

    this.world.addComponent(id, 'equip', {
      slots: [
        { type: 'armor', item: initialArmorItem },
        { type: 'bag', item: initialBagItem },
        { type: 'weapon', item: initialWeaponItem },
      ],
    });
    this.world.addComponent(id, 'activeAttacks', { attacks: [] });
    this.world.addComponent(id, 'meta', { id, type, state: 'idle' });

    this.physics.registerBody(id, body);

    if (type === 'ai') {
      this.aiSystem.initBotBrain(this.world, id);
    }

    return new EntityAdapter(id, this.world);
  }

  public spawnWorldItem(itemData: ItemData, position: Point, isSolid?: boolean, radius?: StandardRadius): string {
    const id = itemData.id;
    this.world.createEntity(id);
    this.world.addComponent(id, 'transform', { x: position.x, y: position.y, angle: 0 });
    this.world.addComponent(id, 'item', itemData);
    
    const actualIsSolid = isSolid ?? itemData.config?.isSolid ?? true;
    const actualRadius = radius ?? itemData.config?.radius ?? 16;
    
    if (actualIsSolid) {
      const mass = itemData.config?.invWeight || 1;
      const body = new Circle({ x: position.x, y: position.y }, actualRadius);
      body.isStatic = false;
      this.world.addComponent(id, 'physicsBody', { body, radius: actualRadius, mass, isStatic: false });
      this.physics.registerBody(id, body);
    }
    return id;
  }

  public deleteSelectedEntity(): void {
    if (this.selectedCreature) {
      const id = this.selectedCreature.id;
      const phys = this.world.getComponent(id, 'physicsBody');
      if (phys) this.physics.unregisterBody(phys.body);
      this.world.removeEntity(id);
      if (this.hoveredCreature?.id === id) this.hoveredCreature = null;
      this.selectedCreature = null;
    } else if (this.selectedItem) {
      const id = this.selectedItem.id;
      const phys = this.world.getComponent(id, 'physicsBody');
      if (phys) this.physics.unregisterBody(phys.body);
      this.world.removeEntity(id);
      if (this.hoveredItem?.id === id) this.hoveredItem = null;
      this.selectedItem = null;
    }
  }

  public clearWorld(): void {
    const entities = this.world.getEntitiesWith('transform');
    for (const [id, { physicsBody }] of entities) {
      if (physicsBody) {
        this.physics.unregisterBody(physicsBody.body);
      }
      this.world.removeEntity(id);
    }
    this.physics.loadObstacles([]);
    this.selectEntity(null);
    this.hoverEntity(null);
  }

  public serializeWorld(): any {
    const entitiesData: any[] = [];
    const itemsData: any[] = [];
    
    const entities = this.world.getEntitiesWith('transform');
    for (const [id, comp] of entities) {
      if (comp.meta && comp.stats && comp.inventory && comp.equip && comp.physicsBody) {
        entitiesData.push({
          id,
          type: comp.meta.type,
          transform: { ...comp.transform },
          radius: comp.physicsBody.radius,
          mass: comp.physicsBody.mass,
          stats: {
            hp: comp.stats.hp.current,
            maxHp: comp.stats.maxHp.current,
            maxSpeed: comp.stats.maxSpeed.base,
            maxTurnSpeed: (comp.stats.maxTurnSpeed.base * 180) / Math.PI,
            runSpeedMultiplier: comp.stats.runSpeedMultiplier.base,
            crouchSpeedMultiplier: comp.stats.crouchSpeedMultiplier.base,
            crouchStealthMultiplier: comp.stats.crouchStealthMultiplier.base,
          },
          inventory: {
            size: { ...comp.inventory.size },
            slots: comp.inventory.slots,
          },
          equip: {
            slots: comp.equip.slots,
          },
        });
      } else if (comp.item) {
        itemsData.push({
          id,
          transform: { ...comp.transform },
          isSolid: !!comp.physicsBody,
          radius: comp.physicsBody ? comp.physicsBody.radius : 16,
          itemData: comp.item
        });
      }
    }

    return {
      obstacles: this.physics.getObstacleLines() || [],
      entities: entitiesData,
      items: itemsData,
    };
  }

  public deserializeWorld(data: any): void {
    if (!data) return;
    this.clearWorld();

    if (Array.isArray(data.obstacles)) {
      this.physics.loadObstacles(data.obstacles);
    }

    if (Array.isArray(data.entities)) {
      for (const entData of data.entities) {
        const adapter = this.spawnCreature(
          entData.type,
          entData.radius,
          entData.mass,
          entData.stats.maxSpeed,
          entData.stats.maxTurnSpeed,
          entData.transform,
          undefined,
          entData.stats.runSpeedMultiplier,
          entData.stats.crouchSpeedMultiplier,
          entData.stats.crouchStealthMultiplier,
          entData.id
        );

        adapter.updateParams({
          hp: entData.stats.hp,
          maxHp: entData.stats.maxHp,
        });

        const worldEnt = this.world.getEntity(adapter.id);
        if (worldEnt) {
          if (entData.inventory) {
            worldEnt.inventory = {
              size: { ...entData.inventory.size },
              slots: entData.inventory.slots,
            };
          }
          if (entData.equip) {
            worldEnt.equip = {
              slots: entData.equip.slots,
            };
          }
        }
      }
    }

    if (Array.isArray(data.items)) {
      for (const itemData of data.items) {
         this.spawnWorldItem(itemData.itemData, itemData.transform, itemData.isSolid, itemData.radius);
      }
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
      this.playerId,
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
      this.selectedItem = { id, data: item };
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
      this.hoveredItem = { id, data: item };
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