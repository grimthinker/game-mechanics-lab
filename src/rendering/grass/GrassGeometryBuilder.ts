import * as THREE from 'three';

export interface GrassClusterOptions {
  /** Количество травинок в одном пучке (по умолчанию 4) */
  bladeCount?: number;
  /** Количество вертикальных сегментов на одну травинку для плавного изгиба (по умолчанию 3) */
  segments?: number;
  /** Базовая высота пучка в метрах (по умолчанию 0.55 м) */
  height?: number;
  /** Ширина травинки у основания (по умолчанию 0.07 м) */
  baseWidth?: number;
  /** Ширина травинки у верхушки (по умолчанию 0.015 м) */
  tipWidth?: number;
  /** Сила изгиба травинок наружу от центра (по умолчанию 0.12 м) */
  curveStrength?: number;
  /** Радиус расхождения корней в пучке у земли (по умолчанию 0.025 м) */
  rootRadius?: number;
  /** Цвет основания травинки у корней */
  rootColor?: THREE.Color;
  /** Цвет верхушки травинки */
  tipColor?: THREE.Color;
  /** Степень нелинейности градиента цвета ( > 1.0 сдвигает плавный переход к верхушке, по умолчанию 1.5) */
  gradientPower?: number;
}

export class GrassGeometryBuilder {
  /**
   * Программно генерирует оптимизированную трехмерную BufferGeometry изогнутого пучка травы (low-poly cluster).
   */
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
      // Равномерно распределяем травинки по окружности с небольшим псевдослучайным смещением угла
      const angleFraction = b / bladeCount;
      const angle = angleFraction * Math.PI * 2 + Math.sin(b * 12.9898) * 0.2;

      // Вектор направления изгиба травинки в горизонтальной плоскости XZ
      const dirX = Math.cos(angle);
      const dirZ = Math.sin(angle);

      // Перпендикулярный вектор для формирования ширины плоскости травинки
      const perpX = -dirZ;
      const perpZ = dirX;

      // Небольшое варьирование высоты конкретной травинки в пучке (+/- 15%)
      const bladeHeight = height * (0.85 + (Math.sin(b * 4.33) * 0.5 + 0.5) * 0.3);
      const bladeCurve = curveStrength * (0.85 + (Math.cos(b * 7.12) * 0.5 + 0.5) * 0.3);

      const bladeVertexStartIndex = vOffset / 3;

      for (let s = 0; s <= segments; s++) {
        const t = s / segments; // Прогресс по высоте от 0.0 (корень) до 1.0 (кончик)

        // Высота ряда и квадратичный изгиб наружу от центра
        const y = t * bladeHeight;
        const lean = bladeCurve * t * t;

        // На самом верхнем ряду (кончик) ширина равна 0, чтобы левая и правая вершина слились в одну точку
        const currentHalfWidth = s === segments ? 0.0 : (baseWidth * (1 - t) + tipWidth * t) * 0.5;

        // Координаты центрального хребта травинки на высоте y
        const centerX = dirX * (rootRadius + lean);
        const centerZ = dirZ * (rootRadius + lean);

        // Вершина 1 (левый край)
        const leftIdx = vOffset;
        positions[leftIdx] = centerX - perpX * currentHalfWidth;
        positions[leftIdx + 1] = y;
        positions[leftIdx + 2] = centerZ - perpZ * currentHalfWidth;

        // Вершина 2 (правый край)
        const rightIdx = vOffset + 3;
        positions[rightIdx] = centerX + perpX * currentHalfWidth;
        positions[rightIdx + 1] = y;
        positions[rightIdx + 2] = centerZ + perpZ * currentHalfWidth;

        // Мягкая усредненная нормаль: направлена наружу пучка и приподнята вверх (0.6) для красивого рассеивания света
        const normX = dirX * 0.6;
        const normY = 0.6;
        const normZ = dirZ * 0.6;
        const nLen = Math.hypot(normX, normY, normZ) || 1.0;

        normals[leftIdx] = normX / nLen;
        normals[leftIdx + 1] = normY / nLen;
        normals[leftIdx + 2] = normZ / nLen;

        normals[rightIdx] = normX / nLen;
        normals[rightIdx + 1] = normY / nLen;
        normals[rightIdx + 2] = normZ / nLen;

        // UV-координаты: U по ширине (0.0 слева, 1.0 справа), V строго по высоте (0.0 у корня, 1.0 на кончике)
        const uvIdx = (vOffset / 3) * 2;
        uvs[uvIdx] = 0.0;
        uvs[uvIdx + 1] = t;

        uvs[uvIdx + 2] = 1.0;
        uvs[uvIdx + 3] = t;

        // Нелинейный градиент вертексов (смягчает резкий переход за счет степени curve)
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

      // Формирование треугольников (индексов) для сегментов текущей травинки
      for (let s = 0; s < segments; s++) {
        const bl = bladeVertexStartIndex + s * 2;
        const br = bl + 1;
        const tl = bl + 2;
        const tr = bl + 3;

        // Первый треугольник квада
        indices[iOffset++] = bl;
        indices[iOffset++] = br;
        indices[iOffset++] = tl;

        // Второй треугольник квада
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

    // Защищаем геометрию от случайного disposeObject при перестроении сцены
    geometry.userData.isSharedAsset = true;

    return geometry;
  }
}
