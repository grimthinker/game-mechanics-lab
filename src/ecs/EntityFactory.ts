import { Circle } from 'detect-collisions';
import { World } from './World';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { AISystem } from './systems/AISystem';
import {
    EntityId,
    EntityConfig,
    CreatureConfig,
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
        isMovingForward: false, turnDirection: 0, turnSpeed: 0, isRunning: false, isCrouching: false, wantsAttack: false
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
      const dummyConfig: CreatureConfig = {
        radius: config.physics?.radius ?? 16,
        weight: config.physics?.weight ?? 10,
        isSolid: config.physics?.isSolid ?? true,
        maxHp: config.health?.maxHp ?? 100,
        hp: config.health?.hp ?? config.health?.maxHp ?? 100,
        maxSpeed: config.movement?.maxSpeed ?? 150,
        maxTurnSpeed: config.movement?.maxTurnSpeed ?? 270,
        runSpeedMultiplier: config.movement?.runSpeedMultiplier ?? 1.5,
        crouchSpeedMultiplier: config.movement?.crouchSpeedMultiplier ?? 0.5,
        runTurnMultiplier: config.movement?.runTurnMultiplier ?? 0.8,
        crouchTurnMultiplier: config.movement?.crouchTurnMultiplier ?? 1.2,
        stealthPower: config.stealth?.stealthPower ?? 10,
        runStealthMultiplier: config.stealth?.runStealthMultiplier ?? 0.5,
        crouchStealthMultiplier: config.stealth?.crouchStealthMultiplier ?? 1.5,
        behavior: config.ai?.behavior ?? 'IdleTree',
      };
      world.addComponent(id, 'meta', {
        id: config.meta.id || id,
        name: config.meta.id || id,   // НУЖНО СДЕЛАТЬ ВОЗМОЖНОСТЬ УКАЗЫВАТЬ ИМЯ.
        state: 'idle',
        config: dummyConfig,
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

  public despawnEntityFromWorld(
    world: World,
    physics: PhysicsSystem,
    id: EntityId
  ): void {
    const phys = world.getComponent(id, 'physicsBody');
    if (phys) {
      physics.unregisterBody(phys.body);
      world.removeComponent(id, 'physicsBody');
    }

    world.removeComponent(id, 'transform');
    world.removeComponent(id, 'velocity');
    world.removeComponent(id, 'input');
  }
}