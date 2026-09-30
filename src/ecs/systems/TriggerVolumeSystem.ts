import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';
import { getZoneCenter } from '../components/zone';
import { EventBus } from '../../core/EventBus';
import { CollisionCategory } from '../types';

export class TriggerVolumeSystem {
  public update(_dt: number, world: World, physics: PhysicsSystem): void {
    if (!physics.driver || !physics.driver.isReady) return;

    const zones = world.getEntitiesWith('gameplayZone', 'transform');

    for (const [zoneId, { gameplayZone, transform }] of zones) {
      const shape = world.getComponent(zoneId, 'zoneShape');
      if (!shape) continue;

      const center = getZoneCenter(transform, shape);
      const hitEntityIds = physics.driver.queryEntitiesInZoneShape(
        shape.shapeType,
        center,
        shape,
        transform.rotation
      );

      const currentOccupants = new Set<string>();

      for (const entId of hitEntityIds) {
        if (entId === zoneId) continue;

        const health = world.getComponent(entId, 'health');
        if (health && !health.isAlive) continue;

        const body = world.getComponent(entId, 'physicsBody');
        if (body && (body.category & (CollisionCategory.CREATURE | CollisionCategory.ITEM)) !== 0) {
          currentOccupants.add(entId);
        }
      }

      const prevOccupants = new Set(gameplayZone.occupantIds);

      for (const entId of currentOccupants) {
        if (!prevOccupants.has(entId)) {
          EventBus.emit('zone:entered', { zoneId, entityId: entId });
        }
      }

      for (const entId of prevOccupants) {
        if (!currentOccupants.has(entId)) {
          EventBus.emit('zone:exited', { zoneId, entityId: entId });
        }
      }

      gameplayZone.occupantIds = Array.from(currentOccupants);
    }
  }
}
