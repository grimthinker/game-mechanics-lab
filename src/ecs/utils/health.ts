import { World } from '../World';
import { EntityId } from '../types';
import { DeathService } from '../services/DeathService';

/**
 * Переводит сущность в состояние смерти через DeathService.
 */
export function killEntity(world: World, id: EntityId): void {
  DeathService.kill(world, id);
}

/**
 * Наносит урон сущности. Если урон летальный — сразу вызывает killEntity.
 */
export function applyDamage(
  world: World,
  id: EntityId,
  amount: number,
  triggerFlash: boolean = true
): void {
  const health = world.getComponent(id, 'health');
  if (!health || !health.isAlive) return;

  const tag = world.getComponent(id, 'tag');

  // Согласно п. 10 ТЗ: существа и части тела являются неразрушаемыми объектами
  if (tag?.archetype === 'creature' || tag?.archetype === 'bodyPart') {
    return;
  }

  const meta = world.getComponent(id, 'meta');
  if (tag?.archetype === 'obstacle' && meta?.destructible === false) {
    return;
  }

  const nextHp = Math.max(0, health.current - amount);
  health.current = Math.round(nextHp * 100) / 100;

  if (triggerFlash) {
    health.hitFlashTimer = 0.2;
  }
  health.healthBarTimer = 1.0;

  if (health.current <= 0) {
    killEntity(world, id);
  }
}

/**
 * Восстанавливает здоровье живой сущности до предела максимального HP.
 */
import { applyAnatomyHeal } from './anatomyHeal';

export function applyHeal(
  world: World,
  id: EntityId,
  amount: number,
  triggerFlash: boolean = true
): void {
  applyAnatomyHeal(world, id, amount, triggerFlash);
}
