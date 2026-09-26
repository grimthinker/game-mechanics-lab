import { EntityId } from './base';

export type FetchStickState = 'held_by_master' | 'thrown' | 'held_by_dog' | 'delivered';

export interface FetchStickComponent {
  state: FetchStickState;
  ownerMasterId: EntityId;
  lastCarrierDogId: EntityId | null;
}
