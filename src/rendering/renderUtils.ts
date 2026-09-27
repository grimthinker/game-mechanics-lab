import * as THREE from 'three';

/**
 * Рассчитывает сглаженные нормали (биссектрисы углов) для обводки.
 * Склеивает разрозненные вершины на углах кубов и стыках граней,
 * полностью устраняя разрывы и щели в контуре.
 */
export function computeSmoothNormals(geometry: THREE.BufferGeometry): Float32Array {
  const posAttr = geometry.attributes.position;
  const normAttr = geometry.attributes.normal;
  const count = posAttr.count;
  const smoothNormals = new Float32Array(count * 3);

  const posMap = new Map<string, number[]>();

  for (let i = 0; i < count; i++) {
    const x = posAttr.getX(i);
    const y = posAttr.getY(i);
    const z = posAttr.getZ(i);
    // Квантование координат для объединения совпадающих вершин граней
    const key = `${x.toFixed(4)}_${y.toFixed(4)}_${z.toFixed(4)}`;

    let list = posMap.get(key);
    if (!list) {
      list = [];
      posMap.set(key, list);
    }
    list.push(i);
  }

  const tempVec = new THREE.Vector3();

  for (const indices of posMap.values()) {
    tempVec.set(0, 0, 0);

    for (const idx of indices) {
      if (normAttr) {
        tempVec.x += normAttr.getX(idx);
        tempVec.y += normAttr.getY(idx);
        tempVec.z += normAttr.getZ(idx);
      }
    }

    if (tempVec.lengthSq() > 1e-6) {
      tempVec.normalize();
    } else {
      tempVec.set(0, 1, 0);
    }

    for (const idx of indices) {
      smoothNormals[idx * 3] = tempVec.x;
      smoothNormals[idx * 3 + 1] = tempVec.y;
      smoothNormals[idx * 3 + 2] = tempVec.z;
    }
  }

  return smoothNormals;
}

export function createOutlineShaderMaterial(
  color: number = 0x151515,
  thickness: number = 2.0
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uThickness: { value: thickness },
    },
    vertexShader: `
      uniform float uThickness;
      attribute vec3 smoothNormal;

      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        vec3 n = smoothNormal;
        if (length(n) < 0.01) n = normal;

        // Нормаль в пространстве камеры (View Space)
        vec3 viewNormal = normalMatrix * n;

        // Отбрасываем Z-составляющую нормали и нормализуем в плоскости XY.
        // Это гарантирует равномерную толщину контура со всех сторон объекта
        // независимо от того, под каким углом грань повернута к камере.
        vec2 viewDir = length(viewNormal.xy) > 0.0001 ? normalize(viewNormal.xy) : vec2(0.0, 1.0);

        // Выдавливаем вершины в View Space (в метрах).
        // Поскольку это происходит до проекции, стандартная перспектива отработает автоматически:
        // чем дальше объект, тем тоньше будет казаться контур на экране.
        mvPosition.xy += viewDir * (uThickness * 0.01);

        // Немного утапливаем контур вглубь сцены (назад от камеры), чтобы исключить Z-fighting
        mvPosition.z -= (uThickness * 0.01);

        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;

      void main() {
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: true,
  });
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (!child.userData.isSharedAsset) {
        child.geometry?.dispose();
      }
      if (!child.userData.isSharedAsset && !child.userData.isSharedMaterial) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    }
  });
}

export function attachOutlines(object: THREE.Object3D, material: THREE.Material): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.userData.isSelectionOutline) {
      const geo = child.geometry;
      // Однократный расчет и кэширование нормалей для цельного контура без разрывов
      if (geo && !geo.attributes.smoothNormal) {
        const smoothNormals = computeSmoothNormals(geo);
        geo.setAttribute('smoothNormal', new THREE.BufferAttribute(smoothNormals, 3));
      }

      const outline = new THREE.Mesh(geo, material);
      outline.scale.set(1, 1, 1);
      outline.userData.isSelectionOutline = true;
      outline.visible = false;
      child.add(outline);
    }
  });
}
