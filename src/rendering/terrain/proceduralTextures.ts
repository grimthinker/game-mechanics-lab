import * as THREE from 'three';

interface CachedTerrainTextures {
  grass: THREE.CanvasTexture;
  rock: THREE.CanvasTexture;
  dirt: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
}

let cachedTextures: CachedTerrainTextures | null = null;

function createNoisePattern(
  width: number,
  height: number,
  baseColor: [number, number, number],
  noiseScale: number,
  detailColor: [number, number, number]
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const n1 = Math.sin(x * noiseScale * 0.05) * Math.cos(y * noiseScale * 0.05);
      const n2 = Math.sin((x + y) * noiseScale * 0.1) * 0.5 + 0.5;
      const rand = (Math.random() - 0.5) * 0.25;
      const factor = Math.max(0, Math.min(1, (n1 + n2) * 0.5 + rand));

      data[idx] = Math.round(baseColor[0] * (1 - factor) + detailColor[0] * factor);
      data[idx + 1] = Math.round(baseColor[1] * (1 - factor) + detailColor[1] * factor);
      data[idx + 2] = Math.round(baseColor[2] * (1 - factor) + detailColor[2] * factor);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

export function getTerrainTextures(): CachedTerrainTextures {
  if (cachedTextures) return cachedTextures;

  const size = 512;

  // 1. Трава (зеленые сочные оттенки)
  const grassCanvas = createNoisePattern(size, size, [54, 115, 41], 4.0, [92, 168, 59]);
  const grass = new THREE.CanvasTexture(grassCanvas);
  grass.wrapS = THREE.RepeatWrapping;
  grass.wrapT = THREE.RepeatWrapping;
  grass.colorSpace = THREE.SRGBColorSpace;

  // 2. Скалы / Камень (серые сланцевые тона)
  const rockCanvas = createNoisePattern(size, size, [80, 85, 90], 8.0, [140, 145, 150]);
  const rock = new THREE.CanvasTexture(rockCanvas);
  rock.wrapS = THREE.RepeatWrapping;
  rock.wrapT = THREE.RepeatWrapping;
  rock.colorSpace = THREE.SRGBColorSpace;

  // 3. Почва / Земля (темно-коричневые оттенки)
  const dirtCanvas = createNoisePattern(size, size, [75, 48, 29], 6.0, [110, 75, 45]);
  const dirt = new THREE.CanvasTexture(dirtCanvas);
  dirt.wrapS = THREE.RepeatWrapping;
  dirt.wrapT = THREE.RepeatWrapping;
  dirt.colorSpace = THREE.SRGBColorSpace;

  // 4. Песок (теплые бежевые тона)
  const sandCanvas = createNoisePattern(size, size, [195, 165, 110], 3.0, [225, 200, 145]);
  const sand = new THREE.CanvasTexture(sandCanvas);
  sand.wrapS = THREE.RepeatWrapping;
  sand.wrapT = THREE.RepeatWrapping;
  sand.colorSpace = THREE.SRGBColorSpace;

  cachedTextures = { grass, rock, dirt, sand };
  return cachedTextures;
}
