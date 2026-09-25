import * as THREE from 'three';

export interface GrassMaterialUniforms {
  uTime: { value: number };
  uWindSpeed: { value: number };
  uWindStrength: { value: number };
  uTrampleMap: { value: THREE.Texture | null };
  uTerrainSize: { value: number };
}

export function createGrassMaterial(): THREE.MeshStandardMaterial {
  const defaultTrampleTexture = new THREE.DataTexture(new Uint8Array([0, 128, 128, 255]), 1, 1);
  defaultTrampleTexture.needsUpdate = true;

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
  material.customProgramCacheKey = () => 'InteractiveGrassMaterial_v4';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWindSpeed = { value: 1.8 };
    shader.uniforms.uWindStrength = { value: 0.14 };
    shader.uniforms.uTrampleMap = { value: defaultTrampleTexture };
    shader.uniforms.uTerrainSize = { value: 100.0 };

    material.userData.shader = shader;

    shader.vertexShader = `
      uniform float uTime;
      uniform float uWindSpeed;
      uniform float uWindStrength;
      uniform sampler2D uTrampleMap;
      uniform float uTerrainSize;
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

      // Вектор от корня пучка к текущей вершине
      vec3 bladeOffset = baseWorldPos.xyz - instanceRoot.xyz;

      // uv.y строго 0.0 у корня и 1.0 на кончике (корень всегда неподвижен)
      float hFactor = uv.y;

      // 1. Считывание примятости и направления из Trample Texture
      vec2 trampleUv = (instanceRoot.xz + uTerrainSize * 0.5) / uTerrainSize;
      vec4 trampleSample = texture2D(uTrampleMap, trampleUv);

      float maxTrampleFactor = trampleSample.r;
      vec2 decodedDir = trampleSample.gb * 2.0 - 1.0;
      float dirLen = length(decodedDir);
      vec2 tramplingDir = dirLen > 0.01 ? decodedDir / dirLen : vec2(0.0, 1.0);

      // 2. Изгиб по дуге с сохранением длины (Arc-Length Preserving Bending)
      float origY = max(0.001, bladeOffset.y);

      // Угол изгиба от давления (max ~85 градусов или 1.5 радиан)
      float trampleAngle = maxTrampleFactor * 1.5;
      vec2 trampleVec = tramplingDir * trampleAngle;

      // Процедурный ветер
      float wave = sin(uTime * uWindSpeed + instanceRoot.x * 0.4 + instanceRoot.z * 0.3);
      vec2 windVec = vec2(0.85, 0.52) * (wave * uWindStrength * 0.6);

      // Суммарный вектор изгиба (объединяет ветер и наступание)
      vec2 totalBendVec = trampleVec + windVec;
      float bendAngle = length(totalBendVec);
      vec2 bendDir = bendAngle > 0.001 ? totalBendVec / bendAngle : vec2(0.0, 1.0);

      // Ограничиваем угол, чтобы трава не уходила под землю
      bendAngle = clamp(bendAngle, 0.001, 1.55);

      // Угол наклона конкретно для этой вершины (от 0 до bendAngle)
      float currentAngle = bendAngle * hFactor;

      float forwardOffset;
      float newY;

      // Вычисление координат на дуге окружности
      if (currentAngle < 0.01) {
        // Аппроксимация Тейлора для микро-углов (предотвращает деление на ноль)
        forwardOffset = origY * currentAngle * 0.5;
        newY = origY;
      } else {
        // Точный расчет радиуса кривизны: длина дуги (origY) = Радиус * Угол
        float radius = origY / currentAngle; 
        forwardOffset = radius * (1.0 - cos(currentAngle));
        newY = radius * sin(currentAngle);
      }

      // Легкое приплюскивание стебля под тяжестью существа (макс 10% укорочения, без растяжения)
      float compression = 1.0 - (0.1 * maxTrampleFactor * hFactor);

      // Применяем новые координаты
      bladeOffset.xz += bendDir * (forwardOffset * compression);
      bladeOffset.y = newY * compression;

      // Итоговая позиция: корень куста + скорректированный по дуге вектор травинки
      vec4 worldPos = vec4(instanceRoot.xyz + bladeOffset, 1.0);

      vec4 mvPosition = viewMatrix * worldPos;
      gl_Position = projectionMatrix * mvPosition;
      `
    );
  };

  return material;
}
