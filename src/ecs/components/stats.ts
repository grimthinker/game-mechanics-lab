export const enum ModifierType {
  FLAT = 'flat',
  PERCENT_ADD = 'percent_add',
  PERCENT_MULT = 'percent_mult',
}

export interface StatModifier {
  id: string;
  type: ModifierType;
  value: number;
  duration?: number;
}

export interface StatValue<T = number> {
  base: T;
  current: T;
  modifiers?: StatModifier[];
}

export interface TimeScaleComponent {
  multiplier: StatValue<number>;
}
