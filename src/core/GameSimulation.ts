import { World } from '../ecs/World';
import { PhysicsSystem } from '../ecs/systems/PhysicsSystem';
import { MovementSystem } from '../ecs/systems/MovementSystem';
import { StealthSystem } from '../ecs/systems/StealthSystem';
import { AttackSystem } from '../ecs/systems/AttackSystem';
import { DamageSystem } from '../ecs/systems/DamageSystem';
import { AISystem } from '../ecs/systems/AISystem';
import { InteractionSystem } from '../ecs/systems/InteractionSystem';
import { AreaEffectorSystem } from '../ecs/systems/AreaEffectorSystem';
import { AnatomySystem } from '../ecs/systems/AnatomySystem';
import { AnimationSyncSystem } from '../ecs/systems/AnimationSyncSystem';
import { ModifierSystem } from '../ecs/systems/ModifierSystem';
import { AttachmentSystem } from '../ecs/systems/AttachmentSystem';
import { ThreeSyncSystem } from '../ecs/systems/ThreeSyncSystem';
import { EntityFactory } from '../ecs/EntityFactory';
import { WorldSerializer, SerializedWorldData } from '../ecs/WorldSerializer';
import { IPhysicsDriver } from '../physics/IPhysicsDriver';
import { RapierPhysicsDriver } from '../physics/RapierPhysicsDriver';
import { GameApp } from '../GameApp';
import { GameMode } from '../config/gameConfig';
import { Vec3 } from '../types';
import { EntityConfig } from '../ecs/types';
import { createZoneConfig } from '../ecs/archetypes/ZoneArchetype';
import { createDefaultTerrainConfig } from '../ecs/archetypes/TerrainArchetype';
import { getAnatomyParts, getAllContainedItems } from '../ecs/utils/hierarchy';
import { CREATURE_BLUEPRINTS } from '../ecs/templates';
import { Radians, deg2Rad } from '../utils';
import { EventBus } from './EventBus';

export class GameSimulation {
  public world: World;
  public physicsDriver: IPhysicsDriver;
  public physics: PhysicsSystem;
  public movementSystem: MovementSystem;
  public stealthSystem: StealthSystem;
  public attackSystem: AttackSystem;
  public damageSystem: DamageSystem;
  public aiSystem: AISystem;
  public anatomySystem: AnatomySystem;
  public threeSyncSystem: ThreeSyncSystem;
  public interactionSystem: InteractionSystem;
  public areaEffectorSystem: AreaEffectorSystem;
  public animationSyncSystem: AnimationSyncSystem;
  public modifierSystem: ModifierSystem;
  public attachmentSystem: AttachmentSystem;

  public entityFactory: EntityFactory;
  public serializer: WorldSerializer;

  public playerEntityId: string | null = null;
  public isPhysicsStructureDirty: boolean = false;

  constructor(private app: GameApp) {
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
    this.entityFactory = new EntityFactory();
    this.serializer = new WorldSerializer(app);

    // Доступ к 3D-сцене для синхронизатора через фасад GameApp
    this.threeSyncSystem = new ThreeSyncSystem((app.renderer as any).scene);
  }

  public fixedUpdate(dt: number): void {
    const mousePos = this.app.getMouseScreenPos();
    if (this.app.gameMode === GameMode.GAME && mousePos) {
      const playerId = this.getPlayerEntityId() ?? undefined;
      const worldPoint = this.app.getCanvasPoint(mousePos.x, mousePos.y, playerId);
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
    this.syncDynamicBodiesToTransforms();
    this.attachmentSystem.update(this.world, this.physics);
    this.areaEffectorSystem.update(dt, this.world, this.physics);
    this.damageSystem.update(dt, this.world);
    this.animationSyncSystem.update(dt, this.world);
  }

  public getPlayerEntityId(): string | null {
    if (this.playerEntityId && this.world.hasEntity(this.playerEntityId)) {
      const health = this.world.getComponent(this.playerEntityId, 'health');
      if (health?.isAlive) return this.playerEntityId;
    }
    const entities = this.world.getEntitiesWith('aiStats', 'health');
    for (const [id, comp] of entities) {
      if (comp.aiStats.behavior.current === 'PlayerTree' && comp.health.isAlive) {
        this.playerEntityId = id;
        return id;
      }
    }
    return null;
  }

  public updatePlayerAim(worldPoint: Vec3): void {
    const entities = this.world.getEntitiesWith('transform', 'input', 'health', 'aiStats');
    for (const [, { transform, input, health, aiStats }] of entities) {
      if (health.isAlive && aiStats.behavior.current === 'PlayerTree') {
        const dx = worldPoint.x - transform.x;
        const dz = worldPoint.z - transform.z;
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

  public syncDynamicBodiesToTransforms(): void {
    const dynamicEntities = this.world.getEntitiesWith('transform', 'physicsBody');
    for (const [id, { transform, physicsBody }] of dynamicEntities) {
      if (physicsBody.rawBody && physicsBody.bodyType === 'dynamic') {
        if (physicsBody.rawBody.isSleeping()) continue;

        const translation = physicsBody.rawBody.translation();
        const rotation = physicsBody.rawBody.rotation();
        const linvel = physicsBody.rawBody.linvel();
        const angvel = physicsBody.rawBody.angvel();

        transform.x = translation.x;
        transform.y = translation.y;
        transform.z = translation.z;
        transform.rotation.x = rotation.x;
        transform.rotation.y = rotation.y;
        transform.rotation.z = rotation.z;
        transform.rotation.w = rotation.w;

        const siny_cosp = 2 * (rotation.w * rotation.y + rotation.x * rotation.z);
        const cosy_cosp = 1 - 2 * (rotation.y * rotation.y + rotation.z * rotation.z);
        transform.angle = Math.atan2(siny_cosp, cosy_cosp) as Radians;

        let vel = this.world.getComponent(id, 'velocity');
        if (!vel) {
          this.world.addComponent(id, 'velocity', {
            vx: linvel.x,
            vy: linvel.y,
            vz: linvel.z,
            currentSpeed: Math.hypot(linvel.x, linvel.z),
            currentTurnSpeed: 0 as Radians,
            angvel: { x: angvel.x, y: angvel.y, z: angvel.z },
          });
        } else {
          vel.vx = linvel.x;
          vel.vy = linvel.y;
          vel.vz = linvel.z;
          vel.angvel = { x: angvel.x, y: angvel.y, z: angvel.z };
        }

        const thrownObj = this.world.getComponent(id, 'thrownObject');
        if (thrownObj && thrownObj.isAirborne) {
          const speed = Math.hypot(linvel.x, linvel.y, linvel.z);
          if (speed < 0.1) {
            thrownObj.isAirborne = false;
          }
        }
      }
    }
  }

  public markPhysicsStructureDirty(): void {
    this.isPhysicsStructureDirty = true;
  }

  public syncPhysicsStructures(): void {
    if (!this.physicsDriver || !this.physicsDriver.isReady) return;
    this.anatomySystem.update(0, this.world, this.physics);
    this.attachmentSystem.update(this.world, this.physics);
    this.physics.syncDirtyTransforms(this.world);
    this.physicsDriver.updateSceneQueries();
    this.isPhysicsStructureDirty = false;
  }

  public spawnEntity(config: EntityConfig, position?: Vec3, forcedId?: string): string {
    const id = this.entityFactory.spawnEntity(
      this.world,
      this.physics,
      this.aiSystem,
      config,
      position,
      forcedId
    );
    this.syncPhysicsStructures();
    return id;
  }

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

  public startPickup(entityId: string, targetItemId: string): boolean {
    return InteractionSystem.requestPickup(this.world, entityId, targetItemId);
  }

  public cancelInteraction(entityId: string): boolean {
    return this.interactionSystem.cancelInteraction(this.world, this.physics, entityId);
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
    if (this.playerEntityId === id) this.playerEntityId = null;

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
    if (phys && phys.rawBody) {
      this.physicsDriver.removeRigidBody(phys.rawBody);
    }
    this.aiSystem.unregisterEntity(id);
    this.world.removeEntity(id);
  }

  public clearWorld(): void {
    this.playerEntityId = null;
    const entities = this.world.getAllEntities();
    for (const [id, comp] of entities) {
      if (comp.physicsBody?.rawBody) {
        this.physicsDriver.removeRigidBody(comp.physicsBody.rawBody);
      }
      this.world.removeEntity(id);
    }
    this.aiSystem.clear();
    this.app.editor.selection.clear();
    this.threeSyncSystem.clearMeshes();
    EventBus.emit('world:updated');
  }

  public initDefaultWorld(center?: Vec3): void {
    this.clearWorld();
    this.app.editor.commandHistory.clear();

    const { x: bx, y: by, z: bz } = center ?? { x: 0, y: 0, z: 0 };

    this.spawnEntity(createDefaultTerrainConfig(100, 128), { x: 0, y: 0, z: 0 });

    const playerId = this.entityFactory.spawnModularHumanoid(
      this.world,
      this.physics,
      this.aiSystem,
      { x: bx, y: by, z: bz },
      'PlayerTree',
      'Игрок'
    );

    // Выдаем игроку палку в правую руку для игры с собакой
    const playerParts = getAnatomyParts(this.world, playerId);
    const rightHandPartId = playerParts.find((pId) => {
      const slot = this.world.getComponent(pId, 'interactionSlots');
      return slot && slot.slotKind === 'right_hand';
    });

    if (rightHandPartId) {
      const stickId = this.spawnEntity(
        {
          tag: { archetype: 'item', subType: 'weapon' },
          meta: { name: 'Палка для апорта', entityType: 'item' },
          item: {
            name: 'Палка для апорта',
            type: 'weapon',
            maxStack: 1,
            count: 1,
            size: 4,
            equipTypes: [],
            equippable: false,
            equipTimeMultiplier: 1.0,
          },
          physics: { radius: 0.15, weight: 0.5, isSolid: true },
          weaponStats: { baseDamage: 5, prepTime: 0.2, recoveryTime: 0.3 },
          weaponZone: { hitZoneType: 'forward_line', length: 1.5 },
          ownership: { ownerId: rightHandPartId, status: 'equipped' },
        },
        { x: bx, y: by, z: bz }
      );
      const slot = this.world.getComponent(rightHandPartId, 'interactionSlots');
      if (slot) {
        slot.itemId = stickId;
      }
    }

    this.entityFactory.spawnModularCreature(
      this.world,
      this.physics,
      this.aiSystem,
      { x: bx + 1.5, y: by, z: bz + 1.5 },
      CREATURE_BLUEPRINTS.quadruped,
      'DogFetchTree',
      'Собака'
    );

    this.spawnEntity(createZoneConfig('damage', 2.5, 15), { x: bx + 4.5, y: by, z: bz });
    this.spawnEntity(createZoneConfig('heal', 2.5, 15), { x: bx - 4.5, y: by, z: bz });
    this.spawnEntity(
      createZoneConfig('repel', 2.5, 20, 'Зона отталкивания', false, false, false, true, 50, 0),
      { x: bx - 4.5, y: by, z: bz - 4.5 }
    );
    this.spawnEntity(
      createZoneConfig('attract', 2.5, 20, 'Зона притягивания', false, false, false, true, 50, 0),
      { x: bx + 4.5, y: by, z: bz - 4.5 }
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
      { x: bx - 4.5, y: by, z: bz + 4.5 }
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
      { x: bx + 4.5, y: by, z: bz + 4.5 }
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
      { x: bx, y: by, z: bz + 4.0 }
    );

    const itemsX = bx - 1.5;

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
      { x: itemsX, y: by + 1.0, z: bz - 2.0 }
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
      { x: itemsX, y: by + 0.5, z: bz - 1.0 }
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
      { x: itemsX, y: by + 1.5, z: bz + 0.0 }
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
      { x: itemsX, y: by + 0.2, z: bz + 1.0 }
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

    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'resource' },
        item: {
          name: 'Камень',
          type: 'resource',
          maxStack: 10,
          count: 1,
          size: 2,
          equipTypes: [],
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 0.2, weight: 0.8, isSolid: true },
      },
      { x: bx + 1.0, y: by + 0.2, z: bz + 1.0 }
    );

    this.syncPhysicsStructures();
  }

  public serializeWorld(): SerializedWorldData {
    return this.serializer.serializeWorld();
  }

  public deserializeWorld(data: SerializedWorldData): void {
    this.serializer.deserializeWorld(data);
    this.syncPhysicsStructures();
  }

  public destroy(): void {
    this.threeSyncSystem.destroy();
    this.physicsDriver.destroy();
  }
}
