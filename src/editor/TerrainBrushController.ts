import { TerrainComponent } from '../ecs/components/terrain';
import { TerrainBrushState } from '../types';

export class TerrainBrushController {
  public static applyBrush(
    terrainComp: TerrainComponent,
    worldX: number,
    worldZ: number,
    state: TerrainBrushState,
    dt: number,
    flattenTarget?: number
  ): number | undefined {
    const { size, resolution, heights, splatData } = terrainComp;
    const radius = state.radius;
    const strength = state.strength;

    // --- РЕЖИМ 1: ПОКРАСКА ТЕКСТУРНОЙ МАСКИ ВЫСОКОЙ ПЛОТНОСТИ (512x512) ---
    if (state.tool === 'paint') {
      const splatRes = terrainComp.splatResolution || 512;
      const splatCellSize = size / (splatRes - 1);
      const gridX = Math.round((worldX + size / 2) / splatCellSize);
      const gridZ = Math.round((worldZ + size / 2) / splatCellSize);
      const cellRadius = Math.ceil(radius / splatCellSize);

      let modified = false;

      for (let z = gridZ - cellRadius; z <= gridZ + cellRadius; z++) {
        for (let x = gridX - cellRadius; x <= gridX + cellRadius; x++) {
          if (x < 0 || x >= splatRes || z < 0 || z >= splatRes) continue;

          const wX = x * splatCellSize - size / 2;
          const wZ = z * splatCellSize - size / 2;
          const dist = Math.hypot(wX - worldX, wZ - worldZ);

          if (dist <= radius) {
            // Кубический спад Smoothstep (3t^2 - 2t^3) для идеально круглого и бесшовного пятна кисти
            const t = 1 - dist / radius;
            const smoothFalloff = t * t * (3 - 2 * t);
            const amount = strength * smoothFalloff * dt;
            const idx = z * splatRes + x;
            const sIdx = idx * 4;
            const targetChannel = state.texture;
            const paintAmount = amount * 180;

            const oldVal = splatData[sIdx + targetChannel];
            const newVal = Math.min(255, oldVal + paintAmount);
            const added = newVal - oldVal;

            if (added > 0) {
              splatData[sIdx + targetChannel] = newVal;

              let otherSum = 0;
              for (let c = 0; c < 4; c++) {
                if (c !== targetChannel) otherSum += splatData[sIdx + c];
              }

              if (otherSum > 0) {
                const subtractRatio = Math.max(0, otherSum - added) / otherSum;
                for (let c = 0; c < 4; c++) {
                  if (c !== targetChannel) {
                    splatData[sIdx + c] = Math.round(splatData[sIdx + c] * subtractRatio);
                  }
                }
              }

              let total =
                splatData[sIdx] + splatData[sIdx + 1] + splatData[sIdx + 2] + splatData[sIdx + 3];
              if (total === 0) splatData[sIdx] = 255;
              else if (total !== 255) {
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
      }
      return undefined;
    }

    // --- РЕЖИМ 2: СКУЛЬПТИНГ ГЕОМЕТРИИ (128x128) ---
    const cellSize = size / (resolution - 1);
    const gridX = Math.round((worldX + size / 2) / cellSize);
    const gridZ = Math.round((worldZ + size / 2) / cellSize);
    const cellRadius = Math.ceil(radius / cellSize);

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

        const wX = x * cellSize - size / 2;
        const wZ = z * cellSize - size / 2;
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
          }
        }
      }
    }

    if (modified) {
      terrainComp.isGeometryDirty = true;
    }

    return targetH;
  }
}
