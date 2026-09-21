import { GameApp } from '../GameApp';
import {
  EntityConfig,
  CollisionCategory,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
  SERIALIZABLE_COMPONENT_KEYS,
} from './types';
import { deg2Rad, Radians } from '../utils';
import { evaluateStat } from './stats/StatEvaluator';

export class WorldSerializer {
  constructor(private app: GameApp) {}

  public serializeEntities(ids: string[]): any[] {
    const entitiesData: any[] = [];

    for (const id of ids) {
      const comp = this.app.world.getEntity(id);
      if (!comp) continue;

      const data: any = { id, components: {} };

      for (const key of SERIALIZABLE_COMPONENT_KEYS) {
        const componentValue = comp[key];
        if (componentValue !== undefined) {
          data.components[key] = JSON.parse(JSON.stringify(componentValue));
        }
      }

      if (comp.brain) {
        const bbData = { ...comp.brain.blackboard.getData() };
        delete bbData.pressedKeys;
        delete (bbData as any).pressed_keys;
        data.components.brain = {
          blackboardData: JSON.parse(JSON.stringify(bbData)),
        };
      }

      entitiesData.push(data);
    }

    return entitiesData;
  }

  public serializeWorld(): any {
    const allIds = this.app.world.getAllEntities().map(([id]) => id);
    return {
      entities: this.serializeEntities(allIds),
    };
  }

  public deserializeEntities(entitiesData: any[]): void {
    if (!entitiesData || !Array.isArray(entitiesData)) return;

    const entityMap = new Map<string, any>();
    const allAssemblyPartIds = new Set<string>();

    for (const ent of entitiesData) {
      entityMap.set(ent.id, ent);
      if (ent.components?.assemblyRoot?.partIds) {
        for (const pId of ent.components.assemblyRoot.partIds) {
          allAssemblyPartIds.add(pId);
        }
      }
    }

    const injectOwnershipRecursive = (
      parentId: string,
      childId: string,
      status: 'equipped' | 'inventory'
    ) => {
      const childEnt = entityMap.get(childId);
      if (!childEnt || !childEnt.components) return;

      childEnt.components.ownership = { ownerId: parentId, status };

      if (childEnt.components.interactionSlots?.itemId) {
        injectOwnershipRecursive(childId, childEnt.components.interactionSlots.itemId, 'equipped');
      }

      if (childEnt.components.equip?.equipmentAreas) {
        for (const area of childEnt.components.equip.equipmentAreas) {
          if (Array.isArray(area.itemIds)) {
            for (const subItemId of area.itemIds) {
              injectOwnershipRecursive(childId, subItemId, 'equipped');
            }
          }
        }
      }

      if (childEnt.components.inventory?.slots) {
        for (const row of childEnt.components.inventory.slots) {
          for (const cell of row) {
            if (cell.itemId) {
              injectOwnershipRecursive(childId, cell.itemId, 'inventory');
            }
          }
        }
      }
    };

    for (const ent of entitiesData) {
      if (!ent.components) continue;

      if (ent.components.interactionSlots?.itemId) {
        injectOwnershipRecursive(ent.id, ent.components.interactionSlots.itemId, 'equipped');
      }
      if (ent.components.equip?.equipmentAreas) {
        for (const area of ent.components.equip.equipmentAreas) {
          if (Array.isArray(area.itemIds)) {
            for (const subItemId of area.itemIds) {
              injectOwnershipRecursive(ent.id, subItemId, 'equipped');
            }
          }
        }
      }
      if (ent.components.inventory?.slots) {
        for (const row of ent.components.inventory.slots) {
          for (const cell of row) {
            if (cell.itemId) injectOwnershipRecursive(ent.id, cell.itemId, 'inventory');
          }
        }
      }
    }

    for (const ent of entitiesData) {
      if (!ent.components) continue;

      // Удаляем старую сущность, если восстанавливаем поверх (например, при Undo)
      if (this.app.world.getEntity(ent.id)) {
        const phys = this.app.world.getComponent(ent.id, 'physicsBody');
        if (phys) {
          if (phys.rawBody) this.app.physicsDriver.removeRigidBody(phys.rawBody);
        }
        this.app.world.removeEntity(ent.id);
        this.app.aiSystem.unregisterEntity(ent.id);
      }

      this.app.world.createEntity(ent.id);
      const comps = ent.components;

      // 1. Восстановление сериализуемых компонентов согласно белому списку
      for (const key of SERIALIZABLE_COMPONENT_KEYS) {
        if (comps[key] !== undefined) {
          this.app.world.addComponent(ent.id, key, comps[key]);
        }
      }

      // Нормализация 3D трансформации
      const trans = this.app.world.getComponent(ent.id, 'transform');
      if (trans) {
        trans.z = trans.z ?? 0;
        if (!trans.rotation) {
          const yaw = trans.angle ?? 0;
          trans.rotation = { x: 0, y: Math.sin(yaw * 0.5), z: 0, w: Math.cos(yaw * 0.5) };
        }
        if (trans.angle === undefined) {
          const siny_cosp =
            2 * (trans.rotation.w * trans.rotation.y + trans.rotation.x * trans.rotation.z);
          const cosy_cosp =
            1 - 2 * (trans.rotation.y * trans.rotation.y + trans.rotation.z * trans.rotation.z);
          trans.angle = Math.atan2(siny_cosp, cosy_cosp);
        }
      }

      // Фолбэк для обратной совместимости старых сейвов:
      if (!comps.timeScale) {
        this.app.world.addComponent(ent.id, 'timeScale', {
          multiplier: { base: 1.0, current: 1.0, modifiers: [] },
        });
      }

      const isPossessedItem = !!comps.ownership;

      if (comps.renderable && isPossessedItem) {
        comps.renderable.isVisible = false;
      }

      // Инициализация мозга и восстановление памяти (blackboard) для агентов
      const shouldInitBrain = comps.bodyBrain || comps.aiStats;
      if (shouldInitBrain) {
        let behaviorId = comps.aiStats?.behavior?.current ?? 'IdleTree';
        if (comps.bodyBrain?.rootEntityId) {
          const rootEnt = entityMap.get(comps.bodyBrain.rootEntityId);
          behaviorId = rootEnt?.components?.aiStats?.behavior?.current ?? behaviorId;
        }
        this.app.aiSystem.initBotBrain(this.app.world, ent.id, behaviorId);

        if (comps.brain?.blackboardData) {
          const brain = this.app.world.getComponent(ent.id, 'brain');
          if (brain && brain.blackboard) {
            const sanitizedBBData = { ...comps.brain.blackboardData };
            delete sanitizedBBData.pressedKeys;
            delete sanitizedBBData.pressed_keys;
            Object.assign(brain.blackboard.getData(), sanitizedBBData);
            brain.blackboard.remove('pressedKeys');
          }
        }
      }

      // 2. Нормализация характеристик до создания физики
      const normalizeStat = (stat: any) => {
        if (stat && typeof stat === 'object' && 'base' in stat) {
          stat.modifiers = Array.isArray(stat.modifiers) ? stat.modifiers : [];
          stat.current = evaluateStat(stat);
        }
      };

      if (comps.health) {
        if (comps.health.max) normalizeStat(comps.health.max);
        comps.health.current = Math.min(
          comps.health.current,
          comps.health.max?.current ?? comps.health.current
        );
        comps.health.isAlive = comps.health.current > 0;
        comps.health.hitFlashTimer = 0;
        comps.health.healFlashTimer = 0;
      }

      if (comps.physicsStats) {
        normalizeStat(comps.physicsStats.radius);
        normalizeStat(comps.physicsStats.weight);
      }

      if (comps.movementStats) {
        normalizeStat(comps.movementStats.maxSpeed);
        normalizeStat(comps.movementStats.maxTurnSpeed);
        normalizeStat(comps.movementStats.standToCrouchTime);
        normalizeStat(comps.movementStats.crouchToStandTime);
        normalizeStat(comps.movementStats.standToProneTime);
        normalizeStat(comps.movementStats.proneToStandTime);
        normalizeStat(comps.movementStats.crouchToProneTime);
        normalizeStat(comps.movementStats.proneToCrouchTime);
        comps.movementStats.proneSpeedMultiplier = comps.movementStats.proneSpeedMultiplier ?? 0.2;
        comps.movementStats.proneTurnMultiplier = comps.movementStats.proneTurnMultiplier ?? 0.3;
        comps.movementStats.strafeSpeedMultiplier =
          comps.movementStats.strafeSpeedMultiplier ?? 0.8;
        comps.movementStats.backwardSpeedMultiplier =
          comps.movementStats.backwardSpeedMultiplier ?? 0.6;
        comps.movementStats.strafeTurnMultiplier = comps.movementStats.strafeTurnMultiplier ?? 0.8;
        comps.movementStats.backwardTurnMultiplier =
          comps.movementStats.backwardTurnMultiplier ?? 0.6;
        comps.movementStats.pickupSpeedMultiplier =
          comps.movementStats.pickupSpeedMultiplier ?? 0.5;
        comps.movementStats.pickupTurnMultiplier = comps.movementStats.pickupTurnMultiplier ?? 1.1;
      }

      if (comps.stealthStats) {
        normalizeStat(comps.stealthStats.stealthPower);
        comps.stealthStats.proneStealthMultiplier =
          comps.stealthStats.proneStealthMultiplier ?? 3.0;
      }

      if (comps.weaponStats) {
        normalizeStat(comps.weaponStats.baseDamage);
        normalizeStat(comps.weaponStats.prepTime);
        normalizeStat(comps.weaponStats.castTime);
        normalizeStat(comps.weaponStats.recoveryTime);
      }

      if (comps.armorStats) {
        normalizeStat(comps.armorStats.defense);
        normalizeStat(comps.armorStats.flatReduction);
      }

      if (comps.timeScale) {
        normalizeStat(comps.timeScale.multiplier);
      }

      if (comps.vision) {
        normalizeStat(comps.vision.fovAngle);
        normalizeStat(comps.vision.clarity);
        normalizeStat(comps.vision.maxDistance);
      }

      if (comps.hearing) {
        normalizeStat(comps.hearing.sensitivity);
        normalizeStat(comps.hearing.maxDistance);
      }

      // 3. Реставрация физического тела для объектов с физикой
      if (comps.tag?.archetype === 'marker' && comps.transform && !isPossessedItem) {
        this.app.world.addComponent(ent.id, 'physicsBody', {
          isStatic: true,
          category: CollisionCategory.NONE,
          mask: COLLISION_MASK_NONE,
          isTrigger: true,
        });
      } else if (comps.physicsStats && comps.transform && !isPossessedItem) {
        const isPartOfCreature = allAssemblyPartIds.has(ent.id);
        const archetype =
          comps.tag?.archetype ??
          (comps.areaEffector || comps.zoneTrigger
            ? 'zone'
            : comps.item
              ? 'item'
              : comps.physicsStats.points
                ? 'obstacle'
                : 'creature');

        if (archetype !== 'marker' && (!isPartOfCreature || archetype !== 'bodyPart')) {
          if (archetype === 'obstacle') {
            const points = comps.physicsStats.points ?? [
              { x: -2, y: -0.5 },
              { x: 2, y: -0.5 },
              { x: 2, y: 0.5 },
              { x: -2, y: 0.5 },
            ];
            const category = CollisionCategory.OBSTACLE;
            const isAlive = comps.health ? comps.health.isAlive : true;
            const isSolid = comps.physicsStats.isSolid && isAlive;
            const mask = isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;

            let rawBody: any = undefined;
            let rawCollider: any = undefined;

            if (this.app.physicsDriver?.isReady) {
              const pos3D = { x: trans?.x ?? 0, y: trans?.y ?? 0, z: trans?.z ?? 0 };
              rawBody = this.app.physicsDriver.createFixedBody(pos3D, ent.id);
              const angle = trans?.angle ?? 0;
              rawBody.setRotation(
                { x: 0, y: Math.sin(angle * 0.5), z: 0, w: Math.cos(angle * 0.5) },
                false
              );

              let minX = points[0]?.x ?? -2,
                maxX = points[0]?.x ?? 2;
              let minY = points[0]?.y ?? -0.5,
                maxY = points[0]?.y ?? 0.5;
              for (const p of points) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.y > maxY) maxY = p.y;
              }
              const hx = Math.max(0.1, (maxX - minX) / 2);
              const hy = 0.75; // 1.5м / 2
              const hz = Math.max(0.1, (maxY - minY) / 2);

              rawCollider = this.app.physicsDriver.createCuboidCollider(hx, hy, hz, rawBody, 0, hy);
            }

            this.app.world.addComponent(ent.id, 'physicsBody', {
              rawBody,
              rawCollider,
              bodyType: 'fixed',
              isStatic: true,
              category,
              mask,
            });
          } else {
            let isStatic = false;
            let isTrigger = false;
            let category = CollisionCategory.CREATURE;
            let mask = comps.physicsStats.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;

            let rawBody: any = undefined;
            let rawCollider: any = undefined;

            if (archetype === 'item') {
              category = CollisionCategory.ITEM;

              // Восстанавливаем 3D тело Rapier для предметов при загрузке мира
              if (this.app.physicsDriver?.isReady) {
                const pos3D = { x: trans?.x ?? 0, y: trans?.y ?? 2.5, z: trans?.z ?? 0 };
                rawBody = this.app.physicsDriver.createDynamicBody(pos3D, ent.id);
                const r = comps.physicsStats?.radius?.current ?? 0.3;
                const w = comps.physicsStats?.weight?.current ?? 1;

                const size = r * 0.8;
                rawCollider = this.app.physicsDriver.createCuboidCollider(
                  size / 2,
                  size / 2,
                  size / 2,
                  rawBody,
                  w
                );
                rawCollider.setRestitution(0.3);
                rawBody.setLinearDamping(0.95);
                rawBody.setAngularDamping(0.95);
              }
            } else if (archetype === 'zone') {
              category = CollisionCategory.TRIGGER_ZONE;
              mask = CollisionCategory.CREATURE;
              isTrigger = true;
              isStatic = false;
            }

            if (archetype === 'creature' && this.app.physicsDriver?.isReady) {
              const pos3D = { x: trans?.x ?? 0, y: trans?.y ?? 0, z: trans?.z ?? 0 };
              rawBody = this.app.physicsDriver.createKinematicPositionBody(pos3D, ent.id);
              const r = comps.physicsStats?.radius?.current ?? 0.4;
              const w = comps.physicsStats?.weight?.current ?? 75;
              const halfHeight = Math.max(0.01, (1.8 - 2 * r) / 2);
              const offsetY = halfHeight + r;
              rawCollider = this.app.physicsDriver.createCapsuleCollider(
                halfHeight,
                r,
                rawBody,
                w,
                offsetY
              );
            }

            this.app.world.addComponent(ent.id, 'physicsBody', {
              rawBody,
              rawCollider,
              bodyType:
                archetype === 'item'
                  ? 'dynamic'
                  : archetype === 'creature'
                    ? 'kinematicPositionBased'
                    : undefined,
              isStatic,
              category,
              mask,
              isTrigger,
              currentColliderStance:
                archetype === 'creature' ? comps.meta?.stance || 'standing' : undefined,
            });
          }
        }
      }

      if (comps.movementStats) {
        if (!this.app.world.getComponent(ent.id, 'velocity')) {
          this.app.world.addComponent(ent.id, 'velocity', {
            vx: 0,
            vy: 0,
            vz: 0,
            currentSpeed: 0,
            currentTurnSpeed: 0 as Radians,
            externalVx: 0,
            externalVy: 0,
            externalVz: 0,
          });
        }
        if (!this.app.world.getComponent(ent.id, 'input')) {
          this.app.world.addComponent(ent.id, 'input', {
            desiredMoveVector: null,
            moveForward: 0,
            moveStrafe: 0,
            targetLookAngle: undefined,
            isMovingForward: false,
            turnDirection: 0,
            turnRatio: 0,
            isRunning: false,
            isCrouching: false,
            isSlowWalking: false,
            wantsAttack: false,
            attackSlotIndex: undefined,
            desiredStance: 'standing',
          });
        }
      }

      if (comps.interactionSlots) {
        if (!this.app.world.getComponent(ent.id, 'activeAttacks')) {
          this.app.world.addComponent(ent.id, 'activeAttacks', { attacks: [] });
        }
      }

      if (comps.meta) {
        if (!comps.meta.directionMode) {
          comps.meta.directionMode = 'immobile';
        }
        if (!comps.meta.actionMode) {
          comps.meta.actionMode = 'idle';
        }
      }
    }
  }

  public deserializeWorld(data: any): void {
    if (!data) return;
    this.app.clearWorld();

    if (Array.isArray(data.entities)) {
      this.deserializeEntities(data.entities);
    }
  }
}
