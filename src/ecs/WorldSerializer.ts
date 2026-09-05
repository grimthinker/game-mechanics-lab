import { GameApp } from '../GameApp';
import { EntityConfig, CollisionCategory, COLLISION_MASK_ALL, COLLISION_MASK_NONE, SERIALIZABLE_COMPONENT_KEYS } from './types';
import { Circle } from 'detect-collisions';

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
                
                if (comps.meta && (comps.meta as any).config) {
                    delete (comps.meta as any).config;
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
            } else {
                // СТАРЫЙ LEGACY-ФОРМАТ СОХРАНЕНИЙ (Обертка для обратной совместимости)
                const config: EntityConfig = {
                   physics: ent.physics,
                   health: ent.health,
                   movement: ent.movement,
                   stealth: ent.stealth,
                   ai: ent.ai,
                   item: ent.item,
                   inventory: ent.inventory ? { size: ent.inventory.size } : undefined,
                   equip: ent.equip,
                   meta: ent.meta ? { id: ent.meta.id || ent.id, name: ent.meta.name, entityType: ent.meta.entityType } : undefined
                };
 
                if (ent.itemData) {
                   config.item = ent.itemData;
                   if (ent.isSolid !== undefined) {
                       config.physics = { radius: ent.radius ?? 16, weight: ent.itemData.config?.weight ?? 1, isSolid: ent.isSolid };
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