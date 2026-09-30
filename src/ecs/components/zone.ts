import { Vec3, Quat } from '../../types';
import { TransformComponent } from './physics';
import { TerrainComponent, getTerrainHeightAt } from './terrain';

export type ZoneShapeType = 'sphere' | 'cylinder' | 'box';

export interface ZoneShapeComponent {
  shapeType: ZoneShapeType;
  radius: number;
  height: number;
  width: number;
  depth: number;
}

export type GameplayZoneRole = 'generic' | 'quest' | 'ai_area' | 'throw_target';

export interface GameplayZoneComponent {
  role: GameplayZoneRole;
  zoneTag?: string;
  occupantIds: string[];
}

export function getZoneCenter(transform: TransformComponent, shape: ZoneShapeComponent): Vec3 {
  if (shape.shapeType === 'sphere') {
    return {
      x: transform.x,
      y: transform.y + shape.radius,
      z: transform.z,
    };
  }
  return {
    x: transform.x,
    y: transform.y + shape.height / 2,
    z: transform.z,
  };
}

export function getRandomPointInZone(
  transform: TransformComponent,
  shape: ZoneShapeComponent,
  terrain?: TerrainComponent
): Vec3 {
  const center = getZoneCenter(transform, shape);
  let localX = 0;
  let localY = 0;
  let localZ = 0;

  if (shape.shapeType === 'sphere') {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = Math.cbrt(Math.random()) * shape.radius;
    const sinPhi = Math.sin(phi);

    localX = r * sinPhi * Math.cos(theta);
    localY = r * Math.cos(phi);
    localZ = r * sinPhi * Math.sin(theta);
  } else if (shape.shapeType === 'cylinder') {
    const angle = Math.random() * 2.0 * Math.PI;
    const r = Math.sqrt(Math.random()) * shape.radius;
    localX = r * Math.cos(angle);
    localZ = r * Math.sin(angle);
    localY = (Math.random() - 0.5) * shape.height;
  } else {
    localX = (Math.random() - 0.5) * shape.width;
    localY = (Math.random() - 0.5) * shape.height;
    localZ = (Math.random() - 0.5) * shape.depth;
  }

  // Применяем вращение по горизонтали (yaw)
  const angle = transform.angle ?? 0;
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  const worldX = center.x + (localX * cosA - localZ * sinA);
  const worldZ = center.z + (localX * sinA + localZ * cosA);
  let worldY = center.y + localY;

  if (terrain) {
    const terrainY = getTerrainHeightAt(terrain, worldX, worldZ);
    if (terrainY !== null) {
      worldY = Math.max(worldY, terrainY);
    }
  }

  return { x: worldX, y: worldY, z: worldZ };
}
