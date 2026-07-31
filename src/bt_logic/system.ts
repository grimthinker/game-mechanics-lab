import { EntityContext, AIEventType, EntityUtils } from "./core";


export function createBTAISystem(utils: EntityUtils) {


    function update_context(ctx: EntityContext, data: {dt: number}) {
        ctx.dt = data.dt;
    }

    function process_events(ctx: EntityContext) {
        const queue = ctx.brain?.event_queue;
        const bb = ctx.brain?.blackboard;
        if (!queue || !bb) return;
        
        while (queue.length > 0) {
            const event = queue.shift()!;

            switch (event.type) {
                case AIEventType.SET_TARGET:
                    bb.set('target_id', event.payload.target_id);
                    bb.set('is_engaged', false); // Сбрасываем гистерезис при смене цели
                    break;
                case AIEventType.SET_PATROL_POINTS:
                    bb.set('patrol_points', event.payload.points);
                    bb.set('current_patrol_index', 0); // Сбрасываем индекс на начало
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
            update_context(ctx, {dt});
            process_events(ctx);
            ctx.brain?.root_node.tick(ctx);
            // log('update', ctx.id)
        }
    }

    return { update };
}

