import { World } from '../World';
import {
  EntityId,
  InventoryComponent,
  EquipmentComponent,
  InteractionSlotsComponent,
  InteractionActionComponent,
  InteractionPhase,
} from '../types';
import { findActiveBrain } from '../utils/anatomy';

export class InventoryAdapter {
  constructor(
    public readonly id: EntityId,
    private world: World
  ) {}

  private getComponent<K extends keyof import('../types').EntityComponents>(key: K) {
    return this.world.getComponent(this.id, key);
  }

  public get inventory(): InventoryComponent | undefined {
    return this.getComponent('inventory');
  }

  public get equip(): EquipmentComponent | undefined {
    return this.getComponent('equip');
  }

  public get interactionSlots(): InteractionSlotsComponent | undefined {
    return this.getComponent('interactionSlots');
  }

  public get interactionAction(): InteractionActionComponent | undefined {
    return this.getComponent('interactionAction');
  }

  public get isInteracting(): boolean {
    return this.interactionAction !== undefined;
  }

  public get interactionPhase(): InteractionPhase | null {
    return this.interactionAction?.phase ?? null;
  }

  public pickup(targetItemId: EntityId): boolean {
    const health = this.getComponent('health');
    if (!health || !health.isAlive) return false;

    if (this.getComponent('interactionAction')) return false;
    if (this.getComponent('pickupIntent')) return false;

    const targetOwnership = this.world.getComponent(targetItemId, 'ownership');
    const targetItem = this.world.getComponent(targetItemId, 'item');
    if (!targetItem || targetOwnership) return false;

    this.world.addComponent(this.id, 'pickupIntent', { targetItemId });
    return true;
  }

  public cancelInteraction(): void {
    const action = this.getComponent('interactionAction');
    if (action) {
      action.wantsCancel = true;
    }
  }
}
