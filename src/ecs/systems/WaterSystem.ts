import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';

export class WaterSystem {
  public update(_dt: number, world: World, _physics?: PhysicsSystem): void {
    const waterEntities = world.getEntitiesWith('water', 'transform');
    if (waterEntities.length === 0) return;

    const physicalEntities = world.getEntitiesWith('transform', 'physicsBody');

    for (const [waterId, { water, transform: waterTransform }] of waterEntities) {
      const halfW = water.width / 2;
      const halfD = water.depth / 2;
      const waterSurfaceY = waterTransform.y;
      const waterBottomY = waterSurfaceY - 4.0; // Область действия толщи воды по высоте

      for (const [entityId, { transform, physicsBody }] of physicalEntities) {
        if (entityId === waterId) continue;
        if (physicsBody.isTrigger) continue;

        const dx = Math.abs(transform.x - waterTransform.x);
        const dz = Math.abs(transform.z - waterTransform.z);

        // Проверка нахождения внутри границ водоема (AABB)
        if (dx <= halfW && dz <= halfD) {
          // Проверка погружения по уровню воды
          if (transform.y <= waterSurfaceY + 0.1 && transform.y >= waterBottomY) {
            // Сущность находится в воде!
            // TODO: В следующем этапе здесь будет применяться:
            // 1. Архимедова сила плавучести (buoyancy) на основе water.density.
            // 2. Вязкое сопротивление (viscosity) и замедление движения.
            // 3. Снос по вектору течения (water.flowDirection * water.flowSpeed).
            // 4. Переключение стойки персонажей и мобов в 'swim'.
          }
        }
      }
    }
  }
}
