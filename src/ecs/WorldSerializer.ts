import { GameApp } from '../GameApp';
import { CreatureConfig } from './types';

export class WorldSerializer {
  constructor(private app: GameApp) {}

  public serializeWorld(): any {
    const entitiesData: any[] = [];
    const itemsData: any[] = [];
    
    const allEntities = this.app.world.getAllEntities();
    for (const [id, comp] of allEntities) {
        if (comp.meta && comp.stats && comp.equip) {
            entitiesData.push({
              id,
              behavior: comp.stats.behavior?.current ?? comp.meta.config.behavior,
              config: comp.meta.config,
          transform: comp.transform ? { ...comp.transform } : undefined,
          stats: {
            hp: comp.stats.hp.current,
          },
          equip: {
            slots: comp.equip.slots,
          },
        });
      } else if (comp.item) {
        itemsData.push({
          id,
          transform: comp.transform ? { ...comp.transform } : undefined,
          isSolid: !!comp.physicsBody,
          radius: comp.physicsBody ? comp.physicsBody.radius : 16,
          itemData: comp.item,
          ownership: comp.ownership ? { ...comp.ownership } : undefined,
          inventory: comp.inventory ? {
             size: { ...comp.inventory.size },
             slots: comp.inventory.slots,
          } : undefined
        });
      }
    }

    return {
      obstacles: this.app.physics.getObstacleLines() || [],
      entities: entitiesData,
      items: itemsData,
    };
  }

  public deserializeWorld(data: any): void {
    if (!data) return;
    this.app.clearWorld();

    if (Array.isArray(data.obstacles)) {
      this.app.physics.loadObstacles(data.obstacles);
    }

if (Array.isArray(data.entities)) {
    for (const entData of data.entities) {
        let config: CreatureConfig = entData.config || {
            behavior: entData.behavior || 'PlayerTree',
            radius: entData.radius,
            weight: entData.mass || 10,
            isSolid: true,
            maxSpeed: entData.stats.maxSpeed,
            maxTurnSpeed: entData.stats.maxTurnSpeed,
            runSpeedMultiplier: entData.stats.runSpeedMultiplier,
            crouchSpeedMultiplier: entData.stats.crouchSpeedMultiplier,
            crouchStealthMultiplier: entData.stats.crouchStealthMultiplier,
            runTurnMultiplier: 0.8,
            crouchTurnMultiplier: 1.2,
            maxHp: entData.stats.maxHp,
        };

        let creatureId: string;
        if (entData.transform) {
          const adapter = this.app.spawnCreature(config, entData.transform, entData.id);
          creatureId = adapter.id;
        } else {
          creatureId = this.app.entityFactory.createEntityFromBlueprint(
            this.app.world,
            (this.app as any).aiSystem,
            { kind: 'creature', config },
            entData.id
          );
        }

        const worldEnt = this.app.world.getEntity(creatureId);
        if (worldEnt) {
          if (worldEnt.stats && entData.stats?.hp !== undefined) {
            worldEnt.stats.hp.current = entData.stats.hp;
            if (worldEnt.health) worldEnt.health.isAlive = entData.stats.hp > 0;
          }
          if (entData.equip) {
            worldEnt.equip = { slots: entData.equip.slots };
          }
        }
      }
    }

    if (Array.isArray(data.items)) {
      for (const itemData of data.items) {
         let iId;
         if (itemData.transform) {
             iId = this.app.spawnWorldItem(itemData.itemData, itemData.transform, itemData.isSolid, itemData.radius);
         } else {
             iId = this.app.spawnItemEntity(itemData.itemData);
             if (itemData.ownership) {
                 this.app.world.addComponent(iId, 'ownership', itemData.ownership);
             }
         }
         if (itemData.inventory) {
             this.app.world.addComponent(iId, 'inventory', {
                 size: { ...itemData.inventory.size },
                 slots: itemData.inventory.slots
             });
         }
      }
    }
  }
}