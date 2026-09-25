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
  material.customProgramCacheKey = () => 'InteractiveGrassMaterial_v2';

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
      float maxTrampleFactor = 0.0;

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

          if (factor > maxTrampleFactor) {
            maxTrampleFactor = factor;
            tramplingDir = pushDir;
          }
        }
      }

      // 2. Квадратичный изгиб консоли с пифагоровым сохранением длины (Pythagorean Length Preservation)
      float origY = max(0.001, bladeOffset.y);

      // Квадратичный спад жесткости: у основания травинка жесткая (0.0), к верхушке изгиб нарастает (1.0)
      float bendCurve = hFactor * hFactor;

      // Горизонтальное смещение от приминания
      float trampleDistance = origY * bendCurve * maxTrampleFactor * 0.95;
      vec2 trampleVec = tramplingDir * trampleDistance;

      // Процедурный ветер с плавной фазой
      float wave = sin(uTime * uWindSpeed + instanceRoot.x * 0.4 + instanceRoot.z * 0.3);
      vec2 windVec = vec2(0.85, 0.52) * (wave * uWindStrength * bendCurve * origY);

      // Суммарный вектор горизонтального отклонения
      vec2 totalPush = trampleVec + windVec;
      float pushDist = length(totalPush);

      // Контролируемое сжатие стебля под нагрузкой (до 15% укорочения при полном приминании, без растяжения)
      float compression = 1.0 - (0.15 * maxTrampleFactor * hFactor);
      float maxAllowedRadius = origY * compression;

      // Ограничение смещения в пределах допустимой длины
      if (pushDist > maxAllowedRadius * 0.96) {
        totalPush = (totalPush / pushDist) * (maxAllowedRadius * 0.96);
        pushDist = maxAllowedRadius * 0.96;
      }

      // Новая высота Y по теореме Пифагора: Y^2 + pushDist^2 = maxAllowedRadius^2
      float newY = sqrt(max(0.001, maxAllowedRadius * maxAllowedRadius - pushDist * pushDist));

      // Применяем смещение: сдвиг по горизонтали и опускание верхушки без растягивания гипотенузы
      bladeOffset.xz += totalPush;
      bladeOffset.y = newY;

      // Итоговая позиция: корень куста + жестко повернутый вектор травинки
      vec4 worldPos = vec4(instanceRoot.xyz + bladeOffset, 1.0);

      vec4 mvPosition = viewMatrix * worldPos;
      gl_Position = projectionMatrix * mvPosition;
      `
    );
  };

  return material;
}
