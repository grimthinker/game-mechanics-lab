import { GameSimulation } from '../../core/GameSimulation';
import { Vec3, Radians } from '../../types';
import { createDefaultTerrainConfig } from '../archetypes/TerrainArchetype';
import { createDefaultEnvironmentConfig } from '../archetypes/EnvironmentArchetype';
import { getTerrainHeightAt } from '../components/terrain';

export function initDefaultWorldPrefab(simulation: GameSimulation, center?: Vec3): void {
  const { x: bx, y: by, z: bz } = center ?? { x: 0, y: 0, z: 0 };

  // 1. Спавн процедурного террейна и окружения
  simulation.spawnEntity(createDefaultTerrainConfig(100, 100), { x: 0, y: 0, z: 0 }, 'terrain');
  simulation.spawnEntity(createDefaultEnvironmentConfig(), { x: 0, y: 0, z: 0 }, 'environment');

  const terrainComp = simulation.world.getComponent('terrain', 'terrain');
  const getHeight = (x: number, z: number): number => {
    if (!terrainComp) return by;
    return getTerrainHeightAt(terrainComp, x, z) ?? by;
  };

  // 6. Игрок
  const playerX = bx - 11.5;
  const playerZ = bz + 0.5;
  const playerY = getHeight(playerX, playerZ);
  simulation.playerEntityId = simulation.entityFactory.spawnModularHumanoid(
    simulation.world,
    simulation.physics,
    simulation.aiSystem,
    { x: playerX, y: playerY, z: playerZ },
    'PlayerTree',
    'Игрок'
  );

  simulation.syncPhysicsStructures();
}
