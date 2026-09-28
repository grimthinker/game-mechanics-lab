import { EntityId, EntityComponents } from './types';

interface QueryCacheEntry {
  keys: (keyof EntityComponents)[];
  entities: Array<[EntityId, EntityComponents]>;
  snapshot: Array<[EntityId, any]>;
  isDirty: boolean;
}

/**
 * Быстрое вычисление стабильного строкового ключа запроса
 * без выделения памяти под временные массивы и сортировку для 1, 2 и 3 ключей
 */
function getFastQueryKey(keys: readonly string[]): string {
  const len = keys.length;
  if (len === 1) return keys[0];
  if (len === 2) {
    const a = keys[0];
    const b = keys[1];
    return a < b ? `${a},${b}` : `${b},${a}`;
  }
  if (len === 3) {
    const a = keys[0];
    const b = keys[1];
    const c = keys[2];
    if (a <= b && b <= c) return `${a},${b},${c}`;
    if (a <= c && c <= b) return `${a},${c},${b}`;
    if (b <= a && a <= c) return `${b},${a},${c}`;
    if (b <= c && c <= a) return `${b},${c},${a}`;
    if (c <= a && a <= b) return `${c},${a},${b}`;
    return `${c},${b},${a}`;
  }
  // Фолбэк для редких запросов с 4+ компонентами
  return keys.slice().sort().join(',');
}

export class World {
  private entities: Map<EntityId, EntityComponents> = new Map();
  private queryCache: Map<string, QueryCacheEntry> = new Map();
  private allEntitiesCache: Array<[EntityId, EntityComponents]> | null = null;

  public createEntity(id: EntityId): EntityId {
    this.entities.set(id, {});
    this.allEntitiesCache = null;
    return id;
  }

  public removeEntity(id: EntityId): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    for (const entry of this.queryCache.values()) {
      const idx = entry.entities.findIndex((e) => e[0] === id);
      if (idx !== -1) {
        entry.entities.splice(idx, 1);
        entry.isDirty = true;
      }
    }

    this.allEntitiesCache = null;
    return this.entities.delete(id);
  }

  public addComponent<K extends keyof EntityComponents>(
    id: EntityId,
    key: K,
    component: EntityComponents[K]
  ): void {
    const entity = this.entities.get(id);
    if (!entity) return;

    const isNew = entity[key] === undefined;
    entity[key] = component;

    if (isNew) {
      for (const entry of this.queryCache.values()) {
        if (entry.keys.includes(key)) {
          const satisfies = entry.keys.every((k) => entity[k] !== undefined);
          if (satisfies) {
            entry.entities.push([id, entity]);
            entry.isDirty = true;
          }
        }
      }
    }
  }

  public removeComponent<K extends keyof EntityComponents>(id: EntityId, key: K): void {
    const entity = this.entities.get(id);
    if (!entity || entity[key] === undefined) return;

    delete entity[key];

    for (const entry of this.queryCache.values()) {
      if (entry.keys.includes(key)) {
        const idx = entry.entities.findIndex((e) => e[0] === id);
        if (idx !== -1) {
          entry.entities.splice(idx, 1);
          entry.isDirty = true;
        }
      }
    }
  }

  public getComponent<K extends keyof EntityComponents>(
    id: EntityId,
    key: K
  ): EntityComponents[K] | undefined {
    return this.entities.get(id)?.[key];
  }

  public getEntity(id: EntityId): EntityComponents | undefined {
    return this.entities.get(id);
  }

  public hasEntity(id: EntityId): boolean {
    return this.entities.has(id);
  }

  public getEntitiesWith<K extends keyof EntityComponents>(
    ...keys: K[]
  ): Array<[EntityId, Required<Pick<EntityComponents, K>> & EntityComponents]> {
    const queryKey = getFastQueryKey(keys as unknown as string[]);

    let entry = this.queryCache.get(queryKey);
    if (!entry) {
      const entitiesArr: Array<[EntityId, EntityComponents]> = [];
      for (const [id, components] of this.entities.entries()) {
        const hasAll = keys.every((k) => components[k] !== undefined);
        if (hasAll) {
          entitiesArr.push([id, components]);
        }
      }
      entry = {
        keys: keys.slice(),
        entities: entitiesArr,
        snapshot: entitiesArr.slice(),
        isDirty: false,
      };
      this.queryCache.set(queryKey, entry);
    } else if (entry.isDirty) {
      // Обновляем снимок только если состав архетипа изменился
      entry.snapshot = entry.entities.slice();
      entry.isDirty = false;
    }

    return entry.snapshot as Array<
      [EntityId, Required<Pick<EntityComponents, K>> & EntityComponents]
    >;
  }

  public getAllEntities(): Array<[EntityId, EntityComponents]> {
    if (!this.allEntitiesCache) {
      this.allEntitiesCache = Array.from(this.entities.entries());
    }
    return this.allEntitiesCache;
  }

  public clear(): void {
    this.entities.clear();
    this.queryCache.clear();
    this.allEntitiesCache = null;
  }
}
