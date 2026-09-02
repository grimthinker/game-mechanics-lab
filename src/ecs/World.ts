import { EntityId, EntityComponents } from './types';

export class World {
  private entities: Map<EntityId, EntityComponents> = new Map();

  public createEntity(id: EntityId): EntityId {
    this.entities.set(id, {});
    return id;
  }

  public removeEntity(id: EntityId): boolean {
    return this.entities.delete(id);
  }

  public addComponent<K extends keyof EntityComponents>(
    id: EntityId,
    key: K,
    component: EntityComponents[K]
  ): void {
    const entity = this.entities.get(id);
    if (entity) {
      entity[key] = component;
    }
  }

  public removeComponent<K extends keyof EntityComponents>(
    id: EntityId,
    key: K
  ): void {
    const entity = this.entities.get(id);
    if (entity) {
      delete entity[key];
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

  public getEntitiesWith<K extends keyof EntityComponents>(
    ...keys: K[]
  ): Array<[EntityId, Required<Pick<EntityComponents, K>> & EntityComponents]> {
    const result: Array<[EntityId, any]> = [];
    for (const [id, components] of this.entities.entries()) {
      const hasAll = keys.every((k) => components[k] !== undefined);
      if (hasAll) {
        result.push([id, components]);
      }
    }
    return result;
  }

  public getAllEntities(): Array<[EntityId, EntityComponents]> {
    return Array.from(this.entities.entries());
  }

  public clear(): void {
    this.entities.clear();
  }
}