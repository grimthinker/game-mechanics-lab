import { EntityId, EntityComponents } from './types';
export class World {
  private entities: Map<EntityId, EntityComponents> = new Map();
  private queryCache: Map<string, Array<[EntityId, EntityComponents]>> = new Map();

  public createEntity(id: EntityId): EntityId {
    this.entities.set(id, {});
    return id;
  }

  public removeEntity(id: EntityId): boolean {
    const entity = this.entities.get(id);
    if (!entity) return false;

    for (const cachedArray of this.queryCache.values()) {
      const idx = cachedArray.findIndex((e) => e[0] === id);
      if (idx !== -1) {
        cachedArray.splice(idx, 1);
      }
    }

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
      for (const [queryKey, cachedArray] of this.queryCache.entries()) {
        const queryKeys = queryKey.split(',');
        if (queryKeys.includes(key as string)) {
          const satisfies = queryKeys.every(
            (k) => entity[k as keyof EntityComponents] !== undefined
          );
          if (satisfies) {
            cachedArray.push([id, entity]);
          }
        }
      }
    }
  }

  public removeComponent<K extends keyof EntityComponents>(id: EntityId, key: K): void {
    const entity = this.entities.get(id);
    if (!entity || entity[key] === undefined) return;

    delete entity[key];

    for (const [queryKey, cachedArray] of this.queryCache.entries()) {
      const queryKeys = queryKey.split(',');
      if (queryKeys.includes(key as string)) {
        const idx = cachedArray.findIndex((e) => e[0] === id);
        if (idx !== -1) {
          cachedArray.splice(idx, 1);
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
    const queryKey = keys.slice().sort().join(',');

    let cachedArray = this.queryCache.get(queryKey);
    if (!cachedArray) {
      cachedArray = [];
      for (const [id, components] of this.entities.entries()) {
        const hasAll = keys.every((k) => components[k] !== undefined);
        if (hasAll) {
          cachedArray.push([id, components]);
        }
      }
      this.queryCache.set(queryKey, cachedArray);
    }

    // Возвращаем поверхностную копию, чтобы избежать багов с пропуском элементов
    // при удалении сущностей или компонентов внутри итерации по этому массиву в системах.
    return cachedArray.slice() as Array<
      [EntityId, Required<Pick<EntityComponents, K>> & EntityComponents]
    >;
  }

  public getAllEntities(): Array<[EntityId, EntityComponents]> {
    return Array.from(this.entities.entries());
  }

  public clear(): void {
    this.entities.clear();
    this.queryCache.clear();
  }
}
