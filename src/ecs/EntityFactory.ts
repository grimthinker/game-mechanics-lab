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
import { Radians } from '../utils';

export class EntityFactory {
  public spawnEntity(
    world: World,
    physics: PhysicsSystem,
    aiSystem: AISystem,
    config: EntityConfig,
    position?: Point,
    forcedId?: string
  ): EntityId {
    const id = forcedId || `ent_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
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
          maxTurnSpeed: { base: config.movement.maxTurnSpeed, current: config.movement.maxTurnSpeed },
          runSpeedMultiplier: { base: config.movement.runSpeedMultiplier ?? 1.5, current: config.movement.runSpeedMultiplier ?? 1.5 },
        crouchSpeedMultiplier: { base: config.movement.crouchSpeedMultiplier ?? 0.5, current: config.movement.crouchSpeedMultiplier ?? 0.5 },
        runTurnMultiplier: { base: config.movement.runTurnMultiplier ?? 0.8, current: config.movement.runTurnMultiplier ?? 0.8 },
        crouchTurnMultiplier: { base: config.movement.crouchTurnMultiplier ?? 1.2, current: config.movement.crouchTurnMultiplier ?? 1.2 },
      });
      world.addComponent(id, 'velocity', { currentSpeed: 0, currentTurnSpeed: 0 as Radians });
      world.addComponent(id, 'input', {
        isMovingForward: false,
        turnDirection: 0,
        turnSpeed: 0 as Radians,
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
          stats: config.ai.stats,
        });
        aiSystem.initBotBrain(world, id, config.ai.behavior);
      }

      if (config.item) {
        world.addComponent(id, 'item', config.item);
      }
  
      if (config.weaponStats) {
        const ws = config.weaponStats;
        world.addComponent(id, 'weaponStats', {
          baseDamage: { base: ws.baseDamage ?? 20, current: ws.baseDamage ?? 20 },
          prepTime: { base: ws.prepTime ?? 0.2, current: ws.prepTime ?? 0.2 },
          castTime: { base: ws.castTime ?? 0, current: ws.castTime ?? 0 },
          recoveryTime: { base: ws.recoveryTime ?? 0.3, current: ws.recoveryTime ?? 0.3 },
          prepTurnSlow: { base: ws.prepTurnSlow ?? 0.5, current: ws.prepTurnSlow ?? 0.5 },
          recoveryTurnSlow: { base: ws.recoveryTurnSlow ?? 0.8, current: ws.recoveryTurnSlow ?? 0.8 },
          prepMoveSlow: { base: ws.prepMoveSlow ?? 0.5, current: ws.prepMoveSlow ?? 0.5 },
          recoveryMoveSlow: { base: ws.recoveryMoveSlow ?? 0.8, current: ws.recoveryMoveSlow ?? 0.8 },
          castMoveSlow: { base: ws.castMoveSlow ?? 0.5, current: ws.castMoveSlow ?? 0.5 },
          minMultiplier: { base: ws.minMultiplier ?? 0.8, current: ws.minMultiplier ?? 0.8 },
          maxMultiplier: { base: ws.maxMultiplier ?? 1.2, current: ws.maxMultiplier ?? 1.2 },
          critChance: { base: ws.critChance ?? 0.1, current: ws.critChance ?? 0.1 },
          critMultiplier: { base: ws.critMultiplier ?? 2.0, current: ws.critMultiplier ?? 2.0 },
        });
      }
  
      if (config.weaponZone) {
        world.addComponent(id, 'weaponZone', JSON.parse(JSON.stringify(config.weaponZone)));
      }
  
      if (config.armorStats) {
        const as = config.armorStats;
        world.addComponent(id, 'armorStats', {
          defense: { base: as.defense ?? 0, current: as.defense ?? 0 },
          flatReduction: { base: as.flatReduction ?? 0, current: as.flatReduction ?? 0 },
        });
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
          name: config.meta.name || id,
          state: 'idle',
          entityType: config.meta.entityType,
        });
      }

      if (position) {
        world.addComponent(id, 'transform', { x: position.x, y: position.y, angle: 0 as Radians });
        
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