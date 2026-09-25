import * as THREE from 'three';

export interface GrassMaterialUniforms {
  uTime: { value: number };
  uWindSpeed: { value: number };
  uWindStrength: { value: number };
  uInteractors: { value: THREE.Vector4[] };
  uInteractorCount: { value: number };
}

export function createGrassMaterial(): THREE.MeshStandardMaterial {
  const interactorsArray: THREE.Vector4[] = Array.from(
    { length: 16 },
    () => new THREE.Vector4(0, -999, 0, 0)
  );

  const material = new THREE.MeshStandardMaterial({
    roughness: 0.75,
    metalness: 0.05,
    side: THREE.DoubleSide,
    vertexColors: true,
  });

  material.defines = {
    USE_UV: '',
  };

  material.userData.isSharedMaterial = true;
  material.customProgramCacheKey = () => 'InteractiveGrassMaterial_v1';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWindSpeed = { value: 1.8 };
    shader.uniforms.uWindStrength = { value: 0.14 };
    shader.uniforms.uInteractors = { value: interactorsArray };
    shader.uniforms.uInteractorCount = { value: 0 };

    material.userData.shader = shader;

    shader.vertexShader = `
      uniform float uTime;
      uniform float uWindSpeed;
      uniform float uWindStrength;
      uniform vec4 uInteractors[16];
      uniform int uInteractorCount;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      // Мировое положение корня текущего пучка травы (pivot у земли)
      #ifdef USE_INSTANCING
        vec4 instanceRoot = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec4 baseWorldPos = modelMatrix * instanceMatrix * vec4(transformed, 1.0);
      #else
        vec4 instanceRoot = modelMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        vec4 baseWorldPos = modelMatrix * vec4(transformed, 1.0);
      #endif

      // Вектор от корня пучка к текущей вершине (неизменные форма, ширина и длина листка)
      vec3 bladeOffset = baseWorldPos.xyz - instanceRoot.xyz;

      // uv.y строго 0.0 у корня и 1.0 на кончике (корень всегда неподвижен)
      float hFactor = uv.y;

      // 1. Поиск ближайшего интерактора относительно КОРНЯ куста
      vec2 tramplingDir = vec2(0.0);
      float maxBendAngle = 0.0;

      for (int i = 0; i < 16; i++) {
        if (i >= uInteractorCount) break;

        vec4 inter = uInteractors[i];
        float radius = inter.w;
        if (radius <= 0.001) continue;

        // Расстояние замеряется от корня куста, исключая расхождение вершин вширь
        float dist = distance(instanceRoot.xz, inter.xz);
        if (dist < radius) {
          float factor = 1.0 - (dist / radius);
          factor = factor * factor; // Мягкий квадратичный спад к краю ноги

          vec2 diff = instanceRoot.xz - inter.xz;
          float len = length(diff);
          vec2 pushDir = len > 0.001 ? diff / len : vec2(0.0, 1.0);

          // Угол приминания: до ~80 градусов (1.40 радиан), почти параллельно земле
          float bendAngle = factor * 1.40;
          if (bendAngle > maxBendAngle) {
            maxBendAngle = bendAngle;
            tramplingDir = pushDir;
          }
        }
      }

// 2. Вращение листка при приминании (формула Родрига) с сохранением длины
      if (maxBendAngle > 0.001) {
        // Ось вращения лежит горизонтально в плоскости пола и перпендикулярна направлению удара ноги
        vec3 bendAxis = normalize(vec3(tramplingDir.y, 0.0, -tramplingDir.x));

        // Кончик листка гнется сильнее, корень остается на месте (угол * hFactor)
        float currentAngle = maxBendAngle * hFactor;
        float cosA = cos(currentAngle);
        float sinA = sin(currentAngle);

        // Вращение сохраняет исходную евклидову длину вектора bladeOffset
        bladeOffset = bladeOffset * cosA + cross(bendAxis, bladeOffset) * sinA + bendAxis * dot(bendAxis, bladeOffset) * (1.0 - cosA);
      }

      // 3. Процедурный ветер (мягкое покачивание верхушек)
      float wave = sin(uTime * uWindSpeed + instanceRoot.x * 0.4 + instanceRoot.z * 0.3);
      vec2 windDir = vec2(0.85, 0.52);
      bladeOffset.xz += windDir * (wave * uWindStrength * (hFactor * hFactor));

      // Итоговая позиция: корень куста + жестко повернутый вектор травинки
      vec4 worldPos = vec4(instanceRoot.xyz + bladeOffset, 1.0);

      vec4 mvPosition = viewMatrix * worldPos;
      gl_Position = projectionMatrix * mvPosition;
      `
    );
  };

  return material;
}
