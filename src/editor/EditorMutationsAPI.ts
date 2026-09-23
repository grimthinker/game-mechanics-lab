import { World } from '../ecs/World';
import { setBaseStat } from '../ecs/stats/StatEvaluator';
import { deg2Rad } from '../utils';

export class EditorMutationsAPI {
  constructor(private world: World) {}

  public updateEntityTransform(
    id: string,
    patch: { x?: number; y?: number; z?: number; angle?: number }
  ): boolean {
    const transform = this.world.getComponent(id, 'transform');
    if (!transform) return false;
    let changed = false;

    if (patch.x !== undefined && transform.x !== patch.x) {
      transform.x = patch.x;
      changed = true;
    }
    if (patch.y !== undefined && transform.y !== patch.y) {
      transform.y = patch.y;
      changed = true;
    }
    if (patch.z !== undefined && transform.z !== patch.z) {
      transform.z = patch.z;
      changed = true;
    }
    if (patch.angle !== undefined && transform.angle !== patch.angle) {
      transform.angle = patch.angle;
      const half = -patch.angle * 0.5;
      transform.rotation = {
        x: 0,
        y: Math.sin(half),
        z: 0,
        w: Math.cos(half),
      };
      changed = true;
    }

    // Делегируем синхронизацию физическому движку через Data-Oriented подход
    if (changed) {
      transform.isDirty = true;
    }

    return changed;
  }

  public updateEntityMeta(id: string, patch: { name?: string; destructible?: boolean }): boolean {
    const meta = this.world.getComponent(id, 'meta');
    const item = this.world.getComponent(id, 'item');
    let changed = false;

    if (meta && patch.name !== undefined && meta.name !== patch.name) {
      meta.name = patch.name;
      changed = true;
    }
    if (item && patch.name !== undefined && item.name !== patch.name) {
      item.name = patch.name;
      changed = true;
    }
    if (meta && patch.destructible !== undefined && meta.destructible !== patch.destructible) {
      meta.destructible = patch.destructible;
      changed = true;
    }
    return changed;
  }

  public updateEntityPhysics(
    id: string,
    patch: { radius?: number; weight?: number; isSolid?: boolean }
  ): boolean {
    const physStats = this.world.getComponent(id, 'physicsStats');
    if (!physStats) return false;
    let changed = false;

    if (patch.radius !== undefined && physStats.radius.base !== patch.radius) {
      setBaseStat(physStats.radius, patch.radius);
      // Если это зона — синхронизируем радиус эффектора
      const effector = this.world.getComponent(id, 'areaEffector');
      if (effector && effector.radius !== patch.radius) {
        effector.radius = patch.radius;
      }
      changed = true;
    }
    if (patch.weight !== undefined && physStats.weight.base !== patch.weight) {
      setBaseStat(physStats.weight, patch.weight);
      changed = true;
    }
    if (patch.isSolid !== undefined && physStats.isSolid !== patch.isSolid) {
      physStats.isSolid = patch.isSolid;
      changed = true;
    }
    return changed;
  }

  public updateEntityHealth(id: string, patch: { hp?: number; maxHp?: number }): boolean {
    const health = this.world.getComponent(id, 'health');
    if (!health) return false;
    let changed = false;

    if (patch.maxHp !== undefined && health.max.base !== patch.maxHp) {
      setBaseStat(health.max, Math.max(1, patch.maxHp));
      changed = true;
    }
    if (patch.hp !== undefined && health.current !== patch.hp) {
      health.current = Math.min(health.max.current, Math.max(0, patch.hp));
      if (health.current > 0) {
        health.isAlive = true;
      }
      changed = true;
    }
    return changed;
  }

  public updateEntityFunctionalHealth(id: string, patch: { fp?: number; maxFp?: number }): boolean {
    const fp = this.world.getComponent(id, 'functionalHealth');
    if (!fp) return false;
    let changed = false;

    if (patch.maxFp !== undefined && fp.max.base !== patch.maxFp) {
      setBaseStat(fp.max, Math.max(1, patch.maxFp));
      changed = true;
    }
    if (patch.fp !== undefined && fp.current !== patch.fp) {
      fp.current = Math.min(fp.max.current, Math.max(-2 * fp.max.current, patch.fp));
      fp.isFunctional = fp.current >= 0;
      changed = true;
    }
    return changed;
  }

  public updateEntitySocketLinkStrength(id: string, socketId: string, strength: number): boolean {
    const socketLink = this.world.getComponent(id, 'socketLink');
    const link = socketLink?.links[socketId];
    if (!link) return false;
    link.currentStrength = strength;

    const targetLink = this.world.getComponent(link.targetEntityId, 'socketLink')?.links[
      link.targetSocketId
    ];
    if (targetLink) {
      targetLink.currentStrength = strength;
    }
    return true;
  }

  public updateEntityMovementStats(id: string, patch: any): boolean {
    const ms = this.world.getComponent(id, 'movementStats');
    if (!ms) return false;
    let changed = false;

    if (patch.maxSpeed !== undefined && ms.maxSpeed.base !== patch.maxSpeed) {
      setBaseStat(ms.maxSpeed, patch.maxSpeed);
      changed = true;
    }
    if (patch.maxTurnSpeed !== undefined) {
      const draftTurn = deg2Rad(patch.maxTurnSpeed);
      if (ms.maxTurnSpeed.base !== draftTurn) {
        setBaseStat(ms.maxTurnSpeed, draftTurn);
        changed = true;
      }
    }
    const multipliers = [
      'runSpeedMultiplier',
      'crouchSpeedMultiplier',
      'proneSpeedMultiplier',
      'walkSpeedMultiplier',
      'runTurnMultiplier',
      'crouchTurnMultiplier',
      'proneTurnMultiplier',
      'walkTurnMultiplier',
      'turnInPlaceTurnMultiplier',
      'strafeSpeedMultiplier',
      'backwardSpeedMultiplier',
      'strafeTurnMultiplier',
      'backwardTurnMultiplier',
      'pickupSpeedMultiplier',
      'pickupTurnMultiplier',
    ] as const;

    for (const m of multipliers) {
      if (patch[m] !== undefined && (ms as any)[m] !== patch[m]) {
        (ms as any)[m] = patch[m];
        changed = true;
      }
    }

    const transitionTimes = [
      'standToCrouchTime',
      'crouchToStandTime',
      'standToProneTime',
      'proneToStandTime',
      'crouchToProneTime',
      'proneToCrouchTime',
      'dropPrepTime',
      'dropRecoveryTime',
    ] as const;

    for (const t of transitionTimes) {
      if (patch[t] !== undefined && (ms as any)[t]?.base !== patch[t]) {
        setBaseStat((ms as any)[t], patch[t]);
        changed = true;
      }
    }
    return changed;
  }

  public updateEntityStealthStats(id: string, patch: any): boolean {
    const st = this.world.getComponent(id, 'stealthStats');
    if (!st) return false;
    let changed = false;

    if (patch.stealthPower !== undefined && st.stealthPower.base !== patch.stealthPower) {
      setBaseStat(st.stealthPower, patch.stealthPower);
      changed = true;
    }
    const multipliers = [
      'crouchStealthMultiplier',
      'proneStealthMultiplier',
      'runStealthMultiplier',
      'walkStealthMultiplier',
      'turnInPlaceStealthMultiplier',
      'immobileStealthMultiplier',
    ] as const;

    for (const m of multipliers) {
      if (patch[m] !== undefined && (st as any)[m] !== patch[m]) {
        (st as any)[m] = patch[m];
        changed = true;
      }
    }
    return changed;
  }

  public updateEntityAIBehavior(id: string, behavior: string): boolean {
    const aiStats = this.world.getComponent(id, 'aiStats');
    if (!aiStats || aiStats.behavior.current === behavior) return false;
    aiStats.behavior.current = behavior;
    aiStats.behavior.base = behavior;
    return true;
  }

  public updateEntityAreaEffector(id: string, patch: any): boolean {
    const effector = this.world.getComponent(id, 'areaEffector');
    const physStats = this.world.getComponent(id, 'physicsStats');
    if (!effector) return false;

    Object.assign(effector, patch);
    if (patch.radius !== undefined) {
      if (physStats && physStats.radius.base !== patch.radius) {
        setBaseStat(physStats.radius, patch.radius);
      }
    }
    return true;
  }

  public updateEntityWeapon(id: string, patch: any): boolean {
    const item = this.world.getComponent(id, 'item');
    const wStats = this.world.getComponent(id, 'weaponStats');
    const wZone = this.world.getComponent(id, 'weaponZone');
    let changed = false;

    if (item && item.type === 'weapon') {
      if (patch.size !== undefined && item.size !== patch.size) {
        item.size = patch.size;
        changed = true;
      }
      if (
        patch.equipTypes !== undefined &&
        JSON.stringify(item.equipTypes) !== JSON.stringify(patch.equipTypes)
      ) {
        item.equipTypes = [...patch.equipTypes];
        changed = true;
      }
      if (patch.equippable !== undefined && item.equippable !== patch.equippable) {
        item.equippable = patch.equippable;
        changed = true;
      }
      if (
        patch.equipTimeMultiplier !== undefined &&
        item.equipTimeMultiplier !== patch.equipTimeMultiplier
      ) {
        item.equipTimeMultiplier = patch.equipTimeMultiplier;
        changed = true;
      }
    }

    if (wStats) {
      if (patch.baseDamage !== undefined && wStats.baseDamage.base !== patch.baseDamage) {
        setBaseStat(wStats.baseDamage, patch.baseDamage);
        changed = true;
      }
      if (patch.prepTime !== undefined && wStats.prepTime.base !== patch.prepTime) {
        setBaseStat(wStats.prepTime, patch.prepTime);
        changed = true;
      }
      if (patch.recoveryTime !== undefined && wStats.recoveryTime.base !== patch.recoveryTime) {
        setBaseStat(wStats.recoveryTime, patch.recoveryTime);
        changed = true;
      }
    }

    if (wZone) {
      if (patch.hitZoneType !== undefined) wZone.hitZoneType = patch.hitZoneType;
      if (patch.radius !== undefined) wZone.radius = patch.radius;
      if (patch.length !== undefined) wZone.length = patch.length;
      if (patch.angle !== undefined) wZone.angle = deg2Rad(patch.angle);
      if (patch.rayCount !== undefined) wZone.rayCount = patch.rayCount;
      if (patch.pierceObstacles !== undefined) wZone.pierceObstacles = patch.pierceObstacles;
      if (patch.pierceCreatures !== undefined) wZone.pierceCreatures = patch.pierceCreatures;
      if (patch.pierceItems !== undefined) wZone.pierceItems = patch.pierceItems;
      changed = true;
    }
    return changed;
  }

  public updateEntityArmor(id: string, patch: any): boolean {
    const item = this.world.getComponent(id, 'item');
    const aStats = this.world.getComponent(id, 'armorStats');
    const meta = this.world.getComponent(id, 'meta');
    let changed = false;

    if (item && item.type === 'armor') {
      if (patch.size !== undefined && item.size !== patch.size) {
        item.size = patch.size;
        changed = true;
      }
      if (
        patch.equipTypes !== undefined &&
        JSON.stringify(item.equipTypes) !== JSON.stringify(patch.equipTypes)
      ) {
        item.equipTypes = [...patch.equipTypes];
        changed = true;
      }
      if (patch.equippable !== undefined && item.equippable !== patch.equippable) {
        item.equippable = patch.equippable;
        changed = true;
      }
      if (
        patch.equipTimeMultiplier !== undefined &&
        item.equipTimeMultiplier !== patch.equipTimeMultiplier
      ) {
        item.equipTimeMultiplier = patch.equipTimeMultiplier;
        changed = true;
      }
    }

    if (aStats) {
      if (patch.defense !== undefined && aStats.defense.base !== patch.defense) {
        setBaseStat(aStats.defense, patch.defense);
        changed = true;
      }
      if (patch.flatReduction !== undefined && aStats.flatReduction.base !== patch.flatReduction) {
        setBaseStat(aStats.flatReduction, patch.flatReduction);
        changed = true;
      }
    } else if (meta?.entityType === 'creature') {
      let selfArmor = this.world.getComponent(id, 'armorStats');
      if (!selfArmor) {
        this.world.addComponent(id, 'armorStats', {
          defense: { base: 0, current: 0 },
          flatReduction: { base: 0, current: 0 },
        });
        selfArmor = this.world.getComponent(id, 'armorStats');
      }
      if (selfArmor) {
        if (patch.defense !== undefined && selfArmor.defense.base !== patch.defense) {
          setBaseStat(selfArmor.defense, patch.defense);
          changed = true;
        }
        if (
          patch.flatReduction !== undefined &&
          selfArmor.flatReduction.base !== patch.flatReduction
        ) {
          setBaseStat(selfArmor.flatReduction, patch.flatReduction);
          changed = true;
        }
      }
    }
    return changed;
  }

  public updateEntityGenericItem(id: string, patch: any): boolean {
    const item = this.world.getComponent(id, 'item');
    if (!item) return false;
    let changed = false;

    if (patch.size !== undefined && item.size !== patch.size) {
      item.size = patch.size;
      changed = true;
    }
    if (
      patch.equipTypes !== undefined &&
      JSON.stringify(item.equipTypes) !== JSON.stringify(patch.equipTypes)
    ) {
      item.equipTypes = [...patch.equipTypes];
      changed = true;
    }
    if (patch.equippable !== undefined && item.equippable !== patch.equippable) {
      item.equippable = patch.equippable;
      changed = true;
    }
    if (
      patch.equipTimeMultiplier !== undefined &&
      item.equipTimeMultiplier !== patch.equipTimeMultiplier
    ) {
      item.equipTimeMultiplier = patch.equipTimeMultiplier;
      changed = true;
    }
    return changed;
  }

  public updateEntityHeart(id: string, patch: { requiresBrain?: boolean }): boolean {
    const heart = this.world.getComponent(id, 'heart');
    if (!heart) return false;
    let changed = false;
    if (patch.requiresBrain !== undefined && heart.requiresBrain !== patch.requiresBrain) {
      heart.requiresBrain = patch.requiresBrain;
      changed = true;
    }
    return changed;
  }

  public updateEntityVision(
    id: string,
    patch: { fovAngle?: number; clarity?: number; maxDistance?: number }
  ): boolean {
    const vision = this.world.getComponent(id, 'vision');
    if (!vision) return false;
    let changed = false;
    if (patch.fovAngle !== undefined && vision.fovAngle.base !== patch.fovAngle) {
      setBaseStat(vision.fovAngle, patch.fovAngle);
      changed = true;
    }
    if (patch.clarity !== undefined && vision.clarity.base !== patch.clarity) {
      setBaseStat(vision.clarity, patch.clarity);
      changed = true;
    }
    if (patch.maxDistance !== undefined && vision.maxDistance.base !== patch.maxDistance) {
      setBaseStat(vision.maxDistance, patch.maxDistance);
      changed = true;
    }
    return changed;
  }

  public updateEntityHearing(
    id: string,
    patch: { sensitivity?: number; maxDistance?: number }
  ): boolean {
    const hearing = this.world.getComponent(id, 'hearing');
    if (!hearing) return false;
    let changed = false;
    if (patch.sensitivity !== undefined && hearing.sensitivity.base !== patch.sensitivity) {
      setBaseStat(hearing.sensitivity, patch.sensitivity);
      changed = true;
    }
    if (patch.maxDistance !== undefined && hearing.maxDistance.base !== patch.maxDistance) {
      setBaseStat(hearing.maxDistance, patch.maxDistance);
      changed = true;
    }
    return changed;
  }

  public updateEntityBag(id: string, patch: any, isBagEmpty: boolean): boolean {
    const item = this.world.getComponent(id, 'item');
    const inv = this.world.getComponent(id, 'inventory');
    let changed = false;

    if (item) {
      if (patch.size !== undefined && item.size !== patch.size) {
        item.size = patch.size;
        changed = true;
      }
      if (
        patch.equipTypes !== undefined &&
        JSON.stringify(item.equipTypes) !== JSON.stringify(patch.equipTypes)
      ) {
        item.equipTypes = [...patch.equipTypes];
        changed = true;
      }
      if (patch.equippable !== undefined && item.equippable !== patch.equippable) {
        item.equippable = patch.equippable;
        changed = true;
      }
      if (
        patch.equipTimeMultiplier !== undefined &&
        item.equipTimeMultiplier !== patch.equipTimeMultiplier
      ) {
        item.equipTimeMultiplier = patch.equipTimeMultiplier;
        changed = true;
      }
    }

    if (inv && isBagEmpty && patch.width && patch.height) {
      if (inv.size.width !== patch.width || inv.size.height !== patch.height) {
        inv.size = { width: patch.width, height: patch.height };
        inv.slots = Array.from({ length: patch.height }, () =>
          Array.from({ length: patch.width }, () => ({ itemId: null, count: 0 }))
        );
        changed = true;
      }
    }
    return changed;
  }

  public updateEntityInteractionSlot(
    partOrCreatureId: string,
    patch: { name?: string; interactDist?: number; strength?: number; slotKind?: string }
  ): boolean {
    const slot = this.world.getComponent(partOrCreatureId, 'interactionSlots');
    if (!slot) return false;
    let changed = false;
    if (patch.name !== undefined && slot.name !== patch.name) {
      slot.name = patch.name;
      changed = true;
    }
    if (patch.interactDist !== undefined && slot.interactDist !== patch.interactDist) {
      slot.interactDist = patch.interactDist;
      changed = true;
    }
    if (patch.strength !== undefined && slot.strength !== patch.strength) {
      slot.strength = patch.strength;
      changed = true;
    }
    if (patch.slotKind !== undefined && slot.slotKind !== patch.slotKind) {
      slot.slotKind = patch.slotKind;
      changed = true;
    }
    return changed;
  }

  public updateEquipmentArea(
    containerId: string,
    areaId: string,
    patch: { name?: string; space?: number; type?: string }
  ): boolean {
    const equip = this.world.getComponent(containerId, 'equip');
    const area = equip?.equipmentAreas.find((a) => a.id === areaId);
    if (!area) return false;
    let changed = false;
    if (patch.name !== undefined && area.name !== patch.name) {
      area.name = patch.name;
      changed = true;
    }
    if (patch.space !== undefined && area.space !== patch.space) {
      area.space = patch.space;
      changed = true;
    }
    if (patch.type !== undefined && area.type !== patch.type) {
      area.type = patch.type;
      changed = true;
    }
    return changed;
  }

  public addEquipmentArea(
    containerId: string,
    defaultType: string = 'new_equip_type',
    defaultName: string = 'Новая область',
    space?: number
  ): string {
    let targetEquip = this.world.getComponent(containerId, 'equip');
    if (!targetEquip) {
      targetEquip = { equipmentAreas: [] };
      this.world.addComponent(containerId, 'equip', targetEquip);
    }
    const partSize = space ?? this.world.getComponent(containerId, 'physicsStats')?.size ?? 10;
    const areaId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    targetEquip.equipmentAreas.push({
      id: areaId,
      name: defaultName,
      type: defaultType,
      space: partSize,
      itemIds: [],
    });
    return areaId;
  }

  public removeEquipmentArea(containerId: string, areaId: string): boolean {
    const equip = this.world.getComponent(containerId, 'equip');
    if (!equip) return false;
    const idx = equip.equipmentAreas.findIndex((a) => a.id === areaId);
    if (idx === -1) return false;
    if (equip.equipmentAreas[idx].itemIds.length > 0) return false;
    equip.equipmentAreas.splice(idx, 1);
    return true;
  }

  public setEntityInventoryGrid(id: string, enable: boolean): boolean {
    if (enable) {
      if (this.world.getComponent(id, 'inventory')) return false;
      this.world.addComponent(id, 'inventory', {
        size: { width: 4, height: 2 },
        slots: Array.from({ length: 2 }, () =>
          Array.from({ length: 4 }, () => ({ itemId: null, count: 0 }))
        ),
      });
      return true;
    } else {
      const inv = this.world.getComponent(id, 'inventory');
      if (!inv) return false;
      const isEmpty = inv.slots.every((row) => row.every((cell) => !cell.itemId));
      if (!isEmpty) return false;
      this.world.removeComponent(id, 'inventory');
      return true;
    }
  }

  public addEntityInteractionSlot(
    partId: string,
    defaultName: string = 'Новая рука',
    interactDist: number = 1.5,
    strength: number = 15,
    slotKind: string = 'left_hand'
  ): boolean {
    if (this.world.getComponent(partId, 'interactionSlots')) return false;

    const slotId = `slot_${Date.now().toString(36).substring(2, 6)}`;
    this.world.addComponent(partId, 'interactionSlots', {
      id: slotId,
      name: defaultName,
      interactDist,
      strength,
      itemId: null,
      slotKind,
    });
    return true;
  }

  public removeEntityInteractionSlot(partId: string): boolean {
    const slot = this.world.getComponent(partId, 'interactionSlots');
    if (!slot) return false;
    if (slot.itemId !== null) return false;

    this.world.removeComponent(partId, 'interactionSlots');
    return true;
  }
}
