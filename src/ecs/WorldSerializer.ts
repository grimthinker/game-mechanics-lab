import { GameApp } from '../GameApp';
import { CreatureConfig } from './types';

export class WorldSerializer {
  constructor(private app: GameApp) {}

  public serializeWorld(): any {
    const entitiesData: any[] = [];
    const itemsData: any[] = [];
    
    const allEntities = this.app.world.getAllEntities();
    for (const [id, comp] of allEntities) {
        if (comp.meta && comp.healthStats && comp.equip) {
            const config: CreatureConfig = {
              behavior: comp.aiStats?.behavior?.current ?? comp.meta.config.behavior,
              radius: comp.physicsStats?.radius.current ?? comp.meta.config.radius ?? 16,
              weight: comp.physicsStats?.weight.current ?? comp.meta.config.weight ?? 10,
              isSolid: comp.physicsStats?.isSolid.current ?? (comp.physicsBody !== undefined),
              maxHp: comp.healthStats.maxHp.current,
              hp: comp.healthStats.hp.current,
              maxSpeed: comp.movementStats?.maxSpeed.current ?? comp.meta.config.maxSpeed ?? 150,
              maxTurnSpeed: comp.movementStats
                ? Math.round((comp.movementStats.maxTurnSpeed.current * 180) / Math.PI)
                : comp.meta.config.maxTurnSpeed ?? 270,
              runSpeedMultiplier: comp.movementStats?.runSpeedMultiplier.current ?? comp.meta.config.runSpeedMultiplier ?? 1.5,
              crouchSpeedMultiplier: comp.movementStats?.crouchSpeedMultiplier.current ?? comp.meta.config.crouchSpeedMultiplier ?? 0.5,
              runTurnMultiplier: comp.movementStats?.runTurnMultiplier.current ?? comp.meta.config.runTurnMultiplier ?? 0.8,
              crouchTurnMultiplier: comp.movementStats?.crouchTurnMultiplier.current ?? comp.meta.config.crouchTurnMultiplier ?? 1.2,
              stealthPower: comp.stealthStats?.stealthPower.current ?? comp.meta.config.stealthPower ?? 10,
              runStealthMultiplier: comp.stealthStats?.runStealthMultiplier.current ?? comp.meta.config.runStealthMultiplier ?? 0.5,
              crouchStealthMultiplier: comp.stealthStats?.crouchStealthMultiplier.current ?? comp.meta.config.crouchStealthMultiplier ?? 1.5,
            };

            entitiesData.push({
              id,
              behavior: config.behavior,
              config,
              transform: comp.transform ? { ...comp.transform } : undefined,
              stats: {
                hp: comp.healthStats.hp.current,
                maxHp: comp.healthStats.maxHp.current,
                maxSpeed: config.maxSpeed,
                maxTurnSpeed: config.maxTurnSpeed,
                runSpeedMultiplier: config.runSpeedMultiplier,
                crouchSpeedMultiplier: config.crouchSpeedMultiplier,
                runTurnMultiplier: config.runTurnMultiplier,
                crouchTurnMultiplier: config.crouchTurnMultiplier,
                stealthPower: config.stealthPower,
                runStealthMultiplier: config.runStealthMultiplier,
                crouchStealthMultiplier: config.crouchStealthMultiplier,
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
          radius: comp.physicsBody ? comp.physicsBody.body.r : 16,
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
            const rawConfig = entData.config || {};
            const rawStats = entData.stats || {};
    
            const config: CreatureConfig = {
              behavior: entData.behavior || rawConfig.behavior || 'PlayerTree',
              radius: rawConfig.radius ?? entData.radius ?? 16,
              weight: rawConfig.weight ?? entData.weight ?? entData.mass ?? 10,
              isSolid: rawConfig.isSolid ?? entData.isSolid ?? true,
              maxSpeed: rawConfig.maxSpeed ?? rawStats.maxSpeed ?? 150,
              maxTurnSpeed: rawConfig.maxTurnSpeed ?? rawStats.maxTurnSpeed ?? 270,
              runSpeedMultiplier: rawConfig.runSpeedMultiplier ?? rawStats.runSpeedMultiplier ?? 1.5,
              crouchSpeedMultiplier: rawConfig.crouchSpeedMultiplier ?? rawStats.crouchSpeedMultiplier ?? 0.5,
              runTurnMultiplier: rawConfig.runTurnMultiplier ?? rawStats.runTurnMultiplier ?? 0.8,
              crouchTurnMultiplier: rawConfig.crouchTurnMultiplier ?? rawStats.crouchTurnMultiplier ?? 1.2,
              stealthPower: rawConfig.stealthPower ?? rawStats.stealthPower ?? 10,
              runStealthMultiplier: rawConfig.runStealthMultiplier ?? rawStats.runStealthMultiplier ?? 0.5,
              crouchStealthMultiplier: rawConfig.crouchStealthMultiplier ?? rawStats.crouchStealthMultiplier ?? 1.5,
              maxHp: rawConfig.maxHp ?? rawStats.maxHp ?? 100,
              hp: rawStats.hp ?? rawConfig.hp ?? rawConfig.maxHp ?? 100,
            };
    
            let creatureId: string;
            if (entData.transform) {
              const adapter = this.app.spawnCreature(config, entData.transform, entData.id);
              creatureId = adapter.id;
              const tr = this.app.world.getComponent(creatureId, 'transform');
              if (tr && entData.transform.angle !== undefined) {
                tr.angle = entData.transform.angle;
              }
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
              if (worldEnt.healthStats && config.hp !== undefined) {
                worldEnt.healthStats.hp.current = config.hp;
                if (worldEnt.health) worldEnt.health.isAlive = config.hp > 0;
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