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
        data.components.brain = {
          blackboardData: JSON.parse(JSON.stringify(comp.brain.blackboard.getData())),
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

        // Инициализация мозга и восстановление памяти (blackboard) для сущностей с ИИ
        if (comps.aiStats) {
          const behaviorId = comps.aiStats.behavior?.current ?? 'IdleTree';
          this.app.aiSystem.initBotBrain(this.app.world, ent.id, behaviorId);

          if (comps.brain?.blackboardData) {
            const brain = this.app.world.getComponent(ent.id, 'brain');
            if (brain && brain.blackboard) {
              Object.assign(brain.blackboard.getData(), comps.brain.blackboardData);
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
        }

        if (comps.stealthStats) {
          normalizeStat(comps.stealthStats.stealthPower);
        }

        if (comps.weaponStats) {
          normalizeStat(comps.weaponStats.baseDamage);
          normalizeStat(comps.weaponStats.prepTime);
          normalizeStat(comps.weaponStats.recoveryTime);
        }

        if (comps.armorStats) {
          normalizeStat(comps.armorStats.defense);
          normalizeStat(comps.armorStats.flatReduction);
        }

        // 3. Реставрация физического тела для объектов с физикой
        if (comps.physicsStats && comps.transform) {
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
            (body as any).category = category;
            (body as any).mask = mask;
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
            currentSpeed: 0,
            currentTurnSpeed: 0 as Radians,
          });
          this.app.world.addComponent(ent.id, 'input', {
            isMovingForward: false,
            turnDirection: 0,
            turnRatio: 0,
            isRunning: false,
            isCrouching: false,
            wantsAttack: false,
            attackSlotIndex: undefined,
          });
        }

        if (comps.equip) {
          this.app.world.addComponent(ent.id, 'activeAttacks', { attacks: [] });
        }

        if (comps.meta && comps.meta.state === 'attacking') {
          comps.meta.state = 'idle';
        }
      }
    }
  }
}
