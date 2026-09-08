import { GameApp } from '../GameApp';
import {
  EntityConfig,
  CollisionCategory,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
  SERIALIZABLE_COMPONENT_KEYS,
} from './types';
import { Circle } from 'detect-collisions';
import { deg2Rad, Radians } from '../utils';
import { evaluateStat } from './stats/StatEvaluator';

export class WorldSerializer {
  constructor(private app: GameApp) {}

  public serializeWorld(): any {
    const entitiesData: any[] = [];

    for (const [id, comp] of this.app.world.getAllEntities()) {
      const data: any = { id, components: {} };

      for (const key of SERIALIZABLE_COMPONENT_KEYS) {
        const componentValue = comp[key];
        if (componentValue !== undefined) {
          data.components[key] = JSON.parse(JSON.stringify(componentValue));
        }
      }

      if (comp.brain) {
        const bbData = { ...comp.brain.blackboard.getData() };
        delete bbData.pressed_keys;
        data.components.brain = {
          blackboardData: JSON.parse(JSON.stringify(bbData)),
        };
      }

      entitiesData.push(data);
    }

    return {
      obstacles: this.app.physics.getObstacleLines() || [],
      entities: entitiesData,
    };
  }

  public deserializeWorld(data: any): void {
    if (!data) return;
    this.app.clearWorld();

    if (Array.isArray(data.obstacles)) {
      this.app.physics.loadObstacles(data.obstacles);
    }

    if (Array.isArray(data.entities)) {
      // Сбор идентификаторов предметов, находящихся во владении (экипировка / инвентарь)
      const possessedItemIds = new Set<string>();
      for (const ent of data.entities) {
        if (ent.components?.ownership) {
          possessedItemIds.add(ent.id);
        }
        if (ent.components?.equip?.slots) {
          for (const slot of ent.components.equip.slots) {
            if (slot.itemId) possessedItemIds.add(slot.itemId);
          }
        }
        if (ent.components?.inventory?.slots) {
          for (const row of ent.components.inventory.slots) {
            for (const cell of row) {
              if (cell.itemId) possessedItemIds.add(cell.itemId);
            }
          }
        }
      }

      for (const ent of data.entities) {
        if (!ent.components) continue;

        this.app.world.createEntity(ent.id);
        const comps = ent.components;

        // 1. Восстановление сериализуемых компонентов согласно белому списку
        for (const key of SERIALIZABLE_COMPONENT_KEYS) {
          if (comps[key] !== undefined) {
            this.app.world.addComponent(ent.id, key, comps[key]);
          }
        }

        const isPossessedItem = possessedItemIds.has(ent.id);

        if (comps.renderable && isPossessedItem) {
          comps.renderable.isVisible = false;
        }

        // Инициализация мозга и восстановление памяти (blackboard) для сущностей с ИИ
        if (comps.aiStats) {
          const behaviorId = comps.aiStats.behavior?.current ?? 'IdleTree';
          this.app.aiSystem.initBotBrain(this.app.world, ent.id, behaviorId);

          if (comps.brain?.blackboardData) {
            const brain = this.app.world.getComponent(ent.id, 'brain');
            if (brain && brain.blackboard) {
              const sanitizedBBData = { ...comps.brain.blackboardData };
              delete sanitizedBBData.pressed_keys;
              Object.assign(brain.blackboard.getData(), sanitizedBBData);
              brain.blackboard.remove('pressed_keys');
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
          comps.movementStats.strafeSpeedMultiplier =
            comps.movementStats.strafeSpeedMultiplier ?? 0.8;
          comps.movementStats.backwardSpeedMultiplier =
            comps.movementStats.backwardSpeedMultiplier ?? 0.6;
          comps.movementStats.strafeTurnMultiplier =
            comps.movementStats.strafeTurnMultiplier ?? 0.8;
          comps.movementStats.backwardTurnMultiplier =
            comps.movementStats.backwardTurnMultiplier ?? 0.6;
        }

        if (comps.stealthStats) {
          normalizeStat(comps.stealthStats.stealthPower);
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

        // 3. Реставрация физического тела для объектов с физикой
        if (comps.physicsStats && comps.transform && !isPossessedItem) {
          // Гарантированное определение архетипа, даже если компонент tag поврежден или отсутствует
          const archetype =
            comps.tag?.archetype ?? (comps.zoneTrigger ? 'zone' : comps.item ? 'item' : 'creature');

          if (archetype !== 'marker') {
            const radius = comps.physicsStats.radius.current;
            const body = new Circle({ x: comps.transform.x, y: comps.transform.y }, radius);

            let isStatic = false;
            let isTrigger = false;
            let category = CollisionCategory.CREATURE;
            let mask = comps.physicsStats.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;

            if (archetype === 'item') {
              category = CollisionCategory.ITEM;
            } else if (archetype === 'zone') {
              category = CollisionCategory.TRIGGER_ZONE;
              mask = CollisionCategory.CREATURE;
              isTrigger = true;
              isStatic = false;
            }

            body.isStatic = isStatic;
            this.app.world.addComponent(ent.id, 'physicsBody', {
              body,
              isStatic,
              category,
              mask,
              isTrigger,
            });
            this.app.physics.registerBody(ent.id, body);
          }
        }

        if (comps.movementStats) {
          this.app.world.addComponent(ent.id, 'velocity', {
            vx: 0,
            vy: 0,
            currentSpeed: 0,
            currentTurnSpeed: 0 as Radians,
            externalVx: 0,
            externalVy: 0,
          });
          this.app.world.addComponent(ent.id, 'input', {
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
          });
        }

        if (comps.equip) {
          this.app.world.addComponent(ent.id, 'activeAttacks', { attacks: [] });
        }

        if (comps.meta) {
          if (comps.meta.movementMode === 'attacking') {
            comps.meta.movementMode = 'immobile';
          }
          if (!comps.meta.directionMode) {
            comps.meta.directionMode = 'immobile';
          }
        }
      }
    }
  }
}
