export enum ModifierOp {
    FLAT = 'flat',
    PERCENT = 'percent' // 0.1 = +10%
}

export enum ConfigType {
    WEAPON = 'weapon',
    BEHAVIOR = 'behavior',
    ENTITY = 'entity'
}

export interface IStatEffect {
    path: string;       // Например: "damage_base" или "attacks.0.time.attack_duration"
    value: number;
    op: ModifierOp;
}

export interface IStatsModifier {
    id: string;         // Уникальный ID экземпляра модификатора
    target: ConfigType;   // Тип конфигов, к которому этот модификатор можно применить
    effects: IStatEffect[];
}

export type UnknownConfig = Record<string, any>;

export interface ConfigsMapping {
    [key: string]: UnknownConfig;
}

export abstract class CBaseStats<T extends string = string, TConfig extends UnknownConfig = UnknownConfig> {
    public readonly base: TConfig;
    public current: TConfig;
    public modifiers: IStatsModifier[] = [];

    constructor(
        public readonly type: T, 
        protected config: TConfig
    ) {
        this.base = JSON.parse(JSON.stringify(config));
        this.current = JSON.parse(JSON.stringify(config));
    }

    public resetToBase(): void {
        this.current = JSON.parse(JSON.stringify(this.base));
    }

    public addModifier(mod: IStatsModifier) {
        this.modifiers.push(mod);
    }

    public removeModifier(modId: string) {
        this.modifiers = this.modifiers.filter(m => m.id !== modId);
    }

    public isType<K extends string>(t: K): this is CBaseStats<K, any> {
        return (this.type as string) === t;
    }
}

export class CWeaponStats extends CBaseStats<ConfigType.WEAPON, UnknownConfig> {
    constructor(config: UnknownConfig) {
        super(ConfigType.WEAPON, config);
    }
}

export class CEntityStats extends CBaseStats<ConfigType.ENTITY, UnknownConfig> {
    constructor(config: UnknownConfig) {
        super(ConfigType.ENTITY, config);
    }
}

export class CBehaviorStats extends CBaseStats<ConfigType.BEHAVIOR, UnknownConfig> {
    constructor(config: UnknownConfig) {
        super(ConfigType.BEHAVIOR, config);
    }
}
// export const StatsMapping: { [K in keyof ConfigsMapping]: new (config: ConfigsMapping[K]) => CBaseStats<K> } = {
//     [ConfigType.BEHAVIOR]: CBehaviorStats,
//     [ConfigType.ENTITY]: CEntityStats,
//     [ConfigType.WEAPON]: CWeaponStats,
// };

export type StatsComponent = {
    weapon?: CWeaponStats,
    entity?: CEntityStats,
    behavior?: CBehaviorStats,
}

export interface StatsLogicUtils {
    get_all_stats: () => StatsComponent[],
    get_entity_stats: (id: number) => StatsComponent | undefined,
}


