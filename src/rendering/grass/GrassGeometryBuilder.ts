import * as THREE from 'three';

export interface GrassClusterOptions {
  bladeCount?: number;
  segments?: number;
  height?: number;
  baseWidth?: number;
  tipWidth?: number;
  curveStrength?: number;
  rootRadius?: number;
  rootColor?: THREE.Color;
  tipColor?: THREE.Color;
  gradientPower?: number;
}

export type FlowerType = 'poppy' | 'cornflower' | 'daisy' | 'dandelion';

export class GrassGeometryBuilder {
  /** Обычный зеленый пучок травы */
  public static createClusterGeometry(options: GrassClusterOptions = {}): THREE.BufferGeometry {
    const bladeCount = Math.max(1, options.bladeCount ?? 4);
    const segments = Math.max(1, options.segments ?? 3);
    const height = options.height ?? 0.55;
    const baseWidth = options.baseWidth ?? 0.07;
    const tipWidth = options.tipWidth ?? 0.015;
    const curveStrength = options.curveStrength ?? 0.12;
    const rootRadius = options.rootRadius ?? 0.025;

    const rootColor = options.rootColor ?? new THREE.Color(0x3e732e);
    const tipColor = options.tipColor ?? new THREE.Color(0x7ec842);
    const gradientPower = options.gradientPower ?? 0.9;

    return GrassGeometryBuilder.generateBladeGeometry(
      bladeCount,
      segments,
      height,
      baseWidth,
      tipWidth,
      curveStrength,
      rootRadius,
      rootColor,
      tipColor,
      gradientPower
    );
  }

  /** Высохшая / соломенная трава */
  public static createDryGrassGeometry(): THREE.BufferGeometry {
    return GrassGeometryBuilder.generateBladeGeometry(
      4,
      3,
      0.48,
      0.05,
      0.01,
      0.16,
      0.03,
      new THREE.Color(0x9e8a52),
      new THREE.Color(0xded09b),
      1.1
    );
  }

  /** Пшеничный кустик из 3 золотистых колосков с полусферическими нормалями листвы */
  public static createWheatGeometry(): THREE.BufferGeometry {
    const stalkCount = 3;
    const baseHeight = 0.82;
    const earHeight = 0.28;
    const earWidth = 0.052;

    const stalkColorRoot = new THREE.Color(0xd4be58);
    const stalkColorTip = new THREE.Color(0xf6d868);
    const earColor = new THREE.Color(0xffe676);

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    let vIdx = 0;

    for (let b = 0; b < stalkCount; b++) {
      const angle = (b / stalkCount) * Math.PI * 2 + b * 0.4;
      const rootDist = b === 0 ? 0.0 : 0.04;
      const rootX = Math.cos(angle) * rootDist;
      const rootZ = Math.sin(angle) * rootDist;

      const leanX = Math.cos(angle) * (b === 0 ? 0.02 : 0.08);
      const leanZ = Math.sin(angle) * (b === 0 ? 0.02 : 0.08);
      const height = baseHeight * (0.9 + (b === 0 ? 0.15 : b * 0.05));

      // 1. Стебель (двусторонний квад с нормалями, ориентированными к солнцу)
      const stalkSegs = 3;
      const stalkBaseIdx = vIdx;
      const stalkHalfW = 0.015;
      const perpX = -Math.sin(angle) * stalkHalfW;
      const perpZ = Math.cos(angle) * stalkHalfW;

      for (let s = 0; s <= stalkSegs; s++) {
        const t = s / stalkSegs;
        const y = t * (height - earHeight);
        const curX = rootX + leanX * t * t;
        const curZ = rootZ + leanZ * t * t;

        positions.push(curX - perpX, y, curZ - perpZ);
        positions.push(curX + perpX, y, curZ + perpZ);

        // Полусферическая нормаль: смотрит преимущественно вверх (0.85) и наружу (0.35)
        const nx = Math.cos(angle) * 0.35;
        const nz = Math.sin(angle) * 0.35;
        normals.push(nx, 0.85, nz, nx, 0.85, nz);

        uvs.push(0, t * 0.65, 1, t * 0.65);

        const col = new THREE.Color().lerpColors(stalkColorRoot, stalkColorTip, t);
        colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
        vIdx += 2;
      }

      for (let s = 0; s < stalkSegs; s++) {
        const bl = stalkBaseIdx + s * 2;
        indices.push(bl, bl + 1, bl + 2);
        indices.push(bl + 1, bl + 3, bl + 2);
      }

      // 2. Золотистый граненый колосок (правильный CCW обход граней)
      const earBaseY = height - earHeight;
      const earSides = 5;
      const earRings = 3;
      const earStartIdx = vIdx;

      for (let r = 0; r <= earRings; r++) {
        const rt = r / earRings;
        const ry = earBaseY + rt * earHeight;
        const rw = (Math.sin(rt * Math.PI) * 0.7 + 0.3) * earWidth;
        const curX = rootX + leanX * (0.7 + rt * 0.3);
        const curZ = rootZ + leanZ * (0.7 + rt * 0.3);

        for (let s = 0; s < earSides; s++) {
          const sa = (s / earSides) * Math.PI * 2;
          const px = curX + Math.cos(sa) * rw;
          const pz = curZ + Math.sin(sa) * rw;

          positions.push(px, ry, pz);

          // Нормали смотрят наружу от центра колоска и вверх в небо
          const nx = Math.cos(sa) * 0.45;
          const nz = Math.sin(sa) * 0.45;
          normals.push(nx, 0.8, nz);

          uvs.push(s / earSides, 0.65 + rt * 0.35);
          colors.push(earColor.r, earColor.g, earColor.b);
          vIdx++;
        }
      }

      // Корректный CCW обход граней цилиндра колоска (нормали смотрят строго наружу)
      for (let r = 0; r < earRings; r++) {
        const r0 = earStartIdx + r * earSides;
        const r1 = earStartIdx + (r + 1) * earSides;
        for (let s = 0; s < earSides; s++) {
          const next = (s + 1) % earSides;
          indices.push(r0 + s, r0 + next, r1 + s);
          indices.push(r0 + next, r1 + next, r1 + s);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    geo.userData.isSharedAsset = true;
    return geo;
  }

  /** Камыш / Рогоз: яркие сочные листья и бархатный каштановый початок */
  public static createReedsGeometry(): THREE.BufferGeometry {
    const height = 1.35;
    const headBaseY = 0.88;
    const headHeight = 0.3;
    const headRadius = 0.048;

    const stalkColor = new THREE.Color(0x689f38); // свежий сочный зеленый
    const leafColor = new THREE.Color(0x7cb342);
    const headColor = new THREE.Color(0x7d421e); // теплый бархатно-каштановый
    const tipSpikeColor = new THREE.Color(0xd4b85c);

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    let vIdx = 0;

    // 1. Высокий центральный стебель
    const stalkSegs = 4;
    const stalkHalfW = 0.02;
    const stalkBaseIdx = vIdx;

    for (let s = 0; s <= stalkSegs; s++) {
      const t = s / stalkSegs;
      const y = t * height;
      positions.push(-stalkHalfW, y, 0);
      positions.push(stalkHalfW, y, 0);

      normals.push(0, 0.85, 0.35, 0, 0.85, 0.35);
      uvs.push(0, t, 1, t);

      const col = t > 0.88 ? tipSpikeColor : stalkColor;
      colors.push(col.r, col.g, col.b, col.r, col.g, col.b);
      vIdx += 2;
    }

    for (let s = 0; s < stalkSegs; s++) {
      const bl = stalkBaseIdx + s * 2;
      indices.push(bl, bl + 1, bl + 2);
      indices.push(bl + 1, bl + 3, bl + 2);
    }

    // 2. Длинные изящные ланцетные листья вокруг стебля
    const leafCount = 3;
    for (let l = 0; l < leafCount; l++) {
      const lang = (l / leafCount) * Math.PI * 2 + 0.3;
      const leafBaseIdx = vIdx;
      const leafH = 0.9 + l * 0.15;
      const dirX = Math.cos(lang);
      const dirZ = Math.sin(lang);
      const perpX = -dirZ * 0.035;
      const perpZ = dirX * 0.035;

      for (let s = 0; s <= 3; s++) {
        const t = s / 3;
        const y = t * leafH;
        const arch = t * t * 0.14;
        const hw = (1 - t * 0.7) * 1.0;

        const cx = dirX * arch;
        const cz = dirZ * arch;

        positions.push(cx - perpX * hw, y, cz - perpZ * hw);
        positions.push(cx + perpX * hw, y, cz + perpZ * hw);

        normals.push(dirX * 0.4, 0.85, dirZ * 0.4, dirX * 0.4, 0.85, dirZ * 0.4);
        uvs.push(0, t, 1, t);
        colors.push(leafColor.r, leafColor.g, leafColor.b, leafColor.r, leafColor.g, leafColor.b);
        vIdx += 2;
      }

      for (let s = 0; s < 3; s++) {
        const bl = leafBaseIdx + s * 2;
        indices.push(bl, bl + 1, bl + 2);
        indices.push(bl + 1, bl + 3, bl + 2);
      }
    }

    // 3. Теплый коричневый початок камыша (правильный CCW обход граней)
    const sides = 6;
    const headRings = 3;
    const headStartIdx = vIdx;

    for (let r = 0; r <= headRings; r++) {
      const rt = r / headRings;
      const y = headBaseY + rt * headHeight;
      const rad = (Math.sin(rt * Math.PI) * 0.35 + 0.65) * headRadius;

      for (let s = 0; s < sides; s++) {
        const sa = (s / sides) * Math.PI * 2;
        positions.push(Math.cos(sa) * rad, y, Math.sin(sa) * rad);

        // Нормали смотрят наружу от центра початка и вверх к небу
        const nx = Math.cos(sa) * 0.55;
        const nz = Math.sin(sa) * 0.55;
        normals.push(nx, 0.75, nz);

        uvs.push(s / sides, 0.7 + rt * 0.25);
        colors.push(headColor.r, headColor.g, headColor.b);
        vIdx++;
      }
    }

    for (let r = 0; r < headRings; r++) {
      const r0 = headStartIdx + r * sides;
      const r1 = headStartIdx + (r + 1) * sides;
      for (let s = 0; s < sides; s++) {
        const next = (s + 1) % sides;
        // Строго CCW: нормаль направлена наружу, а не внутрь
        indices.push(r0 + s, r1 + s, r0 + next);
        indices.push(r0 + next, r1 + s, r1 + next);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    geo.userData.isSharedAsset = true;
    return geo;
  }

  /** Полевые цветы: яркие насыщенные лепестки с верным зенитным освещением */
  public static createFlowerGeometry(type: FlowerType): THREE.BufferGeometry {
    const stemHeight = 0.48;
    const flowerRadius = 0.11;
    const stemColor = new THREE.Color(0x689f38); // свежий салатово-зеленый

    let petalColor = new THREE.Color(0xff3333); // алый мак
    let centerColor = new THREE.Color(0x212121);
    let petalCount = 5;

    if (type === 'cornflower') {
      petalColor = new THREE.Color(0x29b6f6); // небесно-васильковый
      centerColor = new THREE.Color(0x0d47a1);
      petalCount = 6;
    } else if (type === 'daisy') {
      petalColor = new THREE.Color(0xffffff); // белая ромашка
      centerColor = new THREE.Color(0xffca28); // ярко-желтая серединка
      petalCount = 8;
    } else if (type === 'dandelion') {
      petalColor = new THREE.Color(0xffd54f); // солнечный одуванчик
      centerColor = new THREE.Color(0xffa000);
      petalCount = 7;
    }

    const positions: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // 1. Зеленый стебель с 2 листочками у основания
    const hw = 0.015;
    positions.push(-hw, 0, 0, hw, 0, 0, -hw, stemHeight, 0, hw, stemHeight, 0);
    positions.push(0, 0, -hw, 0, 0, hw, 0, stemHeight, -hw, 0, stemHeight, hw);

    for (let i = 0; i < 8; i++) {
      normals.push(0, 0.88, 0.25);
      uvs.push(0, 0.5);
      colors.push(stemColor.r, stemColor.g, stemColor.b);
    }
    // Правильный CCW обход квадов стебля
    indices.push(0, 1, 2, 1, 3, 2, 4, 5, 6, 5, 7, 6);

    // 2. Центр цветка (выпуклая серединка)
    const centerIdx = 8;
    positions.push(0, stemHeight + 0.02, 0);
    normals.push(0, 0.98, 0.05);
    uvs.push(0.5, 1.0);
    colors.push(centerColor.r, centerColor.g, centerColor.b);

    // 3. Яркие лепестки (обход строго CCW при взгляде сверху: нормали направлены к небу)
    let pIdx = centerIdx + 1;
    for (let i = 0; i < petalCount; i++) {
      const a1 = (i / petalCount) * Math.PI * 2;
      const a2 = ((i + 0.65) / petalCount) * Math.PI * 2;
      const aMid = (a1 + a2) * 0.5;

      const p1Idx = pIdx++;
      const p2Idx = pIdx++;

      positions.push(
        Math.cos(aMid) * flowerRadius,
        stemHeight + 0.012,
        Math.sin(aMid) * flowerRadius
      );
      normals.push(Math.cos(aMid) * 0.2, 0.95, Math.sin(aMid) * 0.2);
      uvs.push(1.0, 1.0);
      colors.push(petalColor.r, petalColor.g, petalColor.b);

      positions.push(
        Math.cos(a2) * (flowerRadius * 0.55),
        stemHeight + 0.018,
        Math.sin(a2) * (flowerRadius * 0.55)
      );
      normals.push(Math.cos(a2) * 0.2, 0.95, Math.sin(a2) * 0.2);
      uvs.push(1.0, 1.0);
      colors.push(petalColor.r, petalColor.g, petalColor.b);

      // CCW обход: Center -> P2 -> P1 смотрит строго ВВЕРХ в небо (+Y)
      indices.push(centerIdx, p2Idx, p1Idx);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    geo.userData.isSharedAsset = true;
    return geo;
  }

  private static generateBladeGeometry(
    bladeCount: number,
    segments: number,
    height: number,
    baseWidth: number,
    tipWidth: number,
    curveStrength: number,
    rootRadius: number,
    rootColor: THREE.Color,
    tipColor: THREE.Color,
    gradientPower: number
  ): THREE.BufferGeometry {
    const rowsPerBlade = segments + 1;
    const verticesPerBlade = rowsPerBlade * 2;
    const totalVertices = bladeCount * verticesPerBlade;
    const trianglesPerBlade = segments * 2;
    const totalIndices = bladeCount * trianglesPerBlade * 3;

    const positions = new Float32Array(totalVertices * 3);
    const normals = new Float32Array(totalVertices * 3);
    const uvs = new Float32Array(totalVertices * 2);
    const colors = new Float32Array(totalVertices * 3);
    const indices = new Uint16Array(totalIndices);

    let vOffset = 0;
    let iOffset = 0;

    for (let b = 0; b < bladeCount; b++) {
      const angleFraction = b / bladeCount;
      const angle = angleFraction * Math.PI * 2 + Math.sin(b * 12.9898) * 0.2;

      const dirX = Math.cos(angle);
      const dirZ = Math.sin(angle);

      const perpX = -dirZ;
      const perpZ = dirX;

      const bladeHeight = height * (0.85 + (Math.sin(b * 4.33) * 0.5 + 0.5) * 0.3);
      const bladeCurve = curveStrength * (0.85 + (Math.cos(b * 7.12) * 0.5 + 0.5) * 0.3);

      const bladeVertexStartIndex = vOffset / 3;

      for (let s = 0; s <= segments; s++) {
        const t = s / segments;

        const y = t * bladeHeight;
        const lean = bladeCurve * t * t;
        const currentHalfWidth = s === segments ? 0.0 : (baseWidth * (1 - t) + tipWidth * t) * 0.5;

        const centerX = dirX * (rootRadius + lean);
        const centerZ = dirZ * (rootRadius + lean);

        const leftIdx = vOffset;
        positions[leftIdx] = centerX - perpX * currentHalfWidth;
        positions[leftIdx + 1] = y;
        positions[leftIdx + 2] = centerZ - perpZ * currentHalfWidth;

        const rightIdx = vOffset + 3;
        positions[rightIdx] = centerX + perpX * currentHalfWidth;
        positions[rightIdx + 1] = y;
        positions[rightIdx + 2] = centerZ + perpZ * currentHalfWidth;

        const normX = dirX * 0.35;
        const normY = 0.85;
        const normZ = dirZ * 0.35;
        const nLen = Math.hypot(normX, normY, normZ) || 1.0;

        normals[leftIdx] = normX / nLen;
        normals[leftIdx + 1] = normY / nLen;
        normals[leftIdx + 2] = normZ / nLen;

        normals[rightIdx] = normX / nLen;
        normals[rightIdx + 1] = normY / nLen;
        normals[rightIdx + 2] = normZ / nLen;

        const uvIdx = (vOffset / 3) * 2;
        uvs[uvIdx] = 0.0;
        uvs[uvIdx + 1] = t;

        uvs[uvIdx + 2] = 1.0;
        uvs[uvIdx + 3] = t;

        const colorFactor = Math.pow(t, gradientPower);
        const r = THREE.MathUtils.lerp(rootColor.r, tipColor.r, colorFactor);
        const g = THREE.MathUtils.lerp(rootColor.g, tipColor.g, colorFactor);
        const bCol = THREE.MathUtils.lerp(rootColor.b, tipColor.b, colorFactor);

        colors[leftIdx] = r;
        colors[leftIdx + 1] = g;
        colors[leftIdx + 2] = bCol;

        colors[rightIdx] = r;
        colors[rightIdx + 1] = g;
        colors[rightIdx + 2] = bCol;

        vOffset += 6;
      }

      for (let s = 0; s < segments; s++) {
        const bl = bladeVertexStartIndex + s * 2;
        const br = bl + 1;
        const tl = bl + 2;
        const tr = bl + 3;

        indices[iOffset++] = bl;
        indices[iOffset++] = br;
        indices[iOffset++] = tl;

        indices[iOffset++] = br;
        indices[iOffset++] = tr;
        indices[iOffset++] = tl;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.userData.isSharedAsset = true;
    return geometry;
  }
}
