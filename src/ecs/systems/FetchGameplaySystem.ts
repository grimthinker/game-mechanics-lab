import { World } from '../World';

export class FetchGameplaySystem {
  public update(_dt: number, world: World): void {
    const stickEntities = world.getEntitiesWith('fetchStick');

    for (const [id, { fetchStick }] of stickEntities) {
      const ownership = world.getComponent(id, 'ownership');
      const thrownObject = world.getComponent(id, 'thrownObject');

      if (ownership) {
        // Предмет удерживается кем-то в руках или пасти
        if (ownership.ownerId === fetchStick.ownerMasterId) {
          fetchStick.state = 'held_by_master';
        } else {
          fetchStick.state = 'held_by_dog';
          fetchStick.lastCarrierDogId = ownership.ownerId;
        }
      } else {
        // Предмет находится на земле или летит в воздухе
        if (thrownObject?.isAirborne) {
          fetchStick.state = 'thrown';
        } else if (fetchStick.state === 'held_by_dog') {
          // Собака выпустила/сбросила предмет на землю
          fetchStick.state = 'delivered';
        }
      }
    }
  }
}
