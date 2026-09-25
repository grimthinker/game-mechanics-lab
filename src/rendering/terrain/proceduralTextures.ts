import * as THREE from 'three';

interface CachedTerrainTextures {
  grass: THREE.CanvasTexture;
  rock: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
}

let cachedTextures: CachedTerrainTextures | null = null;

/**
 * Быстрый псевдослучайный целочисленный хеш
 */
function fastHash(x: number, y: number, seed: number): number {
  let h = (seed + x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * Бесшовный шум 2D с периодическим замыканием границ по тору
 */
function seamlessNoise2D(x: number, y: number, size: number, period: number, seed: number): number {
  const u = (x / size) * period;
  const v = (y / size) * period;

  const x0 = Math.floor(u) % period;
  const y0 = Math.floor(v) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;

  const fx = u - Math.floor(u);
  const fy = v - Math.floor(v);

  // С-гладкая интерполяция без ступней и видимых ребер
  const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);

  const n00 = fastHash(x0, y0, seed);
  const n10 = fastHash(x1, y0, seed);
  const n01 = fastHash(x0, y1, seed);
  const n11 = fastHash(x1, y1, seed);

  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;

  return nx0 * (1 - sy) + nx1 * sy;
}

/**
 * Бесшумный многооктавный шум (fBm)
 */
function seamlessFbm(
  x: number,
  y: number,
  size: number,
  octaves: number,
  basePeriod: number,
  persistence: number,
  seed: number
): number {
  let total = 0;
  let amplitude = 1.0;
  let maxAmp = 0;
  let period = basePeriod;

  for (let o = 0; o < octaves; o++) {
    total += seamlessNoise2D(x, y, size, period, seed + o * 37) * amplitude;
    maxAmp += amplitude;
    amplitude *= persistence;
    period *= 2;
  }

  return total / maxAmp;
}

/**
 * Бесшовный клеточный шум Вороного (Voronoi/Worley) для камней и трещин
 */
function seamlessVoronoi(
  x: number,
  y: number,
  size: number,
  cells: number,
  seed: number
): { f1: number; f2: number } {
  const u = (x / size) * cells;
  const v = (y / size) * cells;

  const iU = Math.floor(u);
  const iV = Math.floor(v);
  const fU = u - iU;
  const fV = v - iV;

  let d1 = 999.0;
  let d2 = 999.0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const neighborU = (((iU + dx) % cells) + cells) % cells;
      const neighborV = (((iV + dy) % cells) + cells) % cells;

      const px = fastHash(neighborU, neighborV, seed);
      const py = fastHash(neighborU, neighborV, seed + 101);

      const diffX = dx + px - fU;
      const diffY = dy + py - fV;
      const dist = Math.hypot(diffX, diffY);

      if (dist < d1) {
        d2 = d1;
        d1 = dist;
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }

  return { f1: d1, f2: d2 };
}

function generateGrassCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Крупные пятна разной влажности травы + микродетали травинок
      const baseFbm = seamlessFbm(x, y, size, 5, 4, 0.52, 10);
      const fineNoise = seamlessNoise2D(x, y, size, 64, 55);

      const factor = Math.max(0, Math.min(1, baseFbm * 0.8 + fineNoise * 0.2));

      // [38, 88, 28] (густой темный) -> [78, 148, 48] (сочный) -> [115, 185, 62] (солнечный)
      let r = 44 + factor * 66;
      let g = 92 + factor * 86;
      let b = 28 + factor * 30;

      data[idx] = Math.round(r);
      data[idx + 1] = Math.round(g);
      data[idx + 2] = Math.round(b);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function generateRockCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Трещины и каменные плиты Вороного
      const vor = seamlessVoronoi(x, y, size, 14, 202);
      const crack = Math.min(1, (vor.f2 - vor.f1) * 3.2);

      // Скалистый шум шероховатости
      const fbm = seamlessFbm(x, y, size, 4, 8, 0.5, 333);
      const stoneFactor = (1.0 - crack * 0.4) * 0.6 + fbm * 0.4;

      // От темно-серых разломов к гранитным сланцевым плитам
      const val = 60 + stoneFactor * 105;

      data[idx] = Math.round(val);
      data[idx + 1] = Math.round(val + 3);
      data[idx + 2] = Math.round(val + 6);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function generateDirtCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Комковатый органический рельеф чернозема
      const fbm = seamlessFbm(x, y, size, 5, 8, 0.58, 404);
      const pebbles = seamlessNoise2D(x, y, size, 32, 707);

      const factor = Math.max(0, Math.min(1, fbm * 0.85 + (pebbles > 0.72 ? 0.3 : 0)));

      // Теплые коричневые и землистые тона почвы
      data[idx] = Math.round(62 + factor * 60);
      data[idx + 1] = Math.round(42 + factor * 42);
      data[idx + 2] = Math.round(26 + factor * 26);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function generateSandCanvas(size: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Спокойный, монотонный бесшовный шум без направленных полос и волн
      const baseFbm = seamlessFbm(x, y, size, 4, 8, 0.42, 515);
      // Мелкое зацикленное зерно песчинок
      const microGrain = seamlessNoise2D(x, y, size, 128, 777);

      const factor = Math.max(0, Math.min(1, baseFbm * 0.75 + microGrain * 0.25));

      // Ровный, монотонный теплый песчаный цвет с мягким минимальным градиентом
      data[idx] = Math.round(204 + factor * 16);
      data[idx + 1] = Math.round(174 + factor * 14);
      data[idx + 2] = Math.round(128 + factor * 12);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export function getTerrainTextures(): CachedTerrainTextures {
  if (cachedTextures) return cachedTextures;

  const size = 512;

  // 1. Трава (естественный органический покров)
  const grassCanvas = generateGrassCanvas(size);
  const grass = new THREE.CanvasTexture(grassCanvas);
  grass.wrapS = THREE.RepeatWrapping;
  grass.wrapT = THREE.RepeatWrapping;
  grass.colorSpace = THREE.SRGBColorSpace;
  grass.generateMipmaps = true;
  grass.minFilter = THREE.LinearMipmapLinearFilter;
  grass.magFilter = THREE.LinearFilter;

  // 2. Скалы / Камень (плиты Вороного и сланцевые трещины)
  const rockCanvas = generateRockCanvas(size);
  const rock = new THREE.CanvasTexture(rockCanvas);
  rock.wrapS = THREE.RepeatWrapping;
  rock.wrapT = THREE.RepeatWrapping;
  rock.colorSpace = THREE.SRGBColorSpace;
  rock.generateMipmaps = true;
  rock.minFilter = THREE.LinearMipmapLinearFilter;
  rock.magFilter = THREE.LinearFilter;

  // 3. Почва / Земля (рыхлый грунт с камешками)
  const dirtCanvas = generateDirtCanvas(size);
  const dirt = new THREE.CanvasTexture(dirtCanvas);
  dirt.wrapS = THREE.RepeatWrapping;
  dirt.wrapT = THREE.RepeatWrapping;
  dirt.colorSpace = THREE.SRGBColorSpace;
  dirt.generateMipmaps = true;
  dirt.minFilter = THREE.LinearMipmapLinearFilter;
  dirt.magFilter = THREE.LinearFilter;

  // 4. Песок (ветровые барханы и дюны)
  const sandCanvas = generateSandCanvas(size);
  const sand = new THREE.CanvasTexture(sandCanvas);
  sand.wrapS = THREE.RepeatWrapping;
  sand.wrapT = THREE.RepeatWrapping;
  sand.colorSpace = THREE.SRGBColorSpace;
  sand.generateMipmaps = true;
  sand.minFilter = THREE.LinearMipmapLinearFilter;
  sand.magFilter = THREE.LinearFilter;

  cachedTextures = { grass, rock, dirt, sand };
  return cachedTextures;
}
