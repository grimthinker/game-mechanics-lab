import { GameApp } from '../GameApp';
import { EntityConfig, CollisionCategory, COLLISION_MASK_ALL, COLLISION_MASK_NONE, SERIALIZABLE_COMPONENT_KEYS } from './types';
import { Circle } from 'detect-collisions';
import { deg2Rad, Radians } from '../utils';

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
  
          // 2. Реставрация физического тела для объектов с физикой
          if (comps.physicsStats && comps.transform) {
            const radius = comps.physicsStats.radius.current;
            const body = new Circle({ x: comps.transform.x, y: comps.transform.y }, radius);
            body.isStatic = false;
  
            const isItem = comps.tag?.archetype === 'item' || !!comps.item;
            const category = isItem ? CollisionCategory.ITEM : CollisionCategory.CREATURE;
            const mask = comps.physicsStats.isSolid.current ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
  
            (body as any).category = category;
            (body as any).mask = mask;
            this.app.world.addComponent(ent.id, 'physicsBody', { body, isStatic: false, category, mask });
            this.app.physics.registerBody(ent.id, body);
          }
  
          // 3. Реинициализация дерева поведения ИИ
          if (comps.aiStats) {
            this.app.aiSystem.initBotBrain(this.app.world, ent.id, comps.aiStats.behavior.current);
          }
  
          // 4. Реинициализация транзиентных рантайм-компонентов
          if (comps.healthStats) {
            const hp = comps.healthStats.hp.current;
            this.app.world.addComponent(ent.id, 'health', {
              isAlive: hp > 0,
              hitFlashTimer: 0,
            });
          }
  
          if (comps.movementStats) {
            this.app.world.addComponent(ent.id, 'velocity', { currentSpeed: 0, currentTurnSpeed: 0 as Radians });
            this.app.world.addComponent(ent.id, 'input', {
              isMovingForward: false,
              turnDirection: 0,
              turnSpeed: 0 as Radians,
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