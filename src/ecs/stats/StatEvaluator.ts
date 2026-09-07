import { StatValue, StatModifier, ModifierType } from '../types';

/**
 * Вычисляет эффективное значение характеристики на основе базового значения и активных модификаторов.
 * Формула: (base + sum(flat)) * max(0, 1 + sum(percent_add)) * product(percent_mult)
 */
export function evaluateStat(stat: StatValue<number>): number {
  let flat = 0;
  let percentAdd = 0;
  let percentMult = 1;

  const modifiers = stat.modifiers ?? [];

  for (const mod of modifiers) {
    switch (mod.type) {
      case ModifierType.FLAT:
        flat += mod.value;
        break;
      case ModifierType.PERCENT_ADD:
        percentAdd += mod.value;
        break;
      case ModifierType.PERCENT_MULT:
        percentMult *= mod.value;
        break;
    }
  }

  const raw = (stat.base + flat) * Math.max(0, 1 + percentAdd) * percentMult;
  return Math.max(0, raw);
}

/**
 * Добавляет или обновляет модификатор характеристики и мгновенно пересчитывает current.
 */
export function addModifier(stat: StatValue<number>, mod: StatModifier): void {
  if (!stat.modifiers) {
    stat.modifiers = [];
  }

  const idx = stat.modifiers.findIndex((m) => m.id === mod.id);
  if (idx >= 0) {
    stat.modifiers[idx] = mod;
  } else {
    stat.modifiers.push(mod);
  }

  stat.current = evaluateStat(stat);
}

/**
 * Удаляет модификатор по уникальному ID (детерминированный откат) и пересчитывает current.
 */
export function removeModifier(stat: StatValue<number>, modId: string): void {
  if (!stat.modifiers || stat.modifiers.length === 0) return;

  const prevLen = stat.modifiers.length;
  stat.modifiers = stat.modifiers.filter((m) => m.id !== modId);

  if (stat.modifiers.length !== prevLen) {
    stat.current = evaluateStat(stat);
  }
}

/**
 * Изменяет базовое (опорное) значение характеристики и пересчитывает current с сохранением модификаторов.
 */
export function setBaseStat(stat: StatValue<number>, newBase: number): void {
  stat.base = newBase;
  stat.current = evaluateStat(stat);
}

/**
 * Фабричная функция создания новой характеристики со списком модификаторов.
 */
export function createStat(base: number, modifiers: StatModifier[] = []): StatValue<number> {
  const stat: StatValue<number> = {
    base,
    current: base,
    modifiers: [...modifiers],
  };
  stat.current = evaluateStat(stat);
  return stat;
}
