import { World } from '../World';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { AISystem } from '../systems/AISystem';
import { EntityId, EntityConfig } from '../types';
import { Point, Vec3 } from '../../types';
import { TerrainComponent } from '../components/terrain';
import { TERRAIN_CONFIG } from '../../config/terrainConfig';

// Точки траектории главного тракта (север -> юго-запад)
const ROAD_MAIN_PATH: Array<{ x: number; z: number }> = [
  { x: -10, z: -50 },
  { x: -11, z: -40 },
  { x: -13, z: -30 },
  { x: -16, z: -18 },
  { x: -19, z: -3 },
  { x: -20, z: 8 },
  { x: -21, z: 20 },
  { x: -25, z: 32 },
  { x: -33, z: 42 },
  { x: -45, z: 50 },
];

// Точки траектории подъездной дорожки от тракта во двор к дому
const ROAD_DRIVEWAY_PATH: Array<{ x: number; z: number }> = [
  { x: -19, z: 0 },
  { x: -14, z: 0.5 },
  { x: -9, z: 1.2 },
  { x: -4, z: 1.5 },
  { x: -1, z: 1.5 },
];

function distanceToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq === 0) return Math.hypot(px - ax, pz - az);

  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = ax + t * dx;
  const projZ = az + t * dz;
  return Math.hypot(px - projX, pz - projZ);
}

function distanceToPolyline(
  px: number,
  pz: number,
  polyline: Array<{ x: number; z: number }>
): number {
  let minDist = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const d = distanceToSegment(
      px,
      pz,
      polyline[i].x,
      polyline[i].z,
      polyline[i + 1].x,
      polyline[i + 1].z
    );
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function smoothStep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function createDefaultTerrainConfig(
  requestedWidth: number = 100,
  requestedDepth: number = 100
): EntityConfig {
  // Выравниваем размеры по сетке чанков (кратны 32м) для идеальной геометрии
  const width = Math.max(
    TERRAIN_CONFIG.chunkSize,
    Math.ceil(requestedWidth / TERRAIN_CONFIG.chunkSize) * TERRAIN_CONFIG.chunkSize
  );
  const depth = Math.max(
    TERRAIN_CONFIG.chunkSize,
    Math.ceil(requestedDepth / TERRAIN_CONFIG.chunkSize) * TERRAIN_CONFIG.chunkSize
  );

  // При 1 метре на полигон количество вершин равно размеру в метрах + 1
  const resolution = Math.max(width, depth) + 1;
  // Жестко ограничиваем разрешение 512 пикселями, чтобы избежать переполнения localStorage (QuotaExceededError)
  const splatResolution = Math.min(512, (Math.max(width, depth) / TERRAIN_CONFIG.chunkSize) * 128);

  const totalVerts = resolution * resolution;
  const heights = new Float32Array(totalVerts);
  const halfW = width / 2;
  const halfD = depth / 2;

  // 1. Инициализация высот геометрической сетки
  for (let z = 0; z < resolution; z++) {
    for (let x = 0; x < resolution; x++) {
      const idx = z * resolution + x;
      const wx = (x / (resolution - 1)) * width - halfW;
      const wz = (z / (resolution - 1)) * depth - halfD;

      // А. Западный высокий хребет (ярко-зеленый холм слева):
      // Подъем высоты начинается от x = -16 и достигает 5.2 м к левому краю
      const westRidgeFactor = smoothStep(-15, -38, wx);
      let hWest = westRidgeFactor * 5.2;
      if (westRidgeFactor > 0.05) {
        hWest += (Math.sin(wz * 0.15) * 0.35 + Math.cos(wx * 0.18) * 0.25) * westRidgeFactor;
      }

      // Б. Восточные холмы (справа от двора):
      // Холм на северо-востоке (x > 14, z < -10)
      const distNE = Math.hypot(wx - 26, wz - -28);
      const hillNE = Math.max(0, 1 - distNE / 22) * 3.4;

      // Холм на юго-востоке (x > 16, z > 12)
      const distSE = Math.hypot(wx - 28, wz - 26);
      const hillSE = Math.max(0, 1 - distSE / 24) * 3.8;

      // Понижение котловины для овальной песчаной поляны (x=21, z=-2)
      const clearingDistNorm = Math.hypot((wx - 21) / 9.5, (wz - -2) / 16.0);
      const clearingDepression = Math.max(0, 1 - clearingDistNorm);

      let hEast = (hillNE + hillSE) * (1 - clearingDepression * 0.7);

      // В. Долина дороги и центральный двор дома:
      const dRoadMain = distanceToPolyline(wx, wz, ROAD_MAIN_PATH);
      const dDriveway = distanceToPolyline(wx, wz, ROAD_DRIVEWAY_PATH);
      const dRoad = Math.min(dRoadMain, dDriveway);

      // Дорога проходит на пологой высоте 0.35 м
      const roadValleyFactor = Math.max(0, 1 - dRoad / 6.0);

      // Двор дома (прямоугольник вокруг x=0, z=0)
      const distYard = Math.hypot(Math.max(0, Math.abs(wx) - 7), Math.max(0, Math.abs(wz) - 7));
      const yardFactor = Math.max(0, 1 - distYard / 8);

      let h = Math.max(hWest, hEast);

      // Сглаживаем рельеф в долине дороги и во дворе
      if (roadValleyFactor > 0 || yardFactor > 0) {
        const flattenStrength = Math.max(roadValleyFactor * 0.7, yardFactor * 0.95);
        h = h * (1 - flattenStrength) + 0.45 * flattenStrength;
      }

      heights[idx] = Math.max(0.05, h);
    }
  }

  // 2. Инициализация текстурной маски высокой плотности (512x512, ~19 см на пиксель)
  const totalSplatTexels = splatResolution * splatResolution;
  const splatData = new Uint8Array(totalSplatTexels * 4);

  for (let z = 0; z < splatResolution; z++) {
    for (let x = 0; x < splatResolution; x++) {
      const idx = z * splatResolution + x;
      const splatIdx = idx * 4;

      const wx = (x / (splatResolution - 1)) * width - halfW;
      const wz = (z / (splatResolution - 1)) * depth - halfD;

      // 1. Канал A: Песок (две зоны по референсу)
      // Зона 1: Западный песчаный массив (слева)
      // Граница плавно изгибается вдоль оси Z
      const westSandBorderX = -24.0 + Math.pow(wz * 0.02, 2) * 4.0 - wz * 0.12;
      const westSandDist = westSandBorderX - wx;
      const westSandFactor = smoothStep(-2.0, 3.5, westSandDist);

      // Зона 2: Овальная песчаная поляна на востоке (x=21, z=-2)
      const ovalDist = Math.hypot((wx - 21.0) / 8.5, (wz - -2.0) / 15.0);
      const eastSandFactor = 1.0 - smoothStep(0.85, 1.15, ovalDist);

      const sandFactor = Math.max(0, Math.min(1, Math.max(westSandFactor, eastSandFactor)));

      // 2. Канал G: Каменная дорога и подъезд к дому
      const dRoadMain = distanceToPolyline(wx, wz, ROAD_MAIN_PATH);
      const dDriveway = distanceToPolyline(wx, wz, ROAD_DRIVEWAY_PATH);

      // Главная дорога: ширина 3.6м (полуширина 1.8м)
      const roadMainCore = 1.0 - smoothStep(1.7, 2.3, dRoadMain);
      // Подъезд во двор: ширина 2.4м (полуширина 1.2м)
      const roadDriveCore = 1.0 - smoothStep(1.15, 1.7, dDriveway);

      const roadFactor = Math.max(0, Math.min(1, Math.max(roadMainCore, roadDriveCore)));

      // 3. Канал B: Почва/Грунт (обочины дорог и границы песка)
      const roadShoulder = Math.max(
        1.0 - smoothStep(1.8, 3.2, dRoadMain),
        1.0 - smoothStep(1.3, 2.5, dDriveway)
      );
      const dirtFactor = Math.max(
        0,
        Math.min(
          1,
          (roadShoulder - roadFactor) * 0.85 + (sandFactor > 0.05 && sandFactor < 0.9 ? 0.35 : 0)
        )
      );

      // 4. Канал R: Трава (заполняет всю остальную площадь)
      const grassFactor = Math.max(0, 1.0 - roadFactor - sandFactor - dirtFactor * 0.5);

      // Нормализуем веса к 255
      const sum = grassFactor + roadFactor + dirtFactor + sandFactor || 1.0;
      splatData[splatIdx + 0] = Math.round((grassFactor / sum) * 255); // R: Трава
      splatData[splatIdx + 1] = Math.round((roadFactor / sum) * 255); // G: Дорога (Камень)
      splatData[splatIdx + 2] = Math.round((dirtFactor / sum) * 255); // B: Почва
      splatData[splatIdx + 3] = Math.round((sandFactor / sum) * 255); // A: Песок
    }
  }

  // 3. Инициализация карты плотности зон растительности (5 каналов)
  const foliageData = new Uint8Array(totalSplatTexels * 5);
  for (let z = 0; z < splatResolution; z++) {
    for (let x = 0; x < splatResolution; x++) {
      const idx = z * splatResolution + x;
      const fIdx = idx * 5;
      const sIdx = idx * 4;

      const wx = (x / (splatResolution - 1)) * width - halfW;
      const wz = (z / (splatResolution - 1)) * depth - halfD;

      const grassSplat = splatData[sIdx + 0];
      const sandSplat = splatData[sIdx + 3];

      // Канал 0: Обычная трава (где растет трава, кроме дорог)
      foliageData[fIdx + 0] = grassSplat > 90 ? Math.round(grassSplat * 0.95) : 0;

      // Канал 1: Пшеница (поле к востоку от дома: x: 8..20, z: -18..-4)
      const isWheatField = wx >= 8 && wx <= 20 && wz >= -18 && wz <= -4;
      if (isWheatField) {
        foliageData[fIdx + 1] = 230;
        foliageData[fIdx + 0] = 0; // вытесняет сорняки
      }

      // Канал 2: Камыш (вдоль низины главного тракта)
      const dRoadMain = distanceToPolyline(wx, wz, ROAD_MAIN_PATH);
      if (dRoadMain >= 2.6 && dRoadMain <= 4.2) {
        foliageData[fIdx + 2] = Math.round(smoothStep(4.2, 3.2, dRoadMain) * 210);
      }

      // Канал 3: Сухая трава (на песчаных дюнах и полянах)
      if (sandSplat > 60) {
        foliageData[fIdx + 3] = Math.round((sandSplat / 255) * 180);
      }

      // Канал 4: Цветы (полянки перед домом и на восточной поляне)
      const distYardFlowers = Math.hypot(wx - 2.5, wz - 4.5);
      const distEastMeadow = Math.hypot(wx - 24, wz - 12);
      if (distYardFlowers < 6.0 || distEastMeadow < 8.0) {
        foliageData[fIdx + 4] = 200;
      }
    }
  }

  const terrainComp: TerrainComponent = {
    width,
    depth,
    resolution,
    splatResolution,
    heights,
    splatData,
    foliageData,
    textureTiling: 24 * (Math.max(width, depth) / 100),
    dirtyChunks: new Set<string>(),
    geometryVersion: 1,
    splatVersion: 1,
    foliageVersion: 1,
    isGeometryDirty: true,
    isSplatDirty: true,
    isFoliageDirty: true,
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

export function createFlatTerrainConfig(
  requestedWidth: number = 100,
  requestedDepth: number = 100
): EntityConfig {
  const width = Math.max(
    TERRAIN_CONFIG.chunkSize,
    Math.ceil(requestedWidth / TERRAIN_CONFIG.chunkSize) * TERRAIN_CONFIG.chunkSize
  );
  const depth = Math.max(
    TERRAIN_CONFIG.chunkSize,
    Math.ceil(requestedDepth / TERRAIN_CONFIG.chunkSize) * TERRAIN_CONFIG.chunkSize
  );

  const resolution = Math.max(width, depth) + 1;
  const splatResolution = Math.min(512, (Math.max(width, depth) / TERRAIN_CONFIG.chunkSize) * 128);

  const totalVerts = resolution * resolution;
  const heights = new Float32Array(totalVerts);

  const totalSplatTexels = splatResolution * splatResolution;
  const splatData = new Uint8Array(totalSplatTexels * 4);

  for (let i = 0; i < totalSplatTexels; i++) {
    splatData[i * 4] = 255; // Везде только чистая трава
    splatData[i * 4 + 1] = 0;
    splatData[i * 4 + 2] = 0;
    splatData[i * 4 + 3] = 0;
  }

  const foliageData = new Uint8Array(totalSplatTexels * 5);
  for (let i = 0; i < totalSplatTexels; i++) {
    foliageData[i * 5 + 0] = 210; // Зеленая трава по умолчанию
  }

  return {
    tag: { archetype: 'terrain' },
    meta: { name: 'Плоский ландшафт', entityType: 'terrain' },
    terrain: {
      width,
      depth,
      resolution,
      splatResolution,
      heights,
      splatData,
      foliageData,
      textureTiling: 24 * (Math.max(width, depth) / 100),
      dirtyChunks: new Set<string>(),
      geometryVersion: 1,
      splatVersion: 1,
      foliageVersion: 1,
      isGeometryDirty: true,
      isSplatDirty: true,
      isFoliageDirty: true,
      isPhysicsDirty: true,
    },
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
