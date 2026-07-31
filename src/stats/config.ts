
import { IStatsModifier, ConfigType, ModifierOp } from "./core";

enum TEST_EFFECTS_ID {
    RAGE
}

/** Для тестов системы, потом конфиги эффектов будем парсить из google таблиц */
const TEST_EFFECTS: Record<TEST_EFFECTS_ID, IStatsModifier> = {
    [TEST_EFFECTS_ID.RAGE]: {
        id: "rage_buff_001",
        target: ConfigType.WEAPON,
        effects: [
            // Оружие: +10 к базовому урону
            {
                path: "damage_base",
                op: ModifierOp.FLAT,
                value: 10
            },
            // Оружие: +20% урона
            {
                path: "damage_base",
                op: ModifierOp.PERCENT,
                value: 0.2
            },
        ]
    }
}