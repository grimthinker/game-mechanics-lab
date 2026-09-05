import { World } from './ecs/World';
import {
  EntityId,
  ItemData,
  ItemType,
  StandardRadius,
  InventoryComponent,
  OwnershipComponent,
} from './ecs/types';
import { Point } from './types';

export class ItemAdapter {
  constructor(
    public readonly id: EntityId,
    private world: World
  ) {}

  public get data(): ItemData {
    return this.world.getComponent(this.id, 'item')!;
  }

  public set data(value: ItemData) {
    this.world.addComponent(this.id, 'item', value);
  }

  public get name(): string {
    return this.data?.name ?? '';
  }

  public get type(): ItemType {
    return this.data?.type ?? 'other';
  }

  public get config(): any {
    return this.data?.config;
  }

  public get isInWorld(): boolean {
    return this.world.getComponent(this.id, 'transform') !== undefined;
  }

  public get pos(): Point | null {
    const transform = this.world.getComponent(this.id, 'transform');
    return transform ? { x: transform.x, y: transform.y } : null;
  }

  public get angle(): number {
    return this.world.getComponent(this.id, 'transform')?.angle ?? 0;
  }

  public get isSolid(): boolean {
    const phys = this.world.getComponent(this.id, 'physicsBody');
    if (phys) {
      return phys.mask !== 0;
    }
    return this.data?.config?.isSolid ?? true;
  }

  public get radius(): StandardRadius {
    return (
      (this.world.getComponent(this.id, 'physicsBody')?.body.r as StandardRadius) ??
      this.data?.config?.radius ??
      16
    );
  }

  public get weight(): number {
    return (
      this.data?.config?.weight ??
      1
    );
  }

  public get inventory(): InventoryComponent | undefined {
    return this.world.getComponent(this.id, 'inventory');
  }

  public get ownership(): OwnershipComponent | undefined {
    return this.world.getComponent(this.id, 'ownership');
  }
}