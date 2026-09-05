import { GameApp } from '../GameApp';
import { EntityConfig, CollisionCategory, COLLISION_MASK_ALL, COLLISION_MASK_NONE } from './types';
import { Circle } from 'detect-collisions';

export class WorldSerializer {
  constructor(private app: GameApp) {}

  public serializeWorld(): any {
    const entitiesData: any[] = [];

    for (const [id, comp] of this.app.world.getAllEntities()) {
       const data: any = { id, components: {} };
       
       // PURE ECS: Глубокое копирование сырых компонентов
       if (comp.transform) data.components.transform = JSON.parse(JSON.stringify(comp.transform));
       if (comp.physicsStats) data.components.physicsStats = JSON.parse(JSON.stringify(comp.physicsStats));
       if (comp.healthStats) data.components.healthStats = JSON.parse(JSON.stringify(comp.healthStats));
       if (comp.movementStats) data.components.movementStats = JSON.parse(JSON.stringify(comp.movementStats));
       if (comp.stealthStats) data.components.stealthStats = JSON.parse(JSON.stringify(comp.stealthStats));
       if (comp.aiStats) data.components.aiStats = JSON.parse(JSON.stringify(comp.aiStats));
       if (comp.item) data.components.item = JSON.parse(JSON.stringify(comp.item));
       if (comp.inventory) data.components.inventory = JSON.parse(JSON.stringify(comp.inventory));
       if (comp.equip) data.components.equip = JSON.parse(JSON.stringify(comp.equip));
       if (comp.meta) data.components.meta = JSON.parse(JSON.stringify(comp.meta));
       if (comp.ownership) data.components.ownership = JSON.parse(JSON.stringify(comp.ownership));
       if (comp.health) data.components.health = JSON.parse(JSON.stringify(comp.health));
       if (comp.velocity) data.components.velocity = JSON.parse(JSON.stringify(comp.velocity));
       if (comp.input) data.components.input = JSON.parse(JSON.stringify(comp.input));
       if (comp.activeAttacks) data.components.activeAttacks = JSON.parse(JSON.stringify(comp.activeAttacks));

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
               // НОВЫЙ PURE ECS ЗАГРУЗЧИК
               this.app.world.createEntity(ent.id);
               const comps = ent.components;
               
               // Заливаем стейт компонентов как есть
               for (const [key, value] of Object.entries(comps)) {
                   this.app.world.addComponent(ent.id, key as any, value as any);
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
                  meta: ent.meta
               };

               if (ent.config && ent.stats) {
                  config.physics = { radius: ent.config.radius, weight: ent.config.weight, isSolid: ent.config.isSolid };
                  config.health = { maxHp: ent.stats.maxHp, hp: ent.stats.hp };
                  config.movement = { maxSpeed: ent.stats.maxSpeed, maxTurnSpeed: ent.stats.maxTurnSpeed, runSpeedMultiplier: ent.stats.runSpeedMultiplier, crouchSpeedMultiplier: ent.stats.crouchSpeedMultiplier, runTurnMultiplier: ent.stats.runTurnMultiplier, crouchTurnMultiplier: ent.stats.crouchTurnMultiplier };
                  config.stealth = { stealthPower: ent.stats.stealthPower, runStealthMultiplier: ent.stats.runStealthMultiplier, crouchStealthMultiplier: ent.stats.crouchStealthMultiplier };
                  config.ai = { behavior: ent.behavior };
                  config.equip = ent.equip?.slots;
               }
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