import { TerrainComponent } from '../ecs/components/terrain';
import { TerrainBrushState } from '../types';
import { TERRAIN_CONFIG } from '../config/terrainConfig';

function fastHash(x: number, z: number, seed: number): number {
  let kx = (Math.floor(x) + 1000000) >>> 0;
  let kz = (Math.floor(z) + 1000000) >>> 0;
  let ks = (Math.floor(seed) + 1000000) >>> 0;

  let h = (ks + kx) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = (h + kz) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;

  return h / 4294967296.0;
}

export class TerrainBrushController {
  public static applyBrush(
    terrainComp: TerrainComponent,
    worldX: number,
    worldZ: number,
    state: TerrainBrushState,
    dt: number,
    flattenTarget?: number
  ): number | undefined {
    const { width, depth, resolution, heights, splatData } = terrainComp;
    const radius = state.radius;
    const strength = state.strength;

    if (!terrainComp.dirtyChunks) terrainComp.dirtyChunks = new Set<string>();

    // Добавление затронутых чанков в сет для инкрементального обновления
    const minCX = Math.floor((worldX - radius + width / 2) / 32);
    const maxCX = Math.floor((worldX + radius + width / 2) / 32);
    const minCZ = Math.floor((worldZ - radius + depth / 2) / 32);
    const maxCZ = Math.floor((worldZ + radius + depth / 2) / 32);

    for (let cz = minCZ; cz <= maxCZ; cz++) {
      for (let cx = minCX; cx <= maxCX; cx++) {
        terrainComp.dirtyChunks.add(`${cx}_${cz}`);
      }
    }

    // --- РЕЖИМ: ПОСАДКА И ОЧИСТКА ЗОН РАСТИТЕЛЬНОСТИ (FOLIAGE DENSITY MAP) ---
    if (state.tool === 'foliage' || state.tool === 'clear_foliage') {
      const splatRes = terrainComp.splatResolution || 512;
      const splatCellSizeX = width / (splatRes - 1);
      const splatCellSizeZ = depth / (splatRes - 1);
      const gridX = Math.round((worldX + width / 2) / splatCellSizeX);
      const gridZ = Math.round((worldZ + depth / 2) / splatCellSizeZ);
      const cellRadius = Math.ceil(Math.max(radius / splatCellSizeX, radius / splatCellSizeZ));

      const foliageData = terrainComp.foliageData;
      let modified = false;
      const targetChannel = state.foliageZone;
      const isClear = state.tool === 'clear_foliage';

      for (let z = gridZ - cellRadius; z <= gridZ + cellRadius; z++) {
        for (let x = gridX - cellRadius; x <= gridX + cellRadius; x++) {
          if (x < 0 || x >= splatRes || z < 0 || z >= splatRes) continue;

          const wX = x * splatCellSizeX - width / 2;
          const wZ = z * splatCellSizeZ - depth / 2;
          const dist = Math.hypot(wX - worldX, wZ - worldZ);

          if (dist <= radius) {
            const t = 1 - dist / radius;
            const smoothFalloff = t * t * (3 - 2 * t);
            const delta = strength * smoothFalloff * dt * 255;
            const idx = (z * splatRes + x) * 5 + targetChannel;
            const oldVal = foliageData[idx];

            if (isClear) {
              const newVal = Math.max(0, oldVal - delta);
              if (newVal !== oldVal) {
                foliageData[idx] = Math.round(newVal);
                modified = true;
              }
            } else {
              const newVal = Math.min(255, oldVal + delta);
              if (newVal !== oldVal) {
                foliageData[idx] = Math.round(newVal);
                modified = true;
              }
            }
          }
        }
      }

      if (modified) {
        terrainComp.isFoliageDirty = true;
        terrainComp.foliageVersion = (terrainComp.foliageVersion ?? 0) + 1;
      }
      return undefined;
    }

    // --- РЕЖИМ 1: ПОКРАСКА ТЕКСТУРНОЙ МАСКИ ВЫСОКОЙ ПЛОТНОСТИ (512x512) ---
    if (state.tool === 'paint') {
      const splatRes = terrainComp.splatResolution || 512;
      const splatCellSizeX = width / (splatRes - 1);
      const splatCellSizeZ = depth / (splatRes - 1);
      const gridX = Math.round((worldX + width / 2) / splatCellSizeX);
      const gridZ = Math.round((worldZ + depth / 2) / splatCellSizeZ);
      const cellRadius = Math.ceil(Math.max(radius / splatCellSizeX, radius / splatCellSizeZ));

      let modified = false;

      for (let z = gridZ - cellRadius; z <= gridZ + cellRadius; z++) {
        for (let x = gridX - cellRadius; x <= gridX + cellRadius; x++) {
          if (x < 0 || x >= splatRes || z < 0 || z >= splatRes) continue;

          const wX = x * splatCellSizeX - width / 2;
          const wZ = z * splatCellSizeZ - depth / 2;
          const dist = Math.hypot(wX - worldX, wZ - worldZ);

          if (dist <= radius) {
            // Кубический спад Smoothstep (3t^2 - 2t^3) для идеально круглого и бесшовного пятна кисти
            const t = 1 - dist / radius;
            const smoothFalloff = t * t * (3 - 2 * t);
            const amount = strength * smoothFalloff * dt;
            const idx = z * splatRes + x;
            const sIdx = idx * 4;

            // Расчет целевых пропорций для смешивания (в сумме 1.0)
            let targetRatios = [0, 0, 0, 0];
            if (state.texture === 'custom') {
              const sum = state.customTextureMix.reduce((a, b) => a + b, 0) || 1;
              targetRatios = state.customTextureMix.map((v) => v / sum);
            } else {
              targetRatios[state.texture as number] = 1.0;
            }

            // Чем больше amount, тем ближе цвет пикселя станет к targetRatios
            const paintFactor = Math.min(1.0, amount * 2.0);
            let localModified = false;

            for (let c = 0; c < 4; c++) {
              const current = splatData[sIdx + c];
              const target = targetRatios[c] * 255.0;
              const newVal = Math.round(current + (target - current) * paintFactor);

              if (current !== newVal) {
                splatData[sIdx + c] = newVal;
                localModified = true;
              }
            }

            if (localModified) {
              // Гарантируем, что сумма всегда равна ровно 255 (защита от погрешностей округления)
              let total =
                splatData[sIdx] + splatData[sIdx + 1] + splatData[sIdx + 2] + splatData[sIdx + 3];
              if (total === 0) {
                splatData[sIdx] = 255;
              } else if (total !== 255) {
                const r = 255 / total;
                splatData[sIdx] = Math.round(splatData[sIdx] * r);
                splatData[sIdx + 1] = Math.round(splatData[sIdx + 1] * r);
                splatData[sIdx + 2] = Math.round(splatData[sIdx + 2] * r);
                splatData[sIdx + 3] = Math.round(splatData[sIdx + 3] * r);
              }
              modified = true;
            }
          }
        }
      }

      if (modified) {
        terrainComp.isSplatDirty = true;
        terrainComp.splatVersion = (terrainComp.splatVersion ?? 0) + 1;
      }
      return undefined;
    }

    // --- РЕЖИМ 2: СКУЛЬПТИНГ ГЕОМЕТРИИ ---
    // Так как resolution = width + 1, шаг сетки строго 1 метр
    const cellSizeX = 1.0;
    const cellSizeZ = 1.0;
    const gridX = Math.round((worldX + width / 2) / cellSizeX);
    const gridZ = Math.round((worldZ + depth / 2) / cellSizeZ);
    const cellRadius = Math.ceil(radius);

    let modified = false;

    let targetH = flattenTarget;
    if (state.tool === 'flatten' && targetH === undefined) {
      if (gridX >= 0 && gridX < resolution && gridZ >= 0 && gridZ < resolution) {
        targetH = heights[gridZ * resolution + gridX];
      } else {
        targetH = 0;
      }
    }

    for (let z = gridZ - cellRadius; z <= gridZ + cellRadius; z++) {
      for (let x = gridX - cellRadius; x <= gridX + cellRadius; x++) {
        if (x < 0 || x >= resolution || z < 0 || z >= resolution) continue;

        const wX = x * cellSizeX - width / 2;
        const wZ = z * cellSizeZ - depth / 2;
        const dist = Math.hypot(wX - worldX, wZ - worldZ);

        if (dist <= radius) {
          // Кубический спад Smoothstep для мягких холмов и впадин без острых конусов
          const t = 1 - dist / radius;
          const smoothFalloff = t * t * (3 - 2 * t);
          const amount = strength * smoothFalloff * dt;
          const idx = z * resolution + x;

          if (state.tool === 'raise') {
            heights[idx] += amount;
            modified = true;
          } else if (state.tool === 'lower') {
            heights[idx] -= amount;
            modified = true;
          } else if (state.tool === 'flatten') {
            heights[idx] += (targetH! - heights[idx]) * Math.min(1, amount * 2);
            modified = true;
          } else if (state.tool === 'smooth') {
            let sum = 0,
              count = 0;
            for (let bz = -1; bz <= 1; bz++) {
              for (let bx = -1; bx <= 1; bx++) {
                const nx = x + bx,
                  nz = z + bz;
                if (nx >= 0 && nx < resolution && nz >= 0 && nz < resolution) {
                  sum += heights[nz * resolution + nx];
                  count++;
                }
              }
            }
            const avg = sum / count;
            heights[idx] += (avg - heights[idx]) * Math.min(1, amount * 2);
            modified = true;
          } else if (state.tool === 'hills') {
            const hillSize = state.hillSize ?? TERRAIN_CONFIG.hills.defaultSize;
            const S = Math.max(4.0, hillSize);

            // 1. Основной слой: органические купола (сопки/холмы) с хаотичными центрами и размерами
            const cx = Math.floor(wX / S);
            const cz = Math.floor(wZ / S);

            let majorHills = 0;
            for (let di = -1; di <= 1; di++) {
              for (let dj = -1; dj <= 1; dj++) {
                const cellX = cx + di;
                const cellZ = cz + dj;

                const h1 = fastHash(cellX, cellZ, 11);
                const h2 = fastHash(cellX, cellZ, 23);
                const h3 = fastHash(cellX, cellZ, 37);
                const h4 = fastHash(cellX, cellZ, 51);

                // Случайный центр вершины холма внутри ячейки
                const peakX = (cellX + 0.15 + h1 * 0.7) * S;
                const peakZ = (cellZ + 0.15 + h2 * 0.7) * S;

                // Индивидуальные радиус и высота
                const peakRadius = S * (0.65 + h3 * 0.7);
                const peakHeight = 0.6 + h4 * 0.8;

                // Асимметрия формы (эллиптичность) исключает строгую круглость и полосы
                const rotAngle = h1 * Math.PI;
                const cosA = Math.cos(rotAngle);
                const sinA = Math.sin(rotAngle);
                const dx = wX - peakX;
                const dz = wZ - peakZ;
                const rotX = dx * cosA - dz * sinA;
                const rotZ = (dx * sinA + dz * cosA) * (0.8 + h2 * 0.4);
                const dist = Math.hypot(rotX, rotZ);

                if (dist < peakRadius) {
                  const t = 1.0 - dist / peakRadius;
                  const profile = t * t * (3.0 - 2.0 * t); // Smoothstep-колокол
                  majorHills += profile * peakHeight;
                }
              }
            }

            // 2. Вторичный слой: мелкие естественные бугорки и складки рельефа (масштаб 0.45 от базового)
            const S2 = S * 0.45;
            const cx2 = Math.floor(wX / S2);
            const cz2 = Math.floor(wZ / S2);

            let minorHills = 0;
            for (let di = -1; di <= 1; di++) {
              for (let dj = -1; dj <= 1; dj++) {
                const cellX = cx2 + di;
                const cellZ = cz2 + dj;
                const h1 = fastHash(cellX, cellZ, 71);
                const h2 = fastHash(cellX, cellZ, 83);
                const h3 = fastHash(cellX, cellZ, 97);

                const peakX = (cellX + 0.2 + h1 * 0.6) * S2;
                const peakZ = (cellZ + 0.2 + h2 * 0.6) * S2;
                const peakRadius = S2 * (0.6 + h3 * 0.6);

                const dist = Math.hypot(wX - peakX, wZ - peakZ);
                if (dist < peakRadius) {
                  const t = 1.0 - dist / peakRadius;
                  minorHills += t * t * (3.0 - 2.0 * t) * 0.35;
                }
              }
            }

            // Смещение -0.45 обеспечивает гармоничный баланс между холмами и ложбинами
            const hillFactor = majorHills + minorHills - 0.45;
            heights[idx] += hillFactor * amount;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      terrainComp.isGeometryDirty = true;
      terrainComp.geometryVersion = (terrainComp.geometryVersion ?? 0) + 1;
    }

    return targetH;
  }
}
