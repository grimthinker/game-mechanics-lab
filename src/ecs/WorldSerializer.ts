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
          if (ent.components) {
            this.app.world.createEntity(ent.id);
            const comps = ent.components;
  
            // Адаптер миграции для старых сохранений с вложенным item.config
            if (comps.item && (comps.item as any).config) {
              const oldCfg = (comps.item as any).config;
              if (comps.item.type === 'weapon' && !comps.weaponStats) {
                comps.weaponStats = {
                  baseDamage: { base: oldCfg.baseDamage ?? 20, current: oldCfg.baseDamage ?? 20 },
                  prepTime: { base: oldCfg.prepTime ?? 0.2, current: oldCfg.prepTime ?? 0.2 },
                  castTime: { base: oldCfg.castTime ?? 0, current: oldCfg.castTime ?? 0 },
                  recoveryTime: { base: oldCfg.recoveryTime ?? 0.3, current: oldCfg.recoveryTime ?? 0.3 },
                  prepTurnSlow: { base: oldCfg.prepTurnSlow ?? 0.5, current: oldCfg.prepTurnSlow ?? 0.5 },
                  recoveryTurnSlow: { base: oldCfg.recoveryTurnSlow ?? 0.8, current: oldCfg.recoveryTurnSlow ?? 0.8 },
                  prepMoveSlow: { base: oldCfg.prepMoveSlow ?? 0.5, current: oldCfg.prepMoveSlow ?? 0.5 },
                  recoveryMoveSlow: { base: oldCfg.recoveryMoveSlow ?? 0.8, current: oldCfg.recoveryMoveSlow ?? 0.8 },
                  castMoveSlow: { base: oldCfg.castMoveSlow ?? 0.5, current: oldCfg.castMoveSlow ?? 0.5 },
                  minMultiplier: { base: oldCfg.minMultiplier ?? 0.8, current: oldCfg.minMultiplier ?? 0.8 },
                  maxMultiplier: { base: oldCfg.maxMultiplier ?? 1.2, current: oldCfg.maxMultiplier ?? 1.2 },
                  critChance: { base: oldCfg.critChance ?? 0.1, current: oldCfg.critChance ?? 0.1 },
                  critMultiplier: { base: oldCfg.critMultiplier ?? 2.0, current: oldCfg.critMultiplier ?? 2.0 },
                };
                if (oldCfg.zone && !comps.weaponZone) {
                  comps.weaponZone = oldCfg.zone;
                }
              } else if (comps.item.type === 'armor' && !comps.armorStats) {
                comps.armorStats = {
                  defense: { base: oldCfg.defense ?? 0, current: oldCfg.defense ?? 0 },
                  flatReduction: { base: oldCfg.flat_reduction ?? 0, current: oldCfg.flat_reduction ?? 0 },
                };
              }
              delete (comps.item as any).config;
              delete (comps.item as any).id;
            }
  
            if (comps.meta) {
              if ((comps.meta as any).id && !comps.meta.name) {
                comps.meta.name = (comps.meta as any).id;
              }
              delete (comps.meta as any).id;
            }
  
            // Заливаем стейт компонентов согласно белому списку
            for (const key of SERIALIZABLE_COMPONENT_KEYS) {
              if (comps[key] !== undefined) {
                this.app.world.addComponent(ent.id, key, comps[key]);
              }
            }
  
            // Вручную реставрируем несериализуемую физику и ИИ-мозги
            if (comps.physicsStats && comps.transform) {
              const radius = comps.physicsStats.radius.current;
              const body = new Circle({ x: comps.transform.x, y: comps.transform.y }, radius);
              body.isStatic = false;
              const category = comps.item ? CollisionCategory.ITEM : CollisionCategory.CREATURE;
              const mask = comps.physicsStats.isSolid.current ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
              (body as any).category = category;
              (body as any).mask = mask;
              this.app.world.addComponent(ent.id, 'physicsBody', { body, isStatic: false, category, mask });
              this.app.physics.registerBody(ent.id, body);
            }
  
            if (comps.aiStats) {
              this.app.aiSystem.initBotBrain(this.app.world, ent.id, comps.aiStats.behavior.current);
            }
  
            // Реинициализация транзиентных компонентов чистыми значениями
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
          } else {
            // СТАРЫЙ LEGACY-ФОРМАТ СОХРАНЕНИЙ (Обертка для обратной совместимости)
            if (ent.movement && typeof ent.movement.maxTurnSpeed === 'number') {
              if (ent.movement.maxTurnSpeed > 20) {
                ent.movement.maxTurnSpeed = deg2Rad(ent.movement.maxTurnSpeed);
              }
            }
  
            const config: EntityConfig = {
              physics: ent.physics,
              health: ent.health,
              movement: ent.movement,
              stealth: ent.stealth,
              ai: ent.ai,
              item: ent.item ? { name: ent.item.name ?? 'Предмет', type: ent.item.type, maxStack: ent.item.maxStack ?? 1 } : undefined,
              inventory: ent.inventory ? { size: ent.inventory.size } : undefined,
              equip: ent.equip,
              meta: ent.meta ? { name: ent.meta.name || ent.meta.id || ent.id, entityType: ent.meta.entityType } : undefined,
            };
  
            if (ent.itemData) {
              config.item = { name: ent.itemData.name, type: ent.itemData.type, maxStack: ent.itemData.maxStack ?? 1 };
              if (ent.isSolid !== undefined) {
                config.physics = { radius: ent.radius ?? 16, weight: ent.itemData.config?.weight ?? 1, isSolid: ent.isSolid };
              }
              if (ent.itemData.type === 'weapon' && ent.itemData.config) {
                config.weaponStats = { ...ent.itemData.config };
                config.weaponZone = ent.itemData.config.zone;
              } else if (ent.itemData.type === 'armor' && ent.itemData.config) {
                config.armorStats = { defense: ent.itemData.config.defense, flatReduction: ent.itemData.config.flat_reduction };
              }
              config.inventory = ent.inventory ? { size: ent.inventory.size } : undefined;
            }
  
            const newId = this.app.spawnEntity(config, ent.transform, ent.id);
  
            if (ent.inventory && ent.inventory.slots) {
              const inv = this.app.world.getComponent(newId, 'inventory');
              if (inv) inv.slots = ent.inventory.slots;
            }
            if (ent.ownership) {
              this.app.world.addComponent(newId, 'ownership', ent.ownership);
            }
          }
        }
      }
  }
}