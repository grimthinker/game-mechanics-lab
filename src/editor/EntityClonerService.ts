import type { GameApp } from '../GameApp';
import { Vec3 } from '../types';
import { EDITOR_CONFIG } from '../config/editorConfig';
import { TransactionBuilder } from '../history/TransactionBuilder';
import { getAnatomyParts, getAllContainedItems, getRootOwner } from '../ecs/utils/hierarchy';
import { EntityConfig, SERIALIZABLE_COMPONENT_KEYS } from '../ecs/types';
import { fastClone } from '../ecs/utils/clone';

export class EntityClonerService {
  constructor(private app: GameApp) {}

  public duplicateEntities(
    ids: string[],
    offset: { x: number; z: number; y?: number } = EDITOR_CONFIG.cloneOffset
  ): string[] {
    const validIds = ids.filter((id) => this.app.world.getEntity(id));
    if (validIds.length === 0) return [];

    const tx = new TransactionBuilder(this.app, 'Клонирование объектов');
    tx.captureBefore([]);

    const rootIdsToClone = validIds.filter((id) => {
      const tag = this.app.world.getComponent(id, 'tag');
      if (tag?.archetype === 'bodyPart') {
        const root = getRootOwner(this.app.world, id);
        if (root && validIds.includes(root)) return false;
      }
      const ownership = this.app.world.getComponent(id, 'ownership');
      if (ownership && validIds.includes(ownership.ownerId)) return false;
      return true;
    });

    const newIds: string[] = [];

    for (const id of rootIdsToClone) {
      const comp = this.app.world.getEntity(id);
      if (!comp || !comp.transform) continue;

      const tag = comp.tag;
      const isModular = tag?.archetype === 'creature' || !!comp.assemblyRoot;

      if (isModular) {
        const newRootId = this.cloneHierarchy(id, offset);
        newIds.push(newRootId);
        continue;
      }

      const targetPos: Vec3 = {
        x: comp.transform.x + offset.x,
        y: comp.transform.y + (offset.y ?? 0),
        z: comp.transform.z + offset.z,
      };

      const config: EntityConfig = {};
      if (comp.tag) config.tag = fastClone(comp.tag);
      if (comp.meta) {
        config.meta = fastClone(comp.meta);
        config.meta!.name = `${comp.meta.name} (Копия)`;
      }
      if (comp.physicsStats) {
        config.physics = {
          radius: comp.physicsStats.radius.base,
          weight: comp.physicsStats.weight.base,
          isSolid: comp.physicsStats.isSolid,
          points: comp.physicsStats.points ? fastClone(comp.physicsStats.points) : undefined,
        };
      }
      if (comp.health) {
        config.health = {
          maxHp: comp.health.max.base,
          hp: comp.health.current,
        };
      }
      if (comp.movementStats) {
        config.movement = {
          maxSpeed: comp.movementStats.maxSpeed.base,
          maxTurnSpeed: comp.movementStats.maxTurnSpeed.base,
          runSpeedMultiplier: comp.movementStats.runSpeedMultiplier,
          crouchSpeedMultiplier: comp.movementStats.crouchSpeedMultiplier,
          proneSpeedMultiplier: comp.movementStats.proneSpeedMultiplier,
          walkSpeedMultiplier: comp.movementStats.walkSpeedMultiplier,
          runTurnMultiplier: comp.movementStats.runTurnMultiplier,
          crouchTurnMultiplier: comp.movementStats.crouchTurnMultiplier,
          proneTurnMultiplier: comp.movementStats.proneTurnMultiplier,
          walkTurnMultiplier: comp.movementStats.walkTurnMultiplier,
          turnInPlaceTurnMultiplier: comp.movementStats.turnInPlaceTurnMultiplier,
          strafeSpeedMultiplier: comp.movementStats.strafeSpeedMultiplier,
          backwardSpeedMultiplier: comp.movementStats.backwardSpeedMultiplier,
          strafeTurnMultiplier: comp.movementStats.strafeTurnMultiplier,
          backwardTurnMultiplier: comp.movementStats.backwardTurnMultiplier,
          pickupSpeedMultiplier: comp.movementStats.pickupSpeedMultiplier,
          pickupTurnMultiplier: comp.movementStats.pickupTurnMultiplier,
          standToCrouchTime: comp.movementStats.standToCrouchTime?.base,
          crouchToStandTime: comp.movementStats.crouchToStandTime?.base,
          standToProneTime: comp.movementStats.standToProneTime?.base,
          proneToStandTime: comp.movementStats.proneToStandTime?.base,
          crouchToProneTime: comp.movementStats.crouchToProneTime?.base,
          proneToCrouchTime: comp.movementStats.proneToCrouchTime?.base,
        };
      }
      if (comp.stealthStats) {
        config.stealth = {
          stealthPower: comp.stealthStats.stealthPower.base,
          runStealthMultiplier: comp.stealthStats.runStealthMultiplier,
          crouchStealthMultiplier: comp.stealthStats.crouchStealthMultiplier,
          proneStealthMultiplier: comp.stealthStats.proneStealthMultiplier,
          walkStealthMultiplier: comp.stealthStats.walkStealthMultiplier,
          turnInPlaceStealthMultiplier: comp.stealthStats.turnInPlaceStealthMultiplier,
          immobileStealthMultiplier: comp.stealthStats.immobileStealthMultiplier,
        };
      }
      if (comp.aiStats) {
        config.ai = {
          behavior: comp.aiStats.behavior.current,
          stats: comp.aiStats.stats ? fastClone(comp.aiStats.stats) : undefined,
        };
      }
      if (comp.areaEffector) {
        config.areaEffector = fastClone(comp.areaEffector);
      }
      if (comp.visualModel) {
        config.visualModel = fastClone(comp.visualModel);
      }
      if (comp.animator) {
        config.animator = fastClone(comp.animator);
      }
      if (comp.item) {
        config.item = fastClone(comp.item);
      }
      if (comp.weaponStats) {
        config.weaponStats = {
          baseDamage: comp.weaponStats.baseDamage.base,
          prepTime: comp.weaponStats.prepTime.base,
          castTime: comp.weaponStats.castTime.base,
          recoveryTime: comp.weaponStats.recoveryTime.base,
          prepTurnSlow: comp.weaponStats.prepTurnSlow,
          recoveryTurnSlow: comp.weaponStats.recoveryTurnSlow,
          prepMoveSlow: comp.weaponStats.prepMoveSlow,
          recoveryMoveSlow: comp.weaponStats.recoveryMoveSlow,
          castMoveSlow: comp.weaponStats.castMoveSlow,
          minMultiplier: comp.weaponStats.minMultiplier,
          maxMultiplier: comp.weaponStats.maxMultiplier,
          critChance: comp.weaponStats.critChance,
          critMultiplier: comp.weaponStats.critMultiplier,
        };
      }
      if (comp.weaponZone) {
        config.weaponZone = fastClone(comp.weaponZone);
      }
      if (comp.armorStats) {
        config.armorStats = {
          defense: comp.armorStats.defense.base,
          flatReduction: comp.armorStats.flatReduction.base,
        };
      }
      if (comp.inventory) {
        config.inventory = {
          size: { ...comp.inventory.size },
        };
      }
      if (comp.interactionSlots) {
        config.interactionSlots = fastClone(comp.interactionSlots);
        config.interactionSlots!.itemId = null;
      }
      if (comp.equip) {
        config.equip = fastClone(comp.equip);
        config.equip!.equipmentAreas.forEach((a) => (a.itemIds = []));
      }
      if (comp.gizmo) {
        config.gizmo = fastClone(comp.gizmo);
      }
      if (comp.timeScale) {
        config.timeScale = fastClone(comp.timeScale);
      }
      config.transform = {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        rotation: comp.transform.rotation
          ? { ...comp.transform.rotation }
          : {
              x: 0,
              y: Math.sin(comp.transform.angle * 0.5),
              z: 0,
              w: Math.cos(comp.transform.angle * 0.5),
            },
        angle: comp.transform.angle,
      };

      const newId = this.app.spawnEntity(config, targetPos);

      const newTrans = this.app.world.getComponent(newId, 'transform');
      if (newTrans) {
        newTrans.angle = comp.transform.angle;
      }

      newIds.push(newId);
    }

    if (newIds.length > 0) {
      this.app.selection.selectEntities(newIds);
    }

    this.app.syncPhysicsStructures();
    tx.includeAdded(newIds);
    tx.commit();
    this.app.captureBaseState();

    return newIds;
  }

  private cloneHierarchy(rootId: string, offset: { x: number; z: number; y?: number }): string {
    const parts = getAnatomyParts(this.app.world, rootId).filter((p) => p !== rootId);
    const containedItems = getAllContainedItems(this.app.world, rootId);
    const allClusterIds = Array.from(new Set([rootId, ...parts, ...containedItems]));

    const idMap = new Map<string, string>();
    for (const oldId of allClusterIds) {
      const prefix = oldId.split('_').slice(0, 2).join('_') || 'ent';
      idMap.set(oldId, this.app.entityFactory.generateId(prefix));
    }

    for (const oldId of allClusterIds) {
      const oldComp = this.app.world.getEntity(oldId);
      if (!oldComp) continue;

      const newId = idMap.get(oldId)!;
      this.app.world.createEntity(newId);

      for (const key of SERIALIZABLE_COMPONENT_KEYS) {
        const val = oldComp[key];
        if (val !== undefined) {
          this.app.world.addComponent(newId, key, fastClone(val));
        }
      }

      const trans = this.app.world.getComponent(newId, 'transform');
      if (trans) {
        trans.x += offset.x;
        trans.y += offset.y ?? 0;
        trans.z += offset.z;
        trans.isDirty = true;
      }

      const meta = this.app.world.getComponent(newId, 'meta');
      if (meta && oldId === rootId) {
        meta.name = `${meta.name} (Копия)`;
      }

      const bodyBrain = this.app.world.getComponent(newId, 'bodyBrain');
      if (bodyBrain && bodyBrain.rootEntityId && idMap.has(bodyBrain.rootEntityId)) {
        bodyBrain.rootEntityId = idMap.get(bodyBrain.rootEntityId);
      }

      const assemblyRoot = this.app.world.getComponent(newId, 'assemblyRoot');
      if (assemblyRoot) {
        if (idMap.has(assemblyRoot.rootPartId)) {
          assemblyRoot.rootPartId = idMap.get(assemblyRoot.rootPartId)!;
        }
        assemblyRoot.partIds = assemblyRoot.partIds.map((pId) => idMap.get(pId) || pId);
      }

      const socketLink = this.app.world.getComponent(newId, 'socketLink');
      if (socketLink) {
        for (const link of Object.values(socketLink.links)) {
          if (idMap.has(link.targetEntityId)) {
            link.targetEntityId = idMap.get(link.targetEntityId)!;
          }
        }
      }

      const ownership = this.app.world.getComponent(newId, 'ownership');
      if (ownership && idMap.has(ownership.ownerId)) {
        ownership.ownerId = idMap.get(ownership.ownerId)!;
      }

      const equip = this.app.world.getComponent(newId, 'equip');
      if (equip) {
        for (const area of equip.equipmentAreas) {
          area.itemIds = area.itemIds.map((itemId) => idMap.get(itemId) || itemId);
        }
      }

      const inv = this.app.world.getComponent(newId, 'inventory');
      if (inv) {
        for (const row of inv.slots) {
          for (const cell of row) {
            if (cell.itemId && idMap.has(cell.itemId)) {
              cell.itemId = idMap.get(cell.itemId)!;
            }
          }
        }
      }

      const interactionSlots = this.app.world.getComponent(newId, 'interactionSlots');
      if (interactionSlots) {
        if (interactionSlots.itemId && idMap.has(interactionSlots.itemId)) {
          interactionSlots.itemId = idMap.get(interactionSlots.itemId)!;
        }
      }

      const oldPhys = this.app.world.getComponent(oldId, 'physicsBody');
      const physStats = this.app.world.getComponent(newId, 'physicsStats');
      if (oldPhys && trans && physStats) {
        this.app.world.addComponent(newId, 'physicsBody', {
          isStatic: oldPhys.isStatic,
          category: oldPhys.category,
          mask: oldPhys.mask,
          isTrigger: oldPhys.isTrigger,
        });
      }

      if (bodyBrain && bodyBrain.isActive) {
        const newRootId = idMap.get(rootId)!;
        const aiStats = this.app.world.getComponent(newRootId, 'aiStats');
        const behavior = aiStats?.behavior?.current || 'IdleTree';
        this.app.aiSystem.initBotBrain(this.app.world, newId, behavior);
      }
    }

    return idMap.get(rootId)!;
  }
}
