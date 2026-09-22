import { World } from './ecs/World';
import { PhysicsSystem } from './ecs/systems/PhysicsSystem';
import { MovementSystem } from './ecs/systems/MovementSystem';
import { StealthSystem } from './ecs/systems/StealthSystem';
import { AttackSystem } from './ecs/systems/AttackSystem';
import { DamageSystem } from './ecs/systems/DamageSystem';
import { AISystem } from './ecs/systems/AISystem';
import { InteractionSystem } from './ecs/systems/InteractionSystem';
import { AreaEffectorSystem } from './ecs/systems/AreaEffectorSystem';
import { AnatomySystem } from './ecs/systems/AnatomySystem';
import { AnimationSyncSystem } from './ecs/systems/AnimationSyncSystem';
import { ModifierSystem } from './ecs/systems/ModifierSystem';
import { AttachmentSystem } from './ecs/systems/AttachmentSystem';
import { Camera } from './Camera';
import { ThreeRenderer } from './rendering/ThreeRenderer';
import { ThreeSyncSystem } from './ecs/systems/ThreeSyncSystem';
import { IRenderer } from './rendering/IRenderer';
import { Point, Vec3 } from './types';
import { EntityFactory } from './ecs/EntityFactory';
import { GameMode } from './config/gameConfig';
import { WorldSerializer } from './ecs/WorldSerializer';
import { EntityConfig } from './ecs/types';
import { createZoneConfig } from './ecs/archetypes/ZoneArchetype';
import { getAnatomyParts, getAllContainedItems, getRootOwner } from './ecs/utils/hierarchy';
import { CREATURE_BLUEPRINTS } from './ecs/templates';
import { SERIALIZABLE_COMPONENT_KEYS, COLLISION_MASK_ALL, COLLISION_MASK_NONE } from './ecs/types';
import { EventBus } from './core/EventBus';
import { BTLogicComponent } from './ai/core';
import { serializeBTNode } from './ai/serializer';
import { getEffectiveLogicBrain } from './ecs/utils/anatomy';
import { EDITOR_CONFIG } from './config/editorConfig';
import { deg2Rad, Radians } from './utils';
import { compileTreeBlackboardSchema } from './ai/schema';
import { AssetManager } from './rendering/AssetManager';

// Контроллеры редактора
import { SelectionController } from './editor/SelectionController';
import { GizmoController } from './editor/GizmoController';
import { EditorMutationsAPI } from './editor/EditorMutationsAPI';

// Новая система истории (Паттерн Команда)
import { CommandHistory } from './history/CommandHistory';
import { TransactionBuilder } from './history/TransactionBuilder';
import { EntitySnapshotCommand } from './history/commands/EntitySnapshotCommand';
import { ItemTransferService } from './editor/ItemTransferService';

// Физический драйвер 3D
import { IPhysicsDriver } from './physics/IPhysicsDriver';
import { RapierPhysicsDriver } from './physics/RapierPhysicsDriver';

export { EntityAdapter } from './EntityAdapter';

export class GameApp {
  private container: HTMLDivElement;
  public renderer: IRenderer;
  public world: World;

  public commandHistory: CommandHistory = new CommandHistory(EDITOR_CONFIG.historyMaxDepth);
  public get history(): CommandHistory {
    return this.commandHistory;
  }
  private mouseScreenPos: Point | null = null;

  public physics: PhysicsSystem;
  public physicsDriver: IPhysicsDriver;
  private movementSystem: MovementSystem;
  private stealthSystem: StealthSystem;
  private attackSystem: AttackSystem;
  public damageSystem: DamageSystem;
  public aiSystem: AISystem;
  private anatomySystem: AnatomySystem;
  private threeSyncSystem: ThreeSyncSystem;
  public interactionSystem: InteractionSystem;
  private areaEffectorSystem: AreaEffectorSystem;
  private animationSyncSystem: AnimationSyncSystem;
  private modifierSystem: ModifierSystem;
  public attachmentSystem: AttachmentSystem;
  public camera: Camera;

  public showUIOverlays: boolean = true;
  public showAIDebug: boolean = false;
  public globalTimeScale: number = 1.0;
  public entityFactory: EntityFactory;
  public serializer: WorldSerializer;

  // Контроллеры редактора
  public selection: SelectionController;
  public gizmo: GizmoController;
  public mutations: EditorMutationsAPI;
  public itemTransfer: ItemTransferService;

  public onFrame: (() => void) | null = null;

  private lastTime: number = 0;
  private isRunning: boolean = false;
  public isPaused: boolean = false;

  private lastBTUpdate: number = 0;
  private lastBTTargetId: string | null = null;

  private physicsAccumulator: number = 0;
  private readonly FIXED_DT: number = 1 / 60;
  private readonly MAX_ACCUMULATOR_DT: number = 0.2;

  public gameMode: GameMode = GameMode.EDITOR;

  private handleResize = () => this.resizeCanvas();

  constructor(container: HTMLDivElement) {
    this.container = container;
    const threeRenderer = new ThreeRenderer(container);
    this.renderer = threeRenderer;
    this.threeSyncSystem = new ThreeSyncSystem(threeRenderer.scene);
    this.world = new World();
    this.physicsDriver = new RapierPhysicsDriver();
    this.physics = new PhysicsSystem();
    this.physics.driver = this.physicsDriver;
    this.movementSystem = new MovementSystem();
    this.stealthSystem = new StealthSystem();
    this.attackSystem = new AttackSystem();
    this.damageSystem = new DamageSystem();
    this.aiSystem = new AISystem();
    this.anatomySystem = new AnatomySystem();
    this.interactionSystem = new InteractionSystem();
    this.areaEffectorSystem = new AreaEffectorSystem();
    this.animationSyncSystem = new AnimationSyncSystem();
    this.modifierSystem = new ModifierSystem();
    this.attachmentSystem = new AttachmentSystem();
    this.camera = new Camera();
    this.entityFactory = new EntityFactory();
    this.serializer = new WorldSerializer(this);

    // Инициализация контроллеров
    this.selection = new SelectionController(this);
    this.gizmo = new GizmoController(this);
    this.mutations = new EditorMutationsAPI(this.world);
    this.itemTransfer = new ItemTransferService(this);

    this.resizeCanvas();
    window.addEventListener('resize', this.handleResize);

    // Подписываемся на смену выделения для фиксации состояния ДО редактирования в Инспекторе
    EventBus.on('selection:changed', () => {
      if (this.gameMode === GameMode.EDITOR) {
        this.captureBaseState();
      }
    });
  }

  public get canvas(): HTMLCanvasElement {
    return this.renderer.getCanvas();
  }

  public resizeCanvas(width?: number, height?: number): void {
    let w = width;
    let h = height;
    if (w === undefined || h === undefined) {
      w = this.container.clientWidth;
      h = this.container.clientHeight;
    }
    this.renderer.resize(w, h);
  }

  public spawnEntity(config: EntityConfig, position?: Point | Vec3, forcedId?: string): string {
    return this.entityFactory.spawnEntity(
      this.world,
      this.physics,
      this.aiSystem,
      config,
      position,
      forcedId
    );
  }

  /**
   * Возвращает развернутый массив ID, включая части тела и содержимое инвентаря.
   */
  public gatherHierarchyIds(rootIds: string[]): string[] {
    const resultSet = new Set<string>();
    for (const id of rootIds) {
      if (resultSet.has(id)) continue;

      resultSet.add(id);
      const parts = getAnatomyParts(this.world, id);

      for (const partId of parts) {
        resultSet.add(partId);
        const items = getAllContainedItems(this.world, partId);
        for (const itemId of items) {
          resultSet.add(itemId);
        }
      }
    }
    return Array.from(resultSet);
  }

  private cloneHierarchy(rootId: string, offset: Point): string {
    const parts = getAnatomyParts(this.world, rootId).filter((p) => p !== rootId);
    const containedItems = getAllContainedItems(this.world, rootId);
    const allClusterIds = Array.from(new Set([rootId, ...parts, ...containedItems]));

    const idMap = new Map<string, string>();
    for (const oldId of allClusterIds) {
      const prefix = oldId.split('_').slice(0, 2).join('_') || 'ent';
      idMap.set(oldId, this.entityFactory.generateId(prefix));
    }

    for (const oldId of allClusterIds) {
      const oldComp = this.world.getEntity(oldId);
      if (!oldComp) continue;

      const newId = idMap.get(oldId)!;
      this.world.createEntity(newId);

      for (const key of SERIALIZABLE_COMPONENT_KEYS) {
        const val = oldComp[key];
        if (val !== undefined) {
          this.world.addComponent(newId, key, JSON.parse(JSON.stringify(val)));
        }
      }

      const trans = this.world.getComponent(newId, 'transform');
      if (trans) {
        trans.x += offset.x;
        trans.y += offset.y;
      }

      const meta = this.world.getComponent(newId, 'meta');
      if (meta && oldId === rootId) {
        meta.name = `${meta.name} (Копия)`;
      }

      const bodyBrain = this.world.getComponent(newId, 'bodyBrain');
      if (bodyBrain && bodyBrain.rootEntityId && idMap.has(bodyBrain.rootEntityId)) {
        bodyBrain.rootEntityId = idMap.get(bodyBrain.rootEntityId);
      }

      const assemblyRoot = this.world.getComponent(newId, 'assemblyRoot');
      if (assemblyRoot) {
        if (idMap.has(assemblyRoot.rootPartId)) {
          assemblyRoot.rootPartId = idMap.get(assemblyRoot.rootPartId)!;
        }
        assemblyRoot.partIds = assemblyRoot.partIds.map((pId) => idMap.get(pId) || pId);
      }

      const socketLink = this.world.getComponent(newId, 'socketLink');
      if (socketLink) {
        for (const link of Object.values(socketLink.links)) {
          if (idMap.has(link.targetEntityId)) {
            link.targetEntityId = idMap.get(link.targetEntityId)!;
          }
        }
      }

      const ownership = this.world.getComponent(newId, 'ownership');
      if (ownership && idMap.has(ownership.ownerId)) {
        ownership.ownerId = idMap.get(ownership.ownerId)!;
      }

      const equip = this.world.getComponent(newId, 'equip');
      if (equip) {
        for (const area of equip.equipmentAreas) {
          area.itemIds = area.itemIds.map((itemId) => idMap.get(itemId) || itemId);
        }
      }

      const inv = this.world.getComponent(newId, 'inventory');
      if (inv) {
        for (const row of inv.slots) {
          for (const cell of row) {
            if (cell.itemId && idMap.has(cell.itemId)) {
              cell.itemId = idMap.get(cell.itemId)!;
            }
          }
        }
      }

      const interactionSlots = this.world.getComponent(newId, 'interactionSlots');
      if (interactionSlots) {
        if (interactionSlots.itemId && idMap.has(interactionSlots.itemId)) {
          interactionSlots.itemId = idMap.get(interactionSlots.itemId)!;
        }
      }

      const oldPhys = this.world.getComponent(oldId, 'physicsBody');
      const physStats = this.world.getComponent(newId, 'physicsStats');
      if (oldPhys && trans && physStats) {
        this.world.addComponent(newId, 'physicsBody', {
          isStatic: oldPhys.isStatic,
          category: oldPhys.category,
          mask: oldPhys.mask,
          isTrigger: oldPhys.isTrigger,
        });
        // TODO: На шаге 5 мы добавим клонирование RigidBody Rapier.
      }

      if (bodyBrain && bodyBrain.isActive) {
        const newRootId = idMap.get(rootId)!;
        const aiStats = this.world.getComponent(newRootId, 'aiStats');
        const behavior = aiStats?.behavior?.current || 'IdleTree';
        this.aiSystem.initBotBrain(this.world, newId, behavior);
      }
    }

    return idMap.get(rootId)!;
  }

  public duplicateEntities(ids: string[], offset: Point = EDITOR_CONFIG.cloneOffset): string[] {
    const validIds = ids.filter((id) => this.world.getEntity(id));
    if (validIds.length === 0) return [];

    const tx = new TransactionBuilder(this, 'Клонирование объектов');
    tx.captureBefore([]);

    const rootIdsToClone = validIds.filter((id) => {
      const tag = this.world.getComponent(id, 'tag');
      if (tag?.archetype === 'bodyPart') {
        const root = getRootOwner(this.world, id);
        if (root && validIds.includes(root)) return false;
      }
      const ownership = this.world.getComponent(id, 'ownership');
      if (ownership && validIds.includes(ownership.ownerId)) return false;
      return true;
    });

    const newIds: string[] = [];

    for (const id of rootIdsToClone) {
      const comp = this.world.getEntity(id);
      if (!comp || !comp.transform) continue;

      const tag = comp.tag;
      const isModular = tag?.archetype === 'creature' || !!comp.assemblyRoot;

      if (isModular) {
        const newRootId = this.cloneHierarchy(id, offset);
        newIds.push(newRootId);
        continue;
      }

      const targetPos: Point = {
        x: comp.transform.x + offset.x,
        y: comp.transform.y + offset.y,
      };

      const config: EntityConfig = {};
      if (comp.tag) config.tag = JSON.parse(JSON.stringify(comp.tag));
      if (comp.meta) {
        config.meta = JSON.parse(JSON.stringify(comp.meta));
        config.meta!.name = `${comp.meta.name} (Копия)`;
      }
      if (comp.physicsStats) {
        config.physics = {
          radius: comp.physicsStats.radius.base,
          weight: comp.physicsStats.weight.base,
          isSolid: comp.physicsStats.isSolid,
          points: comp.physicsStats.points
            ? JSON.parse(JSON.stringify(comp.physicsStats.points))
            : undefined,
        };
      }
      if (comp.health) {
        config.health = {
          maxHp: comp.health.max.base,
          hp: comp.health.current,
        };
      }
      if (comp.movementStats) {
        config.movement = {
          maxSpeed: comp.movementStats.maxSpeed.base,
          maxTurnSpeed: comp.movementStats.maxTurnSpeed.base,
          runSpeedMultiplier: comp.movementStats.runSpeedMultiplier,
          crouchSpeedMultiplier: comp.movementStats.crouchSpeedMultiplier,
          proneSpeedMultiplier: comp.movementStats.proneSpeedMultiplier,
          walkSpeedMultiplier: comp.movementStats.walkSpeedMultiplier,
          runTurnMultiplier: comp.movementStats.runTurnMultiplier,
          crouchTurnMultiplier: comp.movementStats.crouchTurnMultiplier,
          proneTurnMultiplier: comp.movementStats.proneTurnMultiplier,
          walkTurnMultiplier: comp.movementStats.walkTurnMultiplier,
          turnInPlaceTurnMultiplier: comp.movementStats.turnInPlaceTurnMultiplier,
          strafeSpeedMultiplier: comp.movementStats.strafeSpeedMultiplier,
          backwardSpeedMultiplier: comp.movementStats.backwardSpeedMultiplier,
          strafeTurnMultiplier: comp.movementStats.strafeTurnMultiplier,
          backwardTurnMultiplier: comp.movementStats.backwardTurnMultiplier,
          pickupSpeedMultiplier: comp.movementStats.pickupSpeedMultiplier,
          pickupTurnMultiplier: comp.movementStats.pickupTurnMultiplier,
          standToCrouchTime: comp.movementStats.standToCrouchTime?.base,
          crouchToStandTime: comp.movementStats.crouchToStandTime?.base,
          standToProneTime: comp.movementStats.standToProneTime?.base,
          proneToStandTime: comp.movementStats.proneToStandTime?.base,
          crouchToProneTime: comp.movementStats.crouchToProneTime?.base,
          proneToCrouchTime: comp.movementStats.proneToCrouchTime?.base,
        };
      }
      if (comp.stealthStats) {
        config.stealth = {
          stealthPower: comp.stealthStats.stealthPower.base,
          runStealthMultiplier: comp.stealthStats.runStealthMultiplier,
          crouchStealthMultiplier: comp.stealthStats.crouchStealthMultiplier,
          proneStealthMultiplier: comp.stealthStats.proneStealthMultiplier,
          walkStealthMultiplier: comp.stealthStats.walkStealthMultiplier,
          turnInPlaceStealthMultiplier: comp.stealthStats.turnInPlaceStealthMultiplier,
          immobileStealthMultiplier: comp.stealthStats.immobileStealthMultiplier,
        };
      }
      if (comp.aiStats) {
        config.ai = {
          behavior: comp.aiStats.behavior.current,
          stats: comp.aiStats.stats ? JSON.parse(JSON.stringify(comp.aiStats.stats)) : undefined,
        };
      }
      if (comp.areaEffector) {
        config.areaEffector = JSON.parse(JSON.stringify(comp.areaEffector));
      }
      if (comp.visualModel) {
        config.visualModel = JSON.parse(JSON.stringify(comp.visualModel));
      }
      if (comp.animator) {
        config.animator = JSON.parse(JSON.stringify(comp.animator));
      }
      if (comp.item) {
        config.item = JSON.parse(JSON.stringify(comp.item));
      }
      if (comp.weaponStats) {
        config.weaponStats = {
          baseDamage: comp.weaponStats.baseDamage.base,
          prepTime: comp.weaponStats.prepTime.base,
          castTime: comp.weaponStats.castTime.base,
          recoveryTime: comp.weaponStats.recoveryTime.base,
          prepTurnSlow: comp.weaponStats.prepTurnSlow,
          recoveryTurnSlow: comp.weaponStats.recoveryTurnSlow,
          prepMoveSlow: comp.weaponStats.prepMoveSlow,
          recoveryMoveSlow: comp.weaponStats.recoveryMoveSlow,
          castMoveSlow: comp.weaponStats.castMoveSlow,
          minMultiplier: comp.weaponStats.minMultiplier,
          maxMultiplier: comp.weaponStats.maxMultiplier,
          critChance: comp.weaponStats.critChance,
          critMultiplier: comp.weaponStats.critMultiplier,
        };
      }
      if (comp.weaponZone) {
        config.weaponZone = JSON.parse(JSON.stringify(comp.weaponZone));
      }
      if (comp.armorStats) {
        config.armorStats = {
          defense: comp.armorStats.defense.base,
          flatReduction: comp.armorStats.flatReduction.base,
        };
      }
      if (comp.inventory) {
        config.inventory = {
          size: { ...comp.inventory.size },
        };
      }
      if (comp.interactionSlots) {
        config.interactionSlots = JSON.parse(JSON.stringify(comp.interactionSlots));
        config.interactionSlots!.itemId = null;
      }
      if (comp.equip) {
        config.equip = JSON.parse(JSON.stringify(comp.equip));
        config.equip!.equipmentAreas.forEach((a) => (a.itemIds = []));
      }
      if (comp.gizmo) {
        config.gizmo = JSON.parse(JSON.stringify(comp.gizmo));
      }
      if (comp.timeScale) {
        config.timeScale = JSON.parse(JSON.stringify(comp.timeScale));
      }
      config.transform = {
        x: targetPos.x,
        y: comp.transform.y ?? 0,
        z: comp.transform.z ?? targetPos.y,
        rotation: comp.transform.rotation
          ? { ...comp.transform.rotation }
          : {
              x: 0,
              y: Math.sin(comp.transform.angle * 0.5),
              z: 0,
              w: Math.cos(comp.transform.angle * 0.5),
            },
        angle: comp.transform.angle,
      };

      const newId = this.spawnEntity(config, targetPos);

      const newTrans = this.world.getComponent(newId, 'transform');
      if (newTrans) {
        newTrans.angle = comp.transform.angle;
      }

      newIds.push(newId);
    }

    if (newIds.length > 0) {
      this.selection.selectEntities(newIds);
    }

    tx.includeAdded(newIds);
    tx.commit();
    this.captureBaseState();

    return newIds;
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
      this.selection.selectedEntityIds.size > 0
        ? this.selection.selectedEntityIds
        : this.selection.selectedEntityId
          ? [this.selection.selectedEntityId]
          : []
    );

    if (ids.length === 0) return;

    const tx = new TransactionBuilder(this, 'Удаление объектов');
    tx.captureBefore(ids);

    for (const id of ids) {
      this.deleteEntityRecursive(id);
      if (this.selection.hoveredEntityId === id) this.selection.hoverEntity(null);
    }

    this.selection.clear();
    tx.commit();
    this.captureBaseState();
  }

  public deleteItemFromInteractionSlot(partId: string): boolean {
    const slot = this.world.getComponent(partId, 'interactionSlots');
    if (slot && slot.itemId) {
      const itemId = slot.itemId;
      slot.itemId = null;
      this.deleteEntityRecursive(itemId);
      this.attachmentSystem.update(this.world, this.physics);
      return true;
    }
    return false;
  }

  public deleteItemFromEquipmentArea(containerId: string, areaId: string, itemId: string): boolean {
    const equip = this.world.getComponent(containerId, 'equip');
    if (!equip) return false;
    const area = equip.equipmentAreas.find((a) => a.id === areaId);
    if (!area) return false;
    const idx = area.itemIds.indexOf(itemId);
    if (idx !== -1) {
      area.itemIds.splice(idx, 1);
      this.deleteEntityRecursive(itemId);
      this.attachmentSystem.update(this.world, this.physics);
      return true;
    }
    return false;
  }

  public deleteEntityRecursive(id: string): void {
    if (!this.world.getEntity(id)) return;

    const tag = this.world.getComponent(id, 'tag');
    const isAssembly = this.world.getComponent(id, 'assemblyRoot');
    if (tag?.archetype === 'creature' || isAssembly) {
      const parts = getAnatomyParts(this.world, id);
      for (const partId of parts) {
        if (partId !== id) {
          this.deleteEntityRecursive(partId);
        }
      }
    }

    const attachedEntities = this.world.getEntitiesWith('attachment');
    for (const [childId, { attachment }] of attachedEntities) {
      if (attachment.parentId === id) {
        this.deleteEntityRecursive(childId);
      }
    }

    const slotsComp = this.world.getComponent(id, 'interactionSlots');
    if (slotsComp && slotsComp.itemId) {
      this.deleteEntityRecursive(slotsComp.itemId);
    }
    const eq = this.world.getComponent(id, 'equip');
    if (eq && eq.equipmentAreas) {
      for (const area of eq.equipmentAreas) {
        for (const itemId of area.itemIds) {
          this.deleteEntityRecursive(itemId);
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
    if (phys) {
      if (phys.rawBody) {
        this.physicsDriver.removeRigidBody(phys.rawBody);
      }
    }
    this.aiSystem.unregisterEntity(id);
    this.world.removeEntity(id);
  }

  public clearWorld(): void {
    const entities = this.world.getAllEntities();
    for (const [id, comp] of entities) {
      if (comp.physicsBody) {
        if (comp.physicsBody.rawBody) {
          this.physicsDriver.removeRigidBody(comp.physicsBody.rawBody);
        }
      }
      this.world.removeEntity(id);
    }
    this.aiSystem.clear();
    this.selection.clear();
    EventBus.emit('world:updated');
  }

  public initDefaultWorld(center?: Point | Vec3): void {
    this.clearWorld();
    this.commandHistory.clear();

    const p = center ?? { x: 0, y: 0, z: 0 };
    const hasZ = 'z' in p;
    const bx = p.x;
    const by = hasZ ? (p as Vec3).y : 0;
    const bz = hasZ ? (p as Vec3).z : (p.y ?? 0);

    this.entityFactory.spawnModularHumanoid(
      this.world,
      this.physics,
      this.aiSystem,
      { x: bx, y: by, z: bz } as any,
      'PlayerTree',
      'Игрок'
    );

    this.entityFactory.spawnModularCreature(
      this.world,
      this.physics,
      this.aiSystem,
      { x: bx + 1.5, y: by, z: bz + 1.5 } as any,
      CREATURE_BLUEPRINTS.quadruped,
      'FollowerTree',
      'Собака'
    );

    this.spawnEntity(createZoneConfig('damage', 2.5, 15), { x: bx + 4.5, y: by, z: bz } as any);
    this.spawnEntity(createZoneConfig('heal', 2.5, 15), { x: bx - 4.5, y: by, z: bz } as any);
    this.spawnEntity(
      createZoneConfig('repel', 2.5, 20, 'Зона отталкивания', false, false, false, true, 50, 0),
      { x: bx - 4.5, y: by, z: bz - 4.5 } as any
    );
    this.spawnEntity(
      createZoneConfig('attract', 2.5, 20, 'Зона притягивания', false, false, false, true, 50, 0),
      { x: bx + 4.5, y: by, z: bz - 4.5 } as any
    );
    this.spawnEntity(
      createZoneConfig(
        'time_dilation',
        2.5,
        0.4,
        'Зона замедления (0.4x)',
        false,
        false,
        false,
        false
      ),
      { x: bx - 4.5, y: by, z: bz + 4.5 } as any
    );
    this.spawnEntity(
      createZoneConfig(
        'time_dilation',
        2.5,
        1.8,
        'Зона ускорения (1.8x)',
        false,
        false,
        false,
        false
      ),
      { x: bx + 4.5, y: by, z: bz + 4.5 } as any
    );

    this.spawnEntity(
      {
        tag: { archetype: 'obstacle' },
        meta: { name: 'Каменная стена', entityType: 'obstacle', destructible: true },
        health: { hp: 100, maxHp: 100 },
        physics: {
          radius: 2.0,
          weight: 1000,
          isSolid: true,
          points: [
            { x: -2, y: -0.5 },
            { x: 2, y: -0.5 },
            { x: 2, y: 0.5 },
            { x: -2, y: 0.5 },
          ],
        },
      },
      { x: bx, y: by, z: bz + 4.0 } as any
    );

    const itemsX = bx - 1.5;

    // Спавним предметы на высоте в воздухе (в безопасной зоне)
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        item: {
          name: 'Аура разрушения',
          type: 'weapon',
          maxStack: 1,
          count: 1,
          size: 10,
          equipTypes: [],
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 0.4, weight: 1, isSolid: true },
        weaponStats: { baseDamage: 30, prepTime: 0.3, castTime: 0, recoveryTime: 0.4 },
        weaponZone: {
          hitZoneType: 'radius',
          radius: 2.0,
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: itemsX, y: by + 1.0, z: bz - 2.0 } as any
    );

    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        item: {
          name: 'Шрапнельный дробовик',
          type: 'weapon',
          maxStack: 1,
          count: 1,
          size: 10,
          equipTypes: [],
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 0.4, weight: 2, isSolid: true },
        weaponStats: { baseDamage: 15, prepTime: 0.4, castTime: 0, recoveryTime: 0.5 },
        weaponZone: {
          hitZoneType: 'shrapnel',
          length: 4.0,
          angle: deg2Rad(60),
          rayCount: 5,
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: itemsX, y: by + 0.5, z: bz - 1.0 } as any
    );

    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        item: {
          name: 'Копьё пронзания',
          type: 'weapon',
          maxStack: 1,
          count: 1,
          size: 10,
          equipTypes: [],
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 0.4, weight: 3, isSolid: true },
        weaponStats: { baseDamage: 25, prepTime: 0.2, castTime: 0, recoveryTime: 0.3 },
        weaponZone: {
          hitZoneType: 'forward_line',
          length: 4.5,
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: itemsX, y: by + 1.5, z: bz + 0.0 } as any
    );

    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'armor' },
        item: {
          name: 'Тяжёлый нагрудник',
          type: 'armor',
          maxStack: 1,
          count: 1,
          size: 20,
          equipTypes: ['torso'],
          equippable: true,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 0.4, weight: 20, isSolid: true },
        armorStats: { defense: 25, flatReduction: 5 },
      },
      { x: itemsX, y: by + 0.2, z: bz + 1.0 } as any
    );

    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'armor' },
        item: {
          name: 'Стальной шлем',
          type: 'armor',
          maxStack: 1,
          count: 1,
          size: 10,
          equipTypes: ['head'],
          equippable: true,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 0.3, weight: 10, isSolid: true },
        armorStats: { defense: 15, flatReduction: 2 },
      },
      { x: bx, y: by + 1.5, z: bz + 4.0 } as any
    );
  }

  public serializeWorld(): any {
    return this.serializer.serializeWorld();
  }

  public deserializeWorld(data: any): void {
    this.serializer.deserializeWorld(data);
  }

  private baseStateForCommit: any[] = [];
  private baseSelectionForCommit = { id: null as string | null, ids: [] as string[] };

  public captureBaseState(): void {
    const ids = Array.from(this.selection.selectedEntityIds);
    this.baseStateForCommit = this.serializer.serializeEntities(this.gatherHierarchyIds(ids));
    this.baseSelectionForCommit = {
      id: this.selection.selectedEntityId,
      ids: [...ids],
    };
  }

  /**
   * Синхронно выполняет действие и сразу упаковывает его в транзакцию Команды.
   */
  public executeTransaction<T>(description: string, action: () => T): T {
    const tx = new TransactionBuilder(this, description);
    tx.captureBefore(Array.from(this.selection.selectedEntityIds));
    const result = action();
    tx.includeAdded(Array.from(this.selection.selectedEntityIds));
    tx.commit();
    this.captureBaseState();
    return result;
  }

  /**
   * Синхронно фиксирует изменения, сделанные через поля Инспектора.
   */
  public commitHistory(description: string = 'Изменение'): void {
    if (this.gameMode !== GameMode.EDITOR) return;

    const currentIds = Array.from(this.selection.selectedEntityIds);
    const currentExpanded = this.gatherHierarchyIds(currentIds);

    const allAffected = new Set<string>();
    this.baseStateForCommit.forEach((e) => allAffected.add(e.id));
    currentExpanded.forEach((id) => allAffected.add(id));

    const affectedArr = Array.from(allAffected);
    const afterEntities = this.serializer.serializeEntities(affectedArr);

    const command = new EntitySnapshotCommand(
      description,
      this,
      affectedArr,
      this.baseStateForCommit,
      afterEntities,
      this.baseSelectionForCommit,
      { id: this.selection.selectedEntityId, ids: currentIds }
    );

    this.commandHistory.push(command);
    this.captureBaseState();
  }

  public undo(): boolean {
    if (this.gameMode !== GameMode.EDITOR || !this.commandHistory.canUndo()) return false;
    this.commandHistory.undo();
    this.captureBaseState();
    return true;
  }

  public redo(): boolean {
    if (this.gameMode !== GameMode.EDITOR || !this.commandHistory.canRedo()) return false;
    this.commandHistory.redo();
    this.captureBaseState();
    return true;
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
    this.threeSyncSystem.destroy();
    if (this.renderer.destroy) {
      this.renderer.destroy();
    }
    this.physicsDriver.destroy();
    AssetManager.getInstance().clear();
  }

  public updateBTData(force: boolean = false): void {
    const targetId = this.selection.selectedEntityId;
    const now = performance.now();
    if (!force && !this.isPaused && now - this.lastBTUpdate < 100) return;
    this.lastBTUpdate = now;

    if (!targetId) {
      if (this.lastBTTargetId !== null) {
        this.lastBTTargetId = null;
        EventBus.emit('bt:updated', { btData: null, btBlackboard: null, btSchema: null });
      }
      return;
    }

    this.lastBTTargetId = targetId;
    const brain = getEffectiveLogicBrain(this.world, targetId);

    let schema = null;
    if (brain && brain.root_node) {
      schema = compileTreeBlackboardSchema(brain.root_node);
    }

    EventBus.emit('bt:updated', {
      btData: !brain || !brain.root_node ? null : serializeBTNode(brain.root_node),
      btBlackboard: !brain ? null : { ...brain.blackboard.getData() },
      btSchema: schema,
    });
  }
  public updateEntityBlackboard(entityId: string, key: string, value: any): void {
    const brain = getEffectiveLogicBrain(this.world, entityId);
    if (brain) {
      brain.blackboard.set(key, value);
      this.updateBTData(true);
    }
  }

  public removeEntityBlackboardKey(entityId: string, key: string): void {
    const brain = getEffectiveLogicBrain(this.world, entityId);
    if (brain) {
      brain.blackboard.remove(key);
      this.updateBTData(true);
    }
  }

  private updateSystems(dt: number): void {
    if (this.gameMode === GameMode.GAME && this.mouseScreenPos) {
      const worldPoint = this.getCanvasPoint(this.mouseScreenPos.x, this.mouseScreenPos.y);
      this.updatePlayerAim(worldPoint);
    }

    this.anatomySystem.update(dt, this.world, this.physics);
    this.modifierSystem.update(dt, this.world);
    this.aiSystem.update(dt, this.world);
    this.interactionSystem.update(dt, this.world, this.physics);
    this.attackSystem.update(dt, this.world, this.physics);
    this.movementSystem.update(dt, this.world, this.physics);
    this.stealthSystem.update(dt, this.world);
    this.physics.update(dt, this.world);
    this.attachmentSystem.update(this.world, this.physics);
    this.areaEffectorSystem.update(dt, this.world, this.physics);
    this.damageSystem.update(dt, this.world);
    this.animationSyncSystem.update(dt, this.world);
  }

  private loop(time: number): void {
    if (!this.isRunning) return;

    const realDt = Math.min(this.MAX_ACCUMULATOR_DT, (time - this.lastTime) / 1000);
    this.lastTime = time;

    if (!this.isPaused) {
      const simulatedDt = realDt * this.globalTimeScale;
      this.physicsAccumulator += simulatedDt;

      // Детерминированный цикл FixedUpdate: логика и физика тикают со строго фиксированным шагом 1/60 с
      while (this.physicsAccumulator >= this.FIXED_DT) {
        this.updateSystems(this.FIXED_DT);
        this.physicsDriver.step(this.FIXED_DT);
        this.physicsAccumulator -= this.FIXED_DT;
      }

      // Синхронизируем позиции динамических тел из Rapier в ECS
      this.syncDynamicBodiesToTransforms();

      if (this.gameMode === GameMode.GAME) {
        const isAnyPlayerAlive = this.world
          .getAllEntities()
          .some(
            ([_, comp]) => comp.aiStats?.behavior?.current === 'PlayerTree' && comp.health?.isAlive
          );
        if (!isAnyPlayerAlive) {
          EventBus.emit('game:playerDied');
        }
      }
    } else {
      this.physicsAccumulator = 0;
    }

    this.updateBTData(false);

    // Постоянная синхронизация Three.js сцены с миром ECS
    this.threeSyncSystem.update(
      realDt,
      this.world,
      this.gameMode,
      this.selection.selectedEntityIds
    );

    this.renderer.render({
      camera: this.camera,
      world: this.world,
      physics: this.physics,
      gameMode: this.gameMode,
      editorData: {
        selectedId: this.selection.selectedEntityId,
        selectedIds: this.selection.selectedEntityIds,
        hoveredId: this.selection.hoveredEntityId,
        marqueeBox: this.selection.marqueeBox,
        showAIDebug: this.showAIDebug,
        gizmoTool: this.gizmo.tool,
      },
      showUIOverlays: this.showUIOverlays,
    });
    if (this.onFrame) this.onFrame();

    requestAnimationFrame((t) => this.loop(t));
  }

  public setMouseScreenPos(clientX: number | null, clientY: number | null): void {
    if (clientX === null || clientY === null) {
      this.mouseScreenPos = null;
    } else {
      this.mouseScreenPos = { x: clientX, y: clientY };
    }
  }

  public updatePlayerAim(worldPoint: Point | Vec3): void {
    const entities = this.world.getEntitiesWith('transform', 'input', 'health', 'aiStats');
    for (const [, { transform, input, health, aiStats }] of entities) {
      if (health.isAlive && aiStats.behavior.current === 'PlayerTree') {
        const dx = worldPoint.x - transform.x;
        const dz =
          (worldPoint as Vec3).z !== undefined
            ? (worldPoint as Vec3).z - transform.z
            : worldPoint.y - transform.z;

        const dist = Math.hypot(dx, dz);
        if (dist > 0.05) {
          input.targetLookAngle = Math.atan2(dz, dx) as Radians;
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

  /**
   * Считывает координаты и ориентацию из симуляции Rapier3D для всех Dynamic тел
   */
  private syncDynamicBodiesToTransforms(): void {
    const dynamicEntities = this.world.getEntitiesWith('transform', 'physicsBody');
    for (const [, { transform, physicsBody }] of dynamicEntities) {
      if (physicsBody.rawBody && physicsBody.bodyType === 'dynamic') {
        // Если тело спит — его координаты гарантированно не изменились, пропускаем такт
        if (physicsBody.rawBody.isSleeping()) {
          continue;
        }

        const translation = physicsBody.rawBody.translation();
        const rotation = physicsBody.rawBody.rotation();

        transform.x = translation.x;
        transform.y = translation.y;
        transform.z = translation.z;

        transform.rotation.x = rotation.x;
        transform.rotation.y = rotation.y;
        transform.rotation.z = rotation.z;
        transform.rotation.w = rotation.w;

        // Вычисляем угол рыскания Yaw вокруг вертикальной оси Y
        const siny_cosp = 2 * (rotation.w * rotation.y + rotation.x * rotation.z);
        const cosy_cosp = 1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z);
        transform.angle = Math.atan2(siny_cosp, cosy_cosp);

        // if (physicsBody.body) {
        //   physicsBody.body.setPosition(translation.x, translation.z);
        // }
      }
    }
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
  public getCanvasPoint(clientX: number, clientY: number): Vec3 {
    return this.renderer.screenToWorld(clientX, clientY, this.camera);
  }

  // --- Методы-фасады (delegates) для обратной совместимости с Инспектором ---

  public updateEntityTransform(
    id: string,
    patch: { x?: number; y?: number; z?: number; angle?: number }
  ): boolean {
    return this.mutations.updateEntityTransform(id, patch);
  }

  public updateEntityMeta(id: string, patch: { name?: string; destructible?: boolean }): boolean {
    return this.mutations.updateEntityMeta(id, patch);
  }

  public updateEntityPhysics(
    id: string,
    patch: { radius?: number; weight?: number; isSolid?: boolean }
  ): boolean {
    return this.mutations.updateEntityPhysics(id, patch);
  }

  public updateEntityHealth(id: string, patch: { hp?: number; maxHp?: number }): boolean {
    return this.mutations.updateEntityHealth(id, patch);
  }

  public updateEntityFunctionalHealth(id: string, patch: { fp?: number; maxFp?: number }): boolean {
    return this.mutations.updateEntityFunctionalHealth(id, patch);
  }

  public updateEntitySocketLinkStrength(id: string, socketId: string, strength: number): boolean {
    return this.mutations.updateEntitySocketLinkStrength(id, socketId, strength);
  }

  public updateEntityMovementStats(id: string, patch: any): boolean {
    return this.mutations.updateEntityMovementStats(id, patch);
  }

  public updateEntityStealthStats(id: string, patch: any): boolean {
    return this.mutations.updateEntityStealthStats(id, patch);
  }

  public updateEntityAIBehavior(id: string, behavior: string): boolean {
    return this.mutations.updateEntityAIBehavior(id, behavior);
  }

  public updateEntityAreaEffector(id: string, patch: any): boolean {
    return this.mutations.updateEntityAreaEffector(id, patch);
  }

  public updateEntityWeapon(id: string, patch: any): boolean {
    return this.mutations.updateEntityWeapon(id, patch);
  }

  public updateEntityArmor(id: string, patch: any): boolean {
    return this.mutations.updateEntityArmor(id, patch);
  }

  public updateEntityGenericItem(id: string, patch: any): boolean {
    return this.mutations.updateEntityGenericItem(id, patch);
  }

  public updateEntityHeart(id: string, patch: { requiresBrain?: boolean }): boolean {
    return this.mutations.updateEntityHeart(id, patch);
  }

  public updateEntityVision(
    id: string,
    patch: { fovAngle?: number; clarity?: number; maxDistance?: number }
  ): boolean {
    return this.mutations.updateEntityVision(id, patch);
  }

  public updateEntityHearing(
    id: string,
    patch: { sensitivity?: number; maxDistance?: number }
  ): boolean {
    return this.mutations.updateEntityHearing(id, patch);
  }

  public updateEntityBag(id: string, patch: any, isBagEmpty: boolean): boolean {
    return this.mutations.updateEntityBag(id, patch, isBagEmpty);
  }

  public updateEntityInteractionSlot(
    partOrCreatureId: string,
    patch: { name?: string; interactDist?: number; strength?: number }
  ): boolean {
    return this.mutations.updateEntityInteractionSlot(partOrCreatureId, patch);
  }

  public addEntityInteractionSlot(
    partId: string,
    defaultName: string = 'Новая рука',
    interactDist: number = 25,
    strength: number = 15
  ): boolean {
    return this.mutations.addEntityInteractionSlot(partId, defaultName, interactDist, strength);
  }

  public removeEntityInteractionSlot(partId: string): boolean {
    return this.mutations.removeEntityInteractionSlot(partId);
  }

  public updateEquipmentArea(
    containerId: string,
    areaId: string,
    patch: { name?: string; space?: number; type?: string }
  ): boolean {
    return this.mutations.updateEquipmentArea(containerId, areaId, patch);
  }

  public addEquipmentArea(
    containerId: string,
    defaultType: string = 'new_equip_type',
    defaultName: string = 'Новая область',
    space?: number
  ): string {
    return this.mutations.addEquipmentArea(containerId, defaultType, defaultName, space);
  }

  public removeEquipmentArea(containerId: string, areaId: string): boolean {
    return this.mutations.removeEquipmentArea(containerId, areaId);
  }

  public setEntityInventoryGrid(id: string, enable: boolean): boolean {
    return this.mutations.setEntityInventoryGrid(id, enable);
  }
}
