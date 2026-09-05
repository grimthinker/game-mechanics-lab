import { Circle } from 'detect-collisions';
import { World } from './World';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { AISystem } from './systems/AISystem';
import {
    EntityId,
    EntityConfig,
    CollisionCategory,
    COLLISION_MASK_ALL,
    COLLISION_MASK_NONE,
} from './types';
import { Point } from '../types';

export class EntityFactory {
  public spawnEntity(
    world: World,
    physics: PhysicsSystem,
    aiSystem: AISystem,
    config: EntityConfig,
    position?: Point,
    forcedId?: string
  ): EntityId {
    const id = forcedId || config.meta?.id || config.item?.id || `ent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    world.createEntity(id);

    if (config.physics) {
      world.addComponent(id, 'physicsStats', {
        radius: { base: config.physics.radius, current: config.physics.radius },
        weight: { base: config.physics.weight, current: config.physics.weight },
        isSolid: { base: config.physics.isSolid ?? true, current: config.physics.isSolid ?? true },
      });
    }

    if (config.health) {
      const maxHp = config.health.maxHp;
      const hp = config.health.hp ?? maxHp;
      world.addComponent(id, 'health', { isAlive: hp > 0, hitFlashTimer: 0 });
      world.addComponent(id, 'healthStats', {
        hp: { base: hp, current: hp },
        maxHp: { base: maxHp, current: maxHp },
      });
    }

    if (config.movement) {
      world.addComponent(id, 'movementStats', {
        maxSpeed: { base: config.movement.maxSpeed, current: config.movement.maxSpeed },
        maxTurnSpeed: { base: (config.movement.maxTurnSpeed * Math.PI) / 180, current: (config.movement.maxTurnSpeed * Math.PI) / 180 },
        runSpeedMultiplier: { base: config.movement.runSpeedMultiplier ?? 1.5, current: config.movement.runSpeedMultiplier ?? 1.5 },
        crouchSpeedMultiplier: { base: config.movement.crouchSpeedMultiplier ?? 0.5, current: config.movement.crouchSpeedMultiplier ?? 0.5 },
        runTurnMultiplier: { base: config.movement.runTurnMultiplier ?? 0.8, current: config.movement.runTurnMultiplier ?? 0.8 },
        crouchTurnMultiplier: { base: config.movement.crouchTurnMultiplier ?? 1.2, current: config.movement.crouchTurnMultiplier ?? 1.2 },
      });
      world.addComponent(id, 'velocity', { currentSpeed: 0, currentTurnSpeed: 0 });
      world.addComponent(id, 'input', {
        isMovingForward: false,
        turnDirection: 0,
        turnSpeed: 0,
        isRunning: false,
        isCrouching: false,
        wantsAttack: false,
        attackSlotIndex: undefined,
      });
    }

    if (config.stealth) {
      world.addComponent(id, 'stealthStats', {
        stealthPower: { base: config.stealth.stealthPower, current: config.stealth.stealthPower },
        runStealthMultiplier: { base: config.stealth.runStealthMultiplier, current: config.stealth.runStealthMultiplier },
        crouchStealthMultiplier: { base: config.stealth.crouchStealthMultiplier ?? 1.5, current: config.stealth.crouchStealthMultiplier ?? 1.5 },
      });
    }

    if (config.ai) {
      world.addComponent(id, 'aiStats', {
        behavior: { base: config.ai.behavior, current: config.ai.behavior },
      });
      aiSystem.initBotBrain(world, id, config.ai.behavior);
    }

    if (config.item) {
        world.addComponent(id, 'item', config.item);
  
        if (config.item.type === 'weapon') {
          const wcfg = config.item.config as any;
          const ws = config.weaponStats;
          world.addComponent(id, 'weaponStats', {
            baseDamage: { base: ws?.baseDamage ?? wcfg.baseDamage ?? 20, current: ws?.baseDamage ?? wcfg.baseDamage ?? 20 },
            prepTime: { base: ws?.prepTime ?? wcfg.prepTime ?? 0.2, current: ws?.prepTime ?? wcfg.prepTime ?? 0.2 },
            castTime: { base: ws?.castTime ?? wcfg.castTime ?? 0, current: ws?.castTime ?? wcfg.castTime ?? 0 },
            recoveryTime: { base: ws?.recoveryTime ?? wcfg.recoveryTime ?? 0.3, current: ws?.recoveryTime ?? wcfg.recoveryTime ?? 0.3 },
            prepTurnSlow: { base: ws?.prepTurnSlow ?? wcfg.prepTurnSlow ?? 0.5, current: ws?.prepTurnSlow ?? wcfg.prepTurnSlow ?? 0.5 },
            recoveryTurnSlow: { base: ws?.recoveryTurnSlow ?? wcfg.recoveryTurnSlow ?? 0.8, current: ws?.recoveryTurnSlow ?? wcfg.recoveryTurnSlow ?? 0.8 },
            prepMoveSlow: { base: ws?.prepMoveSlow ?? wcfg.prepMoveSlow ?? 0.5, current: ws?.prepMoveSlow ?? wcfg.prepMoveSlow ?? 0.5 },
            recoveryMoveSlow: { base: ws?.recoveryMoveSlow ?? wcfg.recoveryMoveSlow ?? 0.8, current: ws?.recoveryMoveSlow ?? wcfg.recoveryMoveSlow ?? 0.8 },
            castMoveSlow: { base: ws?.castMoveSlow ?? wcfg.castMoveSlow ?? 0.5, current: ws?.castMoveSlow ?? wcfg.castMoveSlow ?? 0.5 },
            minMultiplier: { base: ws?.minMultiplier ?? wcfg.minMultiplier ?? 0.8, current: ws?.minMultiplier ?? wcfg.minMultiplier ?? 0.8 },
            maxMultiplier: { base: ws?.maxMultiplier ?? wcfg.maxMultiplier ?? 1.2, current: ws?.maxMultiplier ?? wcfg.maxMultiplier ?? 1.2 },
            critChance: { base: ws?.critChance ?? wcfg.critChance ?? 0.1, current: ws?.critChance ?? wcfg.critChance ?? 0.1 },
            critMultiplier: { base: ws?.critMultiplier ?? wcfg.critMultiplier ?? 2.0, current: ws?.critMultiplier ?? wcfg.critMultiplier ?? 2.0 },
          });
  
          const zone = config.weaponZone ?? wcfg.zone;
          if (zone) {
            world.addComponent(id, 'weaponZone', JSON.parse(JSON.stringify(zone)));
          }
        }
  
        if (config.item.type === 'armor') {
          const acfg = config.item.config as any;
          const as = config.armorStats;
          world.addComponent(id, 'armorStats', {
            defense: { base: as?.defense ?? acfg.defense ?? 0, current: as?.defense ?? acfg.defense ?? 0 },
            flatReduction: { base: as?.flatReduction ?? acfg.flat_reduction ?? 0, current: as?.flatReduction ?? acfg.flat_reduction ?? 0 },
          });
        }
      }
  
      if (config.inventory) {
        const w = config.inventory.size.width;
        const h = config.inventory.size.height;
        const slots = config.inventory.slots ?? Array.from({ length: h }, () =>
          Array.from({ length: w }, () => ({ itemId: null, count: 0 }))
        );
        world.addComponent(id, 'inventory', {
          size: { width: w, height: h },
          slots,
        });
    }

    if (config.equip) {
      world.addComponent(id, 'equip', { slots: config.equip });
      world.addComponent(id, 'activeAttacks', { attacks: [] });
    }

    if (config.meta) {
        world.addComponent(id, 'meta', {
          id: config.meta.id || id,
          name: config.meta.name || config.meta.id || id,
          state: 'idle',
        });
      }

    if (position) {
      world.addComponent(id, 'transform', { x: position.x, y: position.y, angle: 0 });
      
      if (config.physics) {
        const body = new Circle({ x: position.x, y: position.y }, config.physics.radius);
        body.isStatic = false;
        const category = config.item ? CollisionCategory.ITEM : CollisionCategory.CREATURE;
        const mask = config.physics.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
        (body as any).category = category;
        (body as any).mask = mask;
        world.addComponent(id, 'physicsBody', { body, isStatic: false, category, mask });
        physics.registerBody(id, body);
      }
    }

    return id;
  }
}