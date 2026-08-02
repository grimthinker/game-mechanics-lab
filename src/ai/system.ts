import { AIEventType, EntityUtils } from './core';
import type { EntityAdapter } from '../EntityAdapter';

export function createBTAISystem(utils: EntityUtils) {
  function update_context(ctx: EntityAdapter, data: { dt: number }) {
    ctx.dt = data.dt;
    ctx.utils = utils; // Ensure utils reference is available on context
  }

  function process_events(ctx: EntityAdapter) {
    const queue = ctx.brain?.event_queue;
    const bb = ctx.brain?.blackboard;
    if (!queue || !bb) return;

    while (queue.length > 0) {
      const event = queue.shift()!;

      switch (event.type) {
        case AIEventType.SET_TARGET:
          bb.set('target_id', event.payload.target_id);
          bb.set('is_engaged', false);
          break;
        case AIEventType.SET_PATROL_POINTS:
          bb.set('patrol_points', event.payload.points);
          bb.set('current_patrol_index', 0);
          break;
        case AIEventType.APPLY_EFFECT:
          break;
        case AIEventType.WEAPON_CHANGED:
          break;
      }
    }
  }

  function update(dt: number) {
    const entities = utils.get_all_entities();
    for (const ctx of entities) {
      update_context(ctx, { dt });
      process_events(ctx);
      ctx.brain?.root_node.tick(ctx);
    }
  }

  return { update };
}