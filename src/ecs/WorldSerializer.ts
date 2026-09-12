import { GameApp } from '../GameApp';
import {
  EntityConfig,
  CollisionCategory,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
  SERIALIZABLE_COMPONENT_KEYS,
} from './types';
import { Circle, Polygon } from 'detect-collisions';
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
        delete bbData.pressedKeys;
        delete (bbData as any).pressed_keys;
        data.components.brain = {
          blackboardData: JSON.parse(JSON.stringify(bbData)),
        };
      }

      entitiesData.push(data);
    }

    return {
      entities: entitiesData,
    };
  }

  public deserializeWorld(data: any): void {
    if (!data) return;
    this.app.clearWorld();

    if (Array.isArray(data.entities)) {
      // Предварительный проход: санитайзинг и восстановление связей ownership
      const entityMap = new Map<string, any>();
      for (const ent of data.entities) {
        entityMap.set(ent.id, ent);
      }

      for (const ent of data.entities) {
        if (!ent.components) continue;

        const injectOwnership = (itemId: string, status: 'equipped' | 'inventory') => {
          const childEnt = entityMap.get(itemId);
          if (childEnt && childEnt.components) {
            childEnt.components.ownership = { ownerId: ent.id, status };
          }
        };

        if (ent.components.equip) {
          if (ent.components.equip.interactionSlots) {
            for (const slot of ent.components.equip.interactionSlots) {
              if (slot.itemId) injectOwnership(slot.itemId, 'equipped');
            }
          }
          if (ent.components.equip.equipmentAreas) {
            for (const area of ent.components.equip.equipmentAreas) {
              for (const id of area.itemIds) {
                injectOwnership(id, 'equipped');
              }
            }
          }
        }
        if (ent.components.inventory?.slots) {
          for (const row of ent.components.inventory.slots) {
            for (const cell of row) {
              if (cell.itemId) injectOwnership(cell.itemId, 'inventory');
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

        // Инициализация мозга и восстановление памяти (blackboard) для сущностей с ИИ
        if (comps.aiStats) {
          const behaviorId = comps.aiStats.behavior?.current ?? 'IdleTree';
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
          comps.movementStats.strafeSpeedMultiplier =
            comps.movementStats.strafeSpeedMultiplier ?? 0.8;
          comps.movementStats.backwardSpeedMultiplier =
            comps.movementStats.backwardSpeedMultiplier ?? 0.6;
          comps.movementStats.strafeTurnMultiplier =
            comps.movementStats.strafeTurnMultiplier ?? 0.8;
          comps.movementStats.backwardTurnMultiplier =
            comps.movementStats.backwardTurnMultiplier ?? 0.6;
          comps.movementStats.pickupSpeedMultiplier =
            comps.movementStats.pickupSpeedMultiplier ?? 0.5;
          comps.movementStats.pickupTurnMultiplier =
            comps.movementStats.pickupTurnMultiplier ?? 1.1;
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

        if (comps.timeScale) {
          normalizeStat(comps.timeScale.multiplier);
        }

        // 3. Реставрация физического тела для объектов с физикой
        if (comps.tag?.archetype === 'marker' && comps.transform && !isPossessedItem) {
          const radius = comps.gizmo?.radius ?? 14;
          const body = new Circle({ x: comps.transform.x, y: comps.transform.y }, radius);
          body.isStatic = true;
          this.app.world.addComponent(ent.id, 'physicsBody', {
            body,
            isStatic: true,
            category: CollisionCategory.NONE,
            mask: COLLISION_MASK_NONE,
            isTrigger: true,
          });
          this.app.physics.registerBody(ent.id, body);
        } else if (comps.physicsStats && comps.transform && !isPossessedItem) {
          const archetype =
            comps.tag?.archetype ??
            (comps.zoneTrigger
              ? 'zone'
              : comps.item
                ? 'item'
                : comps.physicsStats.points
                  ? 'obstacle'
                  : 'creature');

          if (archetype !== 'marker') {
            if (archetype === 'obstacle') {
              const points = comps.physicsStats.points ?? [
                { x: -50, y: -20 },
                { x: 50, y: -20 },
                { x: 50, y: 20 },
                { x: -50, y: 20 },
              ];
              const body = new Polygon({ x: comps.transform.x, y: comps.transform.y }, points);
              body.setAngle(comps.transform.angle ?? 0);
              body.isStatic = true;
              const category = CollisionCategory.OBSTACLE;
              const isAlive = comps.health ? comps.health.isAlive : true;
              const isSolid = comps.physicsStats.isSolid && isAlive;
              const mask = isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;

              this.app.world.addComponent(ent.id, 'physicsBody', {
                body,
                isStatic: true,
                category,
                mask,
              });
              this.app.physics.registerBody(ent.id, body);
            } else {
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
        }

        if (comps.movementStats) {
          if (!this.app.world.getComponent(ent.id, 'velocity')) {
            this.app.world.addComponent(ent.id, 'velocity', {
              vx: 0,
              vy: 0,
              currentSpeed: 0,
              currentTurnSpeed: 0 as Radians,
              externalVx: 0,
              externalVy: 0,
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
            });
          }
        }

        if (comps.equip) {
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
  }
}
