
import { CBaseStats, ConfigType, ModifierOp, IStatsModifier } from "./core";
import { get_value_by_path, set_value_by_path } from "./utils";


export enum CommandType {
    APPLY_STATS_MODIFIER,
    REMOVE_STATS_MODIFIER,
    UPDATE_BASE_STATS
}


/**
 * Для хранения в runtime и управления значениями каких-либо параметров 
 */
export function createStatsSystem() {
    
    function recalculate(component: CBaseStats<any>) {
        component.resetToBase();

        const allEffects = component.modifiers.flatMap(m => m.effects);

        const flatEffects = allEffects.filter(e => e.op === ModifierOp.FLAT);
        const percentEffects = allEffects.filter(e => e.op === ModifierOp.PERCENT);

        for (const eff of flatEffects) {
            const currentVal = get_value_by_path(component.current, eff.path) || 0;
            set_value_by_path(component.current, eff.path, currentVal + eff.value);
        }

        for (const eff of percentEffects) {
            const baseVal = get_value_by_path(component.base, eff.path) || 0;
            const currentVal = get_value_by_path(component.current, eff.path) || 0;
            set_value_by_path(component.current, eff.path, currentVal + (baseVal * eff.value));
        }
    }

    function update(dt: number) {
        // Здесь какой-либо способ получить commands
        
        for (const cmd of commands) {

            if (cmd.id === CommandType.APPLY_STATS_MODIFIER || cmd.id === CommandType.REMOVE_STATS_MODIFIER || cmd.id === CommandType.UPDATE_BASE_STATS) {
                const { id } = cmd.data;
                
                // Здесь какой-либо способ получить stats

                if (cmd.id === CommandType.APPLY_STATS_MODIFIER) {
                    const modifier = cmd.data.modifier as IStatsModifier;
                    if (stats) stats.addModifier(modifier);
                } 
                if (cmd.id === CommandType.REMOVE_STATS_MODIFIER) {
                    const modId = cmd.data.modifier_id;
                    if (stats) stats.removeModifier(modId);
                }
                // if (cmd.id === CommandType.UPDATE_BASE_STATS) {
                //     const { config } = cmd.data; 
                //     if (stats) stats.updateBase(config);
                // }
                if (stats) recalculate(stats);
               
            }
        }
    }

    return { update };
}