import { Circle } from 'detect-collisions';
import { World } from './ecs/World';
import {
  CreatureState,
  CreatureType,
  EntityId,
  IMovable,
  WeaponConfig,
  EquipComponent,
  InventoryComponent,
  ItemData,
} from './ecs/types';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { MovementSystem } from './ecs/systems/MovementSystem';
import { AttackSystem } from './ecs/systems/AttackSystem';
import { DamageSystem } from './ecs/systems/DamageSystem';
import { Camera } from './Camera';
import { Renderer } from './Renderer';
import { createRandomWeaponItem } from './Weapon';
import { ObstacleSegment, Point } from './types';

export class EntityAdapter implements IMovable {
  constructor(
    public readonly id: EntityId,
    private world: World,
    private physics: PhysicsSystem
  ) {}

  public get type(): CreatureType {
    return this.world.getComponent(this.id, 'meta')!.type;
  }
  public get state(): CreatureState {
    return this.world.getComponent(this.id, 'meta')!.state;
  }
  public get radius(): number {
    return this.world.getComponent(this.id, 'physicsBody')!.radius;
  }
  public get mass(): number {
    return this.world.getComponent(this.id, 'physicsBody')!.mass;
  }
  public get hp(): number {
    return this.world.getComponent(this.id, 'stats')!.hp.current;
  }
  public get maxHp(): number {
    return this.world.getComponent(this.id, 'stats')!.maxHp.current;
  }
  public get isAlive(): boolean {
    return this.world.getComponent(this.id, 'health')!.isAlive;
  }
  public get maxSpeed(): number {
    return this.world.getComponent(this.id, 'stats')!.maxSpeed.current;
  }
  public get maxTurnSpeed(): number {
    return this.world.getComponent(this.id, 'stats')!.maxTurnSpeed.current;
  }
  public get currentSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')!.currentSpeed;
  }
  public get currentTurnSpeed(): number {
    return this.world.getComponent(this.id, 'velocity')!.currentTurnSpeed;
  }
  public get runSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')!.runSpeedMultiplier.current;
  }
  public get crouchSpeedMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')!.crouchSpeedMultiplier.current;
  }
  public get crouchStealthMultiplier(): number {
    return this.world.getComponent(this.id, 'stats')!.crouchStealthMultiplier.current;
  }
  public get equip(): EquipComponent | undefined {
    return this.world.getComponent(this.id, 'equip');
  }
  public get inventory(): InventoryComponent | undefined {
    return this.world.getComponent(this.id, 'inventory');
  }

  public startMovingForward(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) input.isMovingForward = true;
  }
  public stopMovingForward(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isMovingForward = false;
  }
  public startTurning(direction: -1 | 1): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) input.turningDirection = direction;
  }
  public stopTurning(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.turningDirection = 0;
  }
  public startRunning(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) {
      input.isRunning = true;
      input.isCrouching = false;
    }
  }
  public stopRunning(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isRunning = false;
  }
  public startCrouching(): void {
    const input = this.world.getComponent(this.id, 'input');
    const health = this.world.getComponent(this.id, 'health');
    if (input && health?.isAlive && this.hp > 0) {
      input.isCrouching = true;
      input.isRunning = false;
    }
  }
  public stopCrouching(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.isCrouching = false;
  }
  public attack(): void {
    const input = this.world.getComponent(this.id, 'input');
    if (input) input.wantsAttack = true;
  }

  public updateInventorySize(width: number, height: number): boolean {
    const inv = this.world.getComponent(this.id, 'inventory');
    if (!inv) return false;
    const isEmpty = inv.slots.every((row) => row.every((cell) => !cell.item));
    if (!isEmpty) return false;

    inv.size = { width, height };
    inv.slots = Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ item: null, count: 0 }))
    );
    return true;
  }

  public updateParams(params: {
    radius?: number;
    maxSpeed?: number;
    maxTurnSpeed?: number;
    hp?: number;
    maxHp?: number;
    runSpeedMultiplier?: number;
    crouchSpeedMultiplier?: number;
    crouchStealthMultiplier?: number;
  }): void {
    const phys = this.world.getComponent(this.id, 'physicsBody');
    const stats = this.world.getComponent(this.id, 'stats');
    const health = this.world.getComponent(this.id, 'health');

    if (params.radius !== undefined && phys) {
      phys.radius = params.radius;
      phys.body.r = params.radius;
    }
    if (stats) {
      if (params.maxSpeed !== undefined) {
        const val = Math.max(0, params.maxSpeed);
        stats.maxSpeed.base = val;
        stats.maxSpeed.current = val;
      }
      if (params.maxTurnSpeed !== undefined) {
        const val = Math.max(0, params.maxTurnSpeed);
        stats.maxTurnSpeed.base = val;
        stats.maxTurnSpeed.current = val;
      }
      if (params.maxHp !== undefined) {
        const val = Math.max(1, params.maxHp);
        stats.maxHp.base = val;
        stats.maxHp.current = val;
      }
      if (params.hp !== undefined) {
        const val = Math.min(stats.maxHp.current, Math.max(0, params.hp));
        stats.hp.base = val;
        stats.hp.current = val;
        if (health) health.isAlive = val > 0;
      }
      if (params.runSpeedMultiplier !== undefined) {
        const val = Math.max(0.1, params.runSpeedMultiplier);
        stats.runSpeedMultiplier.base = val;
        stats.runSpeedMultiplier.current = val;
      }
      if (params.crouchSpeedMultiplier !== undefined) {
        const val = Math.max(0.1, params.crouchSpeedMultiplier);
        stats.crouchSpeedMultiplier.base = val;
        stats.crouchSpeedMultiplier.current = val;
      }
      if (params.crouchStealthMultiplier !== undefined) {
        const val = Math.max(1, params.crouchStealthMultiplier);
        stats.crouchStealthMultiplier.base = val;
        stats.crouchStealthMultiplier.current = val;
      }
    }
  }

  public canInteractWith(targetId: EntityId): boolean {
    const transform = this.world.getComponent(this.id, 'transform');
    const targetTransform = this.world.getComponent(targetId, 'transform');
    const stats = this.world.getComponent(this.id, 'stats');
    if (!transform || !targetTransform || !stats) return false;

    const dist = Math.hypot(transform.x - targetTransform.x, transform.y - targetTransform.y);
    return dist <= stats.interactionRange.current;
  }
}

export class GameApp {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  public world: World;
  public physics: PhysicsSystem;
  private movementSystem: MovementSystem;
  private attackSystem: AttackSystem;
  private damageSystem: DamageSystem;
  public camera: Camera;

  public selectedCreature: EntityAdapter | null = null;
  public onFrame: (() => void) | null = null;

  private lastTime: number = 0;
  private isRunning: boolean = false;
  public isPaused: boolean = false;
  private handleResize = () => this.resizeCanvas();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.world = new World();
    this.physics = new PhysicsSystem();
    this.movementSystem = new MovementSystem();
    this.attackSystem = new AttackSystem();
    this.damageSystem = new DamageSystem();
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
    radius: number = 24,
    mass: number = 10,
    maxSpeed: number = 150,
    maxTurnSpeedDeg: number = 270,
    position?: Point,
    _weapons?: WeaponConfig[],
    runSpeedMultiplier: number = 2.5,
    crouchSpeedMultiplier: number = 0.3,
    crouchStealthMultiplier: number = 2.5
  ): EntityAdapter {
    const prefix = type === 'player' ? 'player' : 'bot';
    const id = `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const pos = position
      ? { ...position }
      : {
          x: 100 + Math.random() * (this.canvas.width - 200),
          y: 100 + Math.random() * (this.canvas.height - 200),
        };

    const body = new Circle({ x: pos.x, y: pos.y }, radius);
    body.isStatic = false;

    const initialWeaponItem: ItemData = createRandomWeaponItem();

    const initialArmorItem: ItemData = {
      id: `armor_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: 'Стандартный бронежилет',
      type: 'armor',
      maxStack: 1,
      config: {
        id: `armor_cfg_${Math.random().toString(36).substring(2, 5)}`,
        name: 'Стандартный бронежилет',
        invWeight: 3,
        radius: 12,
        defense: 15,
        flat_reduction: 3,
      },
    };

    const initialBagItem: ItemData = {
      id: `bag_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      name: 'Походный рюкзак',
      type: 'bag',
      maxStack: 1,
      config: {
        id: `bag_cfg_${Math.random().toString(36).substring(2, 5)}`,
        name: 'Походный рюкзак',
        invWeight: 1,
        radius: 15,
        size: { width: 6, height: 4 },
      },
    };

    this.world.createEntity(id);
    this.world.addComponent(id, 'transform', { x: pos.x, y: pos.y, angle: 0 });
    this.world.addComponent(id, 'physicsBody', { body, radius, mass: Math.max(0.1, mass), isStatic: false });
    this.world.addComponent(id, 'velocity', { currentSpeed: 0, currentTurnSpeed: 0 });
    this.world.addComponent(id, 'input', {
      isMovingForward: false,
      turningDirection: 0,
      isRunning: false,
      isCrouching: false,
      wantsAttack: false,
    });
    this.world.addComponent(id, 'health', { isAlive: true, hitFlashTimer: 0 });
    this.world.addComponent(id, 'stealth', { isCrouching: false });
    this.world.addComponent(id, 'stats', {
      hp: { base: 100, current: 100 },
      maxHp: { base: 100, current: 100 },
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

    return new EntityAdapter(id, this.world, this.physics);
  }

  public deleteSelectedCreature(): void {
    if (!this.selectedCreature) return;
    const id = this.selectedCreature.id;
    const phys = this.world.getComponent(id, 'physicsBody');
    if (phys) {
      this.physics.unregisterBody(phys.body);
    }
    this.world.removeEntity(id);
    this.selectedCreature = null;
  }

  public clearWorld(): void {
    const entities = this.world.getEntitiesWith('physicsBody');
    for (const [id, { physicsBody }] of entities) {
      this.physics.unregisterBody(physicsBody.body);
      this.world.removeEntity(id);
    }
    this.physics.loadObstacles([]);
    this.selectedCreature = null;
  }

  // ДОБАВЛЕНО: Сериализация мира в JSON
  public serializeWorld(): any {
    const entitiesData: any[] = [];
    const entities = this.world.getEntitiesWith('transform', 'physicsBody', 'meta', 'stats', 'inventory', 'equip');
    for (const [id, comp] of entities) {
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
    }

    return {
      obstacles: this.physics.getObstacleLines() || [],
      entities: entitiesData,
    };
  }

  // ДОБАВЛЕНО: Восстановление мира из JSON
  public deserializeWorld(data: any): void {
    if (!data) return;
    this.clearWorld();

    if (Array.isArray(data. obstacles)) {
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
          entData.stats.crouchStealthMultiplier
        );

        adapter.updateParams({
          hp: entData.stats.hp,
          maxHp: entData.stats.maxHp,
        });

        // Восстанавливаем инвентарь и экипировку
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
      this.movementSystem.update(dt, this.world, this.physics);
      this.attackSystem.update(dt, this.world, this.physics);
      this.physics.update(dt, this.world);
      this.damageSystem.update(dt, this.world);
    }

    this.renderer.render(
      this.camera,
      this.world,
      this.physics,
      this.selectedCreature ? this.selectedCreature.id : null
    );

    if (this.onFrame) this.onFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  public selectCreature(creature: EntityAdapter | null): void {
    this.selectedCreature = creature;
  }

  public pickCreatureAt(worldPoint: Point): EntityAdapter | null {
    const entities = this.world.getEntitiesWith('transform', 'physicsBody', 'meta');
    for (let i = entities.length - 1; i >= 0; i--) {
      const [id, { transform, physicsBody }] = entities[i];
      const dist = Math.hypot(transform.x - worldPoint.x, transform.y - worldPoint.y);
      if (dist <= physicsBody.radius) {
        return new EntityAdapter(id, this.world, this.physics);
      }
    }
    return null;
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
}