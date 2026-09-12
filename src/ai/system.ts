import { AIEventType, EntityUtils } from './core';
import type { EntityAdapter } from '../EntityAdapter';

export function createBTAISystem(utils: EntityUtils) {
  function updateContext(ctx: EntityAdapter, data: { dt: number }) {
    ctx.dt = data.dt;
    ctx.utils = utils; // Ensure utils reference is available on context
  }

  function processEvents(ctx: EntityAdapter) {
    const queue = ctx.brain?.event_queue;
    const bb = ctx.brain?.blackboard;
    if (!queue || !bb) return;

    while (queue.length > 0) {
      const event = queue.shift()!;

      switch (event.type) {
        case AIEventType.SET_TARGET:
          bb.set('targetId', event.payload.targetId ?? event.payload.target_id);
          bb.set('isEngaged', false);
          break;
        case AIEventType.SET_PATROL_POINTS:
          bb.set('patrolPoints', event.payload.points);
          bb.set('currentPatrolIndex', 0);
          break;
        case AIEventType.APPLY_EFFECT:
          break;
        case AIEventType.WEAPON_CHANGED:
          break;
      }
    }
  }

  function update(dt: number) {
    const entities = utils.getAllEntities();
    for (const ctx of entities) {
      const ts = ctx.timeScaleMultiplier;
      const localDt = dt * ts;

      const bb = ctx.brain?.blackboard;
      if (bb) {
        const currentLocalTime = (bb.get('localTime') as number) ?? 0;
        bb.set('localTime', currentLocalTime + localDt);
      }

      updateContext(ctx, { dt: localDt });
      processEvents(ctx);
      ctx.brain?.root_node.tick(ctx);
    }
  }

  return { update };
}
