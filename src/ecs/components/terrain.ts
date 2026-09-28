export const FOLIAGE_ZONES_COUNT = 5;

export interface TerrainComponent {
  /** Физический размер террейна в метрах по оси X */
  width: number;
  /** Физический размер террейна в метрах по оси Z */
  depth: number;
  /** Количество вершин по одной стороне сетки геометрии (например, 128 -> 128x128 вершин) */
  resolution: number;
  /** Разрешение текстурной карты смешивания Splatmap (например, 512 -> 512x512 пикселей) */
  splatResolution: number;
  /** Одномерный массив высот вершин (длина resolution * resolution) */
  heights: Float32Array;
  /**
   * Текстурные веса каналов (RGBA: R-трава, G-камень, B-почва, A-песок)
   * Размер splatResolution * splatResolution * 4 байт
   */
  splatData: Uint8Array;
  /**
   * Карта плотности зон растительности (Foliage Density Map).
   * Каналы: 0 - Трава, 1 - Пшеница, 2 - Камыш, 3 - Сухая трава, 4 - Цветы.
   * Размер: splatResolution * splatResolution * 5 байт
   */
  foliageData: Uint8Array;
  /** Масштаб тайлинга детальных текстур */
  textureTiling: number;
  /** Счетчик версий высот для независимого отслеживания изменений системами */
  geometryVersion?: number;
  /** Счетчик версий текстурной маски (Splatmap) для независимого отслеживания изменений системами */
  splatVersion?: number;
  /** Счетчик версий карты плотности растительности */
  foliageVersion?: number;
  /** Флаг необходимости перестроения вертексов Three.js геометрии */
  isGeometryDirty?: boolean;
  /** Флаг необходимости обновления текстуры Splatmap */
  isSplatDirty?: boolean;
  /** Флаг необходимости пересчета инстансов растительности */
  isFoliageDirty?: boolean;
  /** Флаг необходимости пересчета физического коллайдера Rapier3D */
  isPhysicsDirty?: boolean;
}

/**
 * Билинейная интерполяция высоты террейна в произвольной точке мира (worldX, worldZ).
 * Позволяет со 100% точностью определить уровень земли под персонажем за доли наносекунды.
 */
export function getTerrainHeightAt(
  terrain: TerrainComponent,
  worldX: number,
  worldZ: number
): number | null {
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;
  if (worldX < -halfW || worldX > halfW || worldZ < -halfD || worldZ > halfD) {
    return null;
  }

  const res = terrain.resolution;
  const stepX = terrain.width / (res - 1);
  const stepZ = terrain.depth / (res - 1);

  const u = (worldX + halfW) / stepX;
  const v = (worldZ + halfD) / stepZ;

  const x0 = Math.floor(u);
  const z0 = Math.floor(v);
  const x1 = Math.min(res - 1, x0 + 1);
  const z1 = Math.min(res - 1, z0 + 1);

  const fx = u - x0;
  const fz = v - z0;

  const h00 = terrain.heights[z0 * res + x0] ?? 0;
  const h10 = terrain.heights[z0 * res + x1] ?? 0;
  const h01 = terrain.heights[z1 * res + x0] ?? 0;
  const h11 = terrain.heights[z1 * res + x1] ?? 0;

  const hTop = h00 * (1 - fx) + h10 * fx;
  const hBottom = h01 * (1 - fx) + h11 * fx;

  return hTop * (1 - fz) + hBottom * fz;
}

/**
 * Вычисляет точный вектор нормали поверхности террейна в точке (worldX, worldZ) методом конечных разностей.
 */
export function getTerrainNormalAt(
  terrain: TerrainComponent,
  worldX: number,
  worldZ: number
): { x: number; y: number; z: number } {
  const halfW = terrain.width / 2;
  const halfD = terrain.depth / 2;
  if (worldX < -halfW || worldX > halfW || worldZ < -halfD || worldZ > halfD) {
    return { x: 0, y: 1, z: 0 };
  }

  const step = Math.max(0.1, terrain.width / (terrain.resolution - 1));
  const hL = getTerrainHeightAt(terrain, worldX - step, worldZ) ?? 0;
  const hR = getTerrainHeightAt(terrain, worldX + step, worldZ) ?? 0;
  const hD = getTerrainHeightAt(terrain, worldX, worldZ - step) ?? 0;
  const hU = getTerrainHeightAt(terrain, worldX, worldZ + step) ?? 0;

  const dx = (hR - hL) / (2 * step);
  const dz = (hU - hD) / (2 * step);

  const len = Math.hypot(-dx, 1.0, -dz) || 1.0;
  return {
    x: -dx / len,
    y: 1.0 / len,
    z: -dz / len,
  };
}
