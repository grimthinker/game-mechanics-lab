import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import { EntityId, EntityConfig } from '../types';
import { Point, Vec3 } from '../../types';
import { TerrainComponent } from '../components/terrain';

export function createDefaultTerrainConfig(
  size: number = 100,
  resolution: number = 128,
  splatResolution: number = 512
): EntityConfig {
  const totalVerts = resolution * resolution;
  const heights = new Float32Array(totalVerts);

  // 1. Инициализация высот геометрической сетки (128x128)
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = z * resolution + x;
      const u = x / (resolution - 1);
      const v = z / (resolution - 1);

      const dx = u - 0.5;
      const dz = v - 0.5;
      const distFromCenter = Math.hypot(dx, dz) * 2;

      let h = 0;
      if (distFromCenter > 0.35) {
        const edgeFactor = (distFromCenter - 0.35) / 0.65;
        h = Math.sin(u * Math.PI * 4) * Math.cos(v * Math.PI * 4) * 2.5 * edgeFactor;
        h += Math.sin(u * 15) * 0.4 * edgeFactor;
      }
      heights[idx] = h;
    }
  }

  // 2. Инициализация текстурной маски высокой плотности (512x512 = пиксель ~19 см)
  const totalSplatTexels = splatResolution * splatResolution;
  const splatData = new Uint8Array(totalSplatTexels * 4);

  for (let z = 0; z < splatResolution; z++) {
    for (let x = 0; x < splatResolution; x++) {
      const idx = z * splatResolution + x;
      const u = x / (splatResolution - 1);
      const v = z / (splatResolution - 1);

      const dx = u - 0.5;
      const dz = v - 0.5;
      const distFromCenter = Math.hypot(dx, dz) * 2;

      let h = 0;
      if (distFromCenter > 0.35) {
        const edgeFactor = (distFromCenter - 0.35) / 0.65;
        h = Math.sin(u * Math.PI * 4) * Math.cos(v * Math.PI * 4) * 2.5 * edgeFactor;
        h += Math.sin(u * 15) * 0.4 * edgeFactor;
      }

      const splatIdx = idx * 4;

      // Плавный интерполированный градиент от центральной поляны (почва) к окраинам (трава)
      const centerFactor = Math.max(0, Math.min(1, (0.35 - distFromCenter) / 0.15));
      const rockFactor = Math.max(0, Math.min(1, (h - 1.0) / 0.8));

      const r = Math.round(
        230 * (1 - centerFactor) * (1 - rockFactor) + 60 * centerFactor + 30 * rockFactor
      );
      const g = Math.round(
        20 * (1 - centerFactor) * (1 - rockFactor) + 40 * centerFactor + 220 * rockFactor
      );
      const b = Math.round(
        30 * (1 - centerFactor) * (1 - rockFactor) + 180 * centerFactor + 20 * rockFactor
      );

      splatData[splatIdx + 0] = Math.max(0, Math.min(255, r));
      splatData[splatIdx + 1] = Math.max(0, Math.min(255, g));
      splatData[splatIdx + 2] = Math.max(0, Math.min(255, b));
      splatData[splatIdx + 3] = 0;
    }
  }

  const terrainComp: TerrainComponent = {
    size,
    resolution,
    splatResolution,
    heights,
    splatData,
    textureTiling: 24,
    geometryVersion: 1,
    splatVersion: 1,
    isGeometryDirty: true,
    isSplatDirty: true,
    isPhysicsDirty: true,
  };

  return {
    tag: { archetype: 'terrain' },
    meta: { name: 'Ландшафт мира', entityType: 'terrain' },
    terrain: terrainComp,
    renderable: {
      zIndex: 0,
      isVisible: true,
      syncWithTransform: false,
    },
  };
}

export function assembleTerrain(
  world: World,
  _physics: PhysicsSystem,
  _aiSystem: AISystem,
  id: EntityId,
  config: EntityConfig,
  _position?: Vec3
): void {
  world.addComponent(id, 'tag', { archetype: 'terrain' });
  world.addComponent(id, 'meta', { name: config.meta?.name || 'Террейн', entityType: 'terrain' });

  world.addComponent(id, 'transform', {
    x: 0,
    y: 0,
    z: 0,
    rotation: { x: 0, y: 0, z: 0, w: 1 },
    angle: 0,
  });

  if (config.terrain) {
    world.addComponent(id, 'terrain', config.terrain);
  }

  world.addComponent(id, 'renderable', {
    zIndex: 0,
    isVisible: true,
    syncWithTransform: false,
  });
}
