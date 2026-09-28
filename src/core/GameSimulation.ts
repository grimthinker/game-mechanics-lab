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
import { EnvironmentSystem } from '../ecs/systems/EnvironmentSystem';
import { EntityFactory } from '../ecs/EntityFactory';
import { WorldSerializer, SerializedWorldData } from '../ecs/WorldSerializer';
import { IPhysicsDriver } from '../physics/IPhysicsDriver';
import { RapierPhysicsDriver } from '../physics/RapierPhysicsDriver';
import { GameApp } from '../GameApp';
import { GameMode } from '../config/gameConfig';
import { Vec3 } from '../types';
import { EntityConfig } from '../ecs/types';
import { createZoneConfig } from '../ecs/archetypes/ZoneArchetype';
import {
  createDefaultTerrainConfig,
  createFlatTerrainConfig,
} from '../ecs/archetypes/TerrainArchetype';
import { createDefaultEnvironmentConfig } from '../ecs/archetypes/EnvironmentArchetype';
import {
  createHouseConfig,
  createFenceConfig,
  createRockConfig,
} from '../ecs/archetypes/ObstacleArchetype';
import { getTerrainHeightAt } from '../ecs/components/terrain';
import { getAnatomyParts, getAllContainedItems } from '../ecs/utils/hierarchy';
import { CREATURE_BLUEPRINTS } from '../ecs/templates';
import { Radians, deg2Rad, createRectanglePoints } from '../utils';
import { EventBus } from './EventBus';
import { spawnFetchGroup } from '../ecs/prefabs/fetchGroupPrefab';

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
  public environmentSystem: EnvironmentSystem;

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
    this.environmentSystem = new EnvironmentSystem();
    this.entityFactory = new EntityFactory();
    this.serializer = new WorldSerializer(app);

    // Доступ к 3D-сцене и WebGL-рендереру для синхронизатора через фасад GameApp
    this.threeSyncSystem = new ThreeSyncSystem(
      (app.renderer as any).scene,
      (app.renderer as any).renderer
    );
    this.threeSyncSystem.physicsDriver = this.physicsDriver;
  }

  public fixedUpdate(dt: number): void {
    const mousePos = this.app.getMouseScreenPos();
    if (this.app.gameMode === GameMode.GAME && mousePos) {
      const playerId = this.getPlayerEntityId() ?? undefined;
      const worldPoint = this.app.getCanvasPoint(mousePos.x, mousePos.y, playerId);
      this.updatePlayerAim(worldPoint);
    }

    // Плавная привязка камеры к игроку в режиме игры
    if (this.app.gameMode === GameMode.GAME) {
      const playerId = this.getPlayerEntityId();
      if (playerId) {
        const tr = this.world.getComponent(playerId, 'transform');
        if (tr) {
          const lerpFactor = Math.min(1.0, 15.0 * dt);
          this.app.camera.targetX += (tr.x - this.app.camera.targetX) * lerpFactor;
          this.app.camera.targetY += (tr.y + 0.8 - this.app.camera.targetY) * lerpFactor;
          this.app.camera.targetZ += (tr.z - this.app.camera.targetZ) * lerpFactor;
        }
      }
    }

    this.environmentSystem.update(dt, this.world);
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
      this.playerEntityId = null;
    }
    const entities = this.world.getEntitiesWith('aiStats', 'health');
    for (const [id, comp] of entities) {
      if (comp.aiStats.behavior.current === 'PlayerTree' && comp.health.isAlive) {
        this.playerEntityId = id;
        return id;
      }
    }
    this.playerEntityId = null;
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
          const ts = this.world.getComponent(id, 'timeScale')?.multiplier.current ?? 1.0;
          if (speed < 0.1 * ts) {
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

  public initEmptyWorld(width: number, depth: number): void {
    this.clearWorld();
    this.app.editor.commandHistory.clear();

    this.spawnEntity(createFlatTerrainConfig(width, depth), { x: 0, y: 0, z: 0 }, 'terrain');
    this.spawnEntity(createDefaultEnvironmentConfig(), { x: 0, y: 0, z: 0 }, 'environment');

    this.playerEntityId = this.entityFactory.spawnModularHumanoid(
      this.world,
      this.physics,
      this.aiSystem,
      { x: 0, y: 0, z: 0 },
      'PlayerTree',
      'Игрок'
    );

    this.syncPhysicsStructures();
  }

  public initDefaultWorld(center?: Vec3): void {
    this.clearWorld();
    this.app.editor.commandHistory.clear();

    const { x: bx, y: by, z: bz } = center ?? { x: 0, y: 0, z: 0 };

    // 1. Спавн процедурного террейна и окружения по новой схеме
    this.spawnEntity(createDefaultTerrainConfig(100, 100), { x: 0, y: 0, z: 0 }, 'terrain');
    this.spawnEntity(createDefaultEnvironmentConfig(), { x: 0, y: 0, z: 0 }, 'environment');

    const terrainComp = this.world.getComponent('terrain', 'terrain');
    const getHeight = (x: number, z: number): number => {
      if (!terrainComp) return by;
      return getTerrainHeightAt(terrainComp, x, z) ?? by;
    };

    // 2. Спавн дома в центре двора (фасад ориентирован на запад к подъездной дорожке)
    const houseX = bx + 1.0;
    const houseZ = bz + 0.0;
    const houseY = getHeight(houseX, houseZ);
    // Поворот на -90 градусов направляет крыльцо и дверь строго на запад (-X)
    this.spawnEntity(
      createHouseConfig({ x: houseX, y: houseY, z: houseZ }, (-Math.PI / 2) as Radians)
    );

    // 3. Сборка периметра деревянного забора вокруг двора дома с проемом для ворот
    const spawnFenceSegment = (x: number, z: number, angle: Radians) => {
      const gy = getHeight(x, z);
      this.spawnEntity(createFenceConfig(2.4, { x, y: gy, z }, angle));
    };

    const spawnFenceLine = (ax: number, az: number, bxCoord: number, bzCoord: number) => {
      const dx = bxCoord - ax;
      const dz = bzCoord - az;
      const len = Math.hypot(dx, dz);
      if (len < 0.5) return;

      const angle = Math.atan2(dz, dx) as Radians;
      const segLen = 2.35;
      const count = Math.max(1, Math.round(len / segLen));
      const step = len / count;
      const dirX = dx / len;
      const dirZ = dz / len;

      for (let i = 0; i < count; i++) {
        const d = (i + 0.5) * step;
        spawnFenceSegment(ax + dirX * d, az + dirZ * d, angle);
      }
    };

    // Узловые точки периметра забора усадьбы по схеме (Image 3):
    // Северная стена:
    spawnFenceLine(bx - 6.0, bz - 8.5, bx + 7.0, bz - 8.5);
    // Восточная стена:
    spawnFenceLine(bx + 7.0, bz - 8.5, bx + 7.0, bz + 8.5);
    // Южная стена:
    spawnFenceLine(bx + 7.0, bz + 8.5, bx - 6.0, bz + 8.5);
    // Юго-западный скос:
    spawnFenceLine(bx - 6.0, bz + 8.5, bx - 9.0, bz + 3.2);
    // Северо-западный скос:
    spawnFenceLine(bx - 6.0, bz - 8.5, bx - 9.0, bz - 2.8);
    // (Между z = -2.8 и z = +3.2 на x = -9.0 оставлен открытый проем для въезда с дороги)

    // 4. Спавн лесных массивов (по референсу 3):
    const spawnTree = (tx: number, tz: number) => {
      const ty = getHeight(tx, tz);
      const randomAngle = (Math.random() * Math.PI * 2) as Radians;
      this.spawnEntity(
        {
          tag: { archetype: 'obstacle' },
          meta: { name: 'Дерево', entityType: 'obstacle', destructible: false },
          visualModel: { modelId: 'proc://prop/tree' },
          transform: {
            x: tx,
            y: ty,
            z: tz,
            rotation: {
              x: 0,
              y: Math.sin(randomAngle * 0.5),
              z: 0,
              w: Math.cos(randomAngle * 0.5),
            },
            angle: randomAngle,
          },
          physics: {
            radius: 0.6,
            weight: 5000,
            isSolid: true,
            height: 4.0,
            points: createRectanglePoints(0.6, 0.6),
          },
        },
        { x: tx, y: ty, z: tz }
      );
    };

    // А. Северная плотная роща (к северу от усадьбы)
    for (let i = 0; i < 28; i++) {
      const tx = bx + (Math.random() - 0.3) * 26;
      const tz = bz - 20 - Math.random() * 24;
      spawnTree(tx, tz);
    }

    // Б. Южный лесной массив (к югу от усадьбы и тракта)
    for (let i = 0; i < 34; i++) {
      const tx = bx + (Math.random() - 0.4) * 36;
      const tz = bz + 18 + Math.random() * 26;
      spawnTree(tx, tz);
    }

    // В. Деревья вдоль обочин главного тракта
    const roadTreePositions = [
      { x: -7, z: -42 },
      { x: -8, z: -32 },
      { x: -10, z: -20 },
      { x: -13, z: -10 },
      { x: -14, z: 8 },
      { x: -16, z: 18 },
      { x: -19, z: 28 },
      { x: -25, z: 38 },
      { x: -33, z: 46 },
    ];
    roadTreePositions.forEach((pt) => spawnTree(bx + pt.x, bz + pt.z));

    // Г. Деревья на восточной поляне и вокруг песчаного овала
    const eastTreePositions = [
      { x: 30, z: -16 },
      { x: 33, z: -10 },
      { x: 34, z: -2 },
      { x: 33, z: 8 },
      { x: 30, z: 16 },
      { x: 26, z: 22 },
      { x: 42, z: -25 },
    ];
    eastTreePositions.forEach((pt) => spawnTree(bx + pt.x, bz + pt.z));

    // Д. Деревья внутри двора усадьбы (по схеме)
    spawnTree(bx - 2.5, bz - 6.5);
    spawnTree(bx + 4.5, bz + 4.5);

    // 5. Россыпи камней (все 5 вариантов по референсу 2)
    const rockSpawns = [
      // Вдоль границы западного песчаного хребта
      { x: -18, z: 12, v: 1 as const, s: 1.2 },
      { x: -24, z: 25, v: 4 as const, s: 1.4 },
      { x: -15, z: -24, v: 5 as const, s: 1.1 },
      { x: -28, z: 40, v: 2 as const, s: 1.3 },
      { x: -17, z: -38, v: 1 as const, s: 1.0 },

      // Вокруг восточной песчаной поляны
      { x: 13, z: -14, v: 3 as const, s: 1.3 },
      { x: 29, z: -8, v: 2 as const, s: 1.5 },
      { x: 28, z: 10, v: 4 as const, s: 1.2 },
      { x: 14, z: 8, v: 1 as const, s: 1.0 },

      // У ворот двора и на перекрестке подъездной дорожки
      { x: -12, z: -4, v: 5 as const, s: 0.9 },
      { x: -11, z: 5, v: 2 as const, s: 1.0 },
    ];

    rockSpawns.forEach((r, idx) => {
      const rx = bx + r.x;
      const rz = bz + r.z;
      const ry = getHeight(rx, rz);
      const angle = ((idx * 1.37) % (Math.PI * 2)) as Radians;
      this.spawnEntity(createRockConfig(r.v, r.s, { x: rx, y: ry, z: rz }, angle));
    });

    // 6. Игрок: начинает перед воротами на подъездной дорожке, глядя во двор
    const playerX = bx - 11.5;
    const playerZ = bz + 0.5;
    const playerY = getHeight(playerX, playerZ);
    this.playerEntityId = this.entityFactory.spawnModularHumanoid(
      this.world,
      this.physics,
      this.aiSystem,
      { x: playerX, y: playerY, z: playerZ },
      'PlayerTree',
      'Игрок'
    );

    // 7. Спавн связки «Хозяин и собаки (Апорт)» через переиспользуемую фабрику префаба
    const masterX = bx - 2.5;
    const masterZ = bz + 0.5;
    const masterY = getHeight(masterX, masterZ);
    spawnFetchGroup(this, { x: masterX, y: masterY, z: masterZ });

    // 9. Зоны эффекторов
    const healY = getHeight(bx + 4.0, bz - 4.5);
    this.spawnEntity(createZoneConfig('heal', 2.5, 15), { x: bx + 4.0, y: healY, z: bz - 4.5 });

    // 10. Предметы экипировки и оружие во дворе
    const yardItemY = getHeight(bx - 2.5, bz + 2.2);
    this.spawnEntity(
      {
        tag: { archetype: 'item', subType: 'weapon' },
        meta: { name: 'Меч', entityType: 'item' },
        visualModel: { modelId: 'proc://prop/sword' },
        item: {
          name: 'Меч',
          type: 'weapon',
          maxStack: 1,
          count: 1,
          size: 10,
          equipTypes: [],
          equippable: false,
          equipTimeMultiplier: 1.0,
        },
        physics: {
          radius: 0.4,
          weight: 2,
          isSolid: true,
          halfExtents: { x: 0.15, y: 0.64, z: 0.02 },
          colliderOffset: { x: 0, y: 0.36, z: 0 },
        },
        weaponStats: { baseDamage: 25, prepTime: 0.2, castTime: 0, recoveryTime: 0.3 },
        weaponZone: {
          hitZoneType: 'angle',
          radius: 2.5,
          angle: deg2Rad(90),
          pierceObstacles: false,
          pierceCreatures: false,
          pierceItems: false,
        },
      },
      { x: bx - 2.5, y: yardItemY + 0.2, z: bz + 2.2 }
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
      { x: bx - 2.5, y: yardItemY + 0.2, z: bz + 3.0 }
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
      { x: bx - 2.5, y: yardItemY + 0.2, z: bz + 3.8 }
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
