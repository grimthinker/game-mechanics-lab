import { Circle } from 'detect-collisions';
import { World } from './World';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { AISystem } from './systems/AISystem';
import {
  EntityId,
  CreatureConfig,
  ItemData,
  InventoryConfig,
  StandardRadius,
} from './types';
import { Point } from '../types';

export interface CreatureBlueprint {
  kind: 'creature';
  config: CreatureConfig;
}

export interface ItemBlueprint {
  kind: 'item';
  itemData: ItemData;
  isSolid?: boolean;
  radius?: StandardRadius;
}

export interface DoorBlueprint {
  kind: 'door';
  name?: string;
  isOpen?: boolean;
  isLocked?: boolean;
  radius?: StandardRadius;
  weight?: number;
}

export interface TrapBlueprint {
  kind: 'trap';
  name?: string;
  damage?: number;
  radius?: StandardRadius;
}

export type EntityBlueprint =
  | CreatureBlueprint
  | ItemBlueprint
  | DoorBlueprint
  | TrapBlueprint;

export interface WorldSpawnOptions {
  angle?: number;
  isSolid?: boolean;
  radius?: StandardRadius;
  weight?: number;
}

export class EntityFactory {
  public createEntityFromBlueprint(
    world: World,
    aiSystem: AISystem,
    blueprint: EntityBlueprint,
    forcedId?: string
  ): EntityId {
    switch (blueprint.kind) {
      case 'creature':
        return this.createLogicalCreature(world, aiSystem, blueprint.config, forcedId);
      case 'item':
        return this.createLogicalItem(world, blueprint.itemData, forcedId);
      case 'door':
      case 'trap':
        throw new Error(`Blueprint kind ${blueprint.kind} is not implemented yet.`);
    }
  }

  private createLogicalCreature(
    world: World,
    aiSystem: AISystem,
    config: CreatureConfig,
    forcedId?: string
  ): EntityId {
    const prefix = 'bot';
    const id = forcedId || `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
    const radius = config.radius || 16;

    world.createEntity(id);

    // Шаг 1: навешивание базовых компонентов данных
    world.addComponent(id, 'health', { isAlive: true, hitFlashTimer: 0 });
    world.addComponent(id, 'stealth', { isCrouching: false });
    world.addComponent(id, 'stats', {
      hp: { base: config.maxHp ?? 100, current: config.hp ?? 100 },
      maxHp: { base: config.maxHp ?? 100, current: config.maxHp ?? 100 },
      radius: { base: radius, current: radius },
      maxSpeed: { base: Math.max(0, config.maxSpeed), current: Math.max(0, config.maxSpeed) },
      maxTurnSpeed: {
        base: (Math.max(0, config.maxTurnSpeed) * Math.PI) / 180,
        current: (Math.max(0, config.maxTurnSpeed) * Math.PI) / 180,
      },
      stealth: { base: config.stealth ?? 0, current: config.stealth ?? 0 },
      runSpeedMultiplier: {
        base: Math.max(0.1, config.runSpeedMultiplier ?? 1.5),
        current: Math.max(0.1, config.runSpeedMultiplier ?? 1.5),
      },
      crouchSpeedMultiplier: {
        base: Math.max(0.1, config.crouchSpeedMultiplier ?? 0.5),
        current: Math.max(0.1, config.crouchSpeedMultiplier ?? 0.5),
      },
      crouchStealthMultiplier: {
        base: Math.max(1, config.crouchStealthMultiplier ?? 1.5),
        current: Math.max(1, config.crouchStealthMultiplier ?? 1.5),
      },
      interactionRange: { base: 100, current: 100 },
      runTurnMultiplier: { base: config.runTurnMultiplier ?? 0.8, current: config.runTurnMultiplier ?? 0.8 },
      crouchTurnMultiplier: { base: config.crouchTurnMultiplier ?? 1.2, current: config.crouchTurnMultiplier ?? 1.2 },
    });

    world.addComponent(id, 'equip', {
        slots: [
          { type: 'armor', itemId: null },
          { type: 'bag', itemId: null },
          { type: 'weapon', itemId: null },
        ],
      });
      world.addComponent(id, 'activeAttacks', { attacks: [] });
      world.addComponent(id, 'meta', {
        id,
        behavior: config.behavior,
        state: 'idle',
        config: JSON.parse(JSON.stringify(config)),
      });
  
      aiSystem.initBotBrain(world, id, config.behavior);
  
      return id;
    }

  private createLogicalItem(
    world: World,
    itemData: ItemData,
    forcedId?: string
  ): EntityId {
    const id = forcedId || itemData.id;
    world.createEntity(id);
    world.addComponent(id, 'item', itemData);

    if (itemData.type === 'bag' && itemData.config) {
      const bagCfg = itemData.config as InventoryConfig;
      const width = bagCfg.size?.width ?? 6;
      const height = bagCfg.size?.height ?? 4;
      const emptySlots = Array.from({ length: height }, () =>
        Array.from({ length: width }, () => ({ itemId: null, count: 0 }))
      );
      world.addComponent(id, 'inventory', {
        size: { width, height },
        slots: emptySlots,
      });
    }

    return id;
  }

  public spawnEntityInWorld(
    world: World,
    physics: PhysicsSystem,
    id: EntityId,
    position: Point,
    options?: WorldSpawnOptions
  ): void {
    const angle = options?.angle ?? 0;
    world.addComponent(id, 'transform', { x: position.x, y: position.y, angle });

    const meta = world.getComponent(id, 'meta');
    const item = world.getComponent(id, 'item');

    if (meta) {
      // Существо: добавляем физическое тело, скорость и ввод
      const stats = world.getComponent(id, 'stats');
      const radius = options?.radius ?? stats?.radius.current ?? meta.config.radius ?? 16;
      const weight = options?.weight ?? Math.max(0.1, meta.config.weight);

      const body = new Circle({ x: position.x, y: position.y }, radius);
      body.isStatic = false;

      world.addComponent(id, 'physicsBody', { body, radius, weight, isStatic: false });
      world.addComponent(id, 'velocity', { currentSpeed: 0, currentTurnSpeed: 0 });
      world.addComponent(id, 'input', {
        isMovingForward: false,
        turnDirection: 0,
        isRunning: false,
        isCrouching: false,
        wantsAttack: false,
        turnSpeed: 0,
      });

      physics.registerBody(id, body);
    } else if (item) {
      // Предмет: добавляем физическое тело при необходимости
      const isSolid = options?.isSolid ?? item.config?.isSolid ?? true;
      const radius = options?.radius ?? item.config?.radius ?? 16;
      const weight = options?.weight ?? item.config?.weight ?? 1;

      if (isSolid) {
        const body = new Circle({ x: position.x, y: position.y }, radius);
        body.isStatic = false;
        world.addComponent(id, 'physicsBody', { body, radius, weight, isStatic: false });
        physics.registerBody(id, body);
      }
    }
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