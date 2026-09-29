import * as THREE from 'three';
import { getTerrainTextures } from './proceduralTextures';
import { TERRAIN_CONFIG } from '../../config/terrainConfig';

export function createTerrainMaterial(
  splatTexture: THREE.DataTexture,
  textureTiling: number = 20
): THREE.MeshStandardMaterial {
  const textures = getTerrainTextures();

  const material = new THREE.MeshStandardMaterial({
    roughness: 0.85,
    metalness: 0.05,
    flatShading: false,
  });

  // В типах Three.js свойство defines задается на инстансе материала, а не в параметрах конструктора
  material.defines = {
    USE_UV: '', // Гарантирует объявление varying vec2 vUv во всех шейдерах Three.js
  };

  material.userData.isSharedMaterial = true;
  material.customProgramCacheKey = () => 'TerrainSplatMaterial_v9'; // Обновлен ключ кэша для рекомпиляции

  material.onBeforeCompile = (shader) => {
    shader.uniforms.tSplat = { value: splatTexture };
    shader.uniforms.tGrass = { value: textures.grass };
    shader.uniforms.tRock = { value: textures.rock };
    shader.uniforms.tDirt = { value: textures.dirt };
    shader.uniforms.tSand = { value: textures.sand };
    shader.uniforms.uTiling = { value: textureTiling };
    shader.uniforms.uSplatBlur = { value: TERRAIN_CONFIG.splatBlurFactor };

    // Проброс локальных/мировых координат и нормалей во фрагментный шейдер
    shader.vertexShader = `
      varying vec3 vTriPos;
      varying vec3 vTriNormal;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
      #include <project_vertex>
      vTriPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vTriNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      `
    );

    shader.fragmentShader = `
      uniform sampler2D tSplat;
      uniform sampler2D tGrass;
      uniform sampler2D tRock;
      uniform sampler2D tDirt;
      uniform sampler2D tSand;
      uniform float uTiling;
      uniform float uSplatBlur;
      
      varying vec3 vTriPos;
      varying vec3 vTriNormal;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>

      // 1. Координаты маски мазков кисти (Splatmap) строго недеформированы (1:1 к миру и кисти):
      // Любые дороги, тропинки и мазки кисти идут точно по прямой без волнообразных искажений.
      vec2 splatUv = vec2(vUv.x, 1.0 - vUv.y);

      // Высококачественный 5-точечный мультисэмплинг для гладких границ мазков
      vec2 texel = vec2(1.0 / 512.0) * uSplatBlur;
      vec4 splat = texture2D(tSplat, splatUv) * 0.36;
      splat += texture2D(tSplat, splatUv + vec2(texel.x, 0.0)) * 0.16;
      splat += texture2D(tSplat, splatUv - vec2(texel.x, 0.0)) * 0.16;
      splat += texture2D(tSplat, splatUv + vec2(0.0, texel.y)) * 0.16;
      splat += texture2D(tSplat, splatUv - vec2(0.0, texel.y)) * 0.16;

      vec2 tiledUv = vUv * uTiling;

      // 2. Рандомизация травы происходит ИСКЛЮЧИТЕЛЬНО внутри текстуры травы (не затрагивая маску кисти):
      // А) Микро-сдвиг UV травы для разрушения повторяемости травинок
      vec2 grassMicroWarp = vec2(
        sin(vTriPos.z * 0.45 + vTriPos.x * 0.25),
        cos(vTriPos.x * 0.45 - vTriPos.z * 0.25)
      ) * 0.08;
      vec2 warpedGrassUv = tiledUv + grassMicroWarp;

      // Б) Двухмасштабная выборка травы (поворот на 45° и масштаб 0.38x) полностью устраняет сетку тайлинга
      vec2 macroGrassUv = vec2(
        warpedGrassUv.x * 0.38 - warpedGrassUv.y * 0.38,
        warpedGrassUv.x * 0.38 + warpedGrassUv.y * 0.38
      ) + vec2(17.3, 31.7);

      vec4 colGrassDetail = texture2D(tGrass, warpedGrassUv);
      vec4 colGrassMacro  = texture2D(tGrass, macroGrassUv);
      vec4 colGrass = mix(colGrassDetail, colGrassMacro, 0.42);

      // В) Крупные разводы оттенка и влажности травы (15-30 метров)
      float macroShade = sin(vTriPos.x * 0.05) * cos(vTriPos.z * 0.05) * 0.5 + 0.5;
      float macroTint  = sin(vTriPos.x * 0.08 - vTriPos.z * 0.09) * 0.5 + 0.5;
      colGrass.rgb *= (0.86 + macroShade * 0.28);
      vec3 warmGrassTint = vec3(1.06, 1.02, 0.90);
      vec3 lushGrassTint = vec3(0.94, 1.04, 0.96);
      colGrass.rgb *= mix(lushGrassTint, warmGrassTint, macroTint);

      // Песок без деформации внешних границ
      vec4 colSand = texture2D(tSand, tiledUv);

      // === ТРИПЛАНАРНЫЙ МАППИНГ (Скала и Почва) ===
      
      // 1. Вычисляем веса смешивания осей на основе нормали
      vec3 blend = abs(vTriNormal);
      blend = pow(blend, vec3(4.0));
      blend /= dot(blend, vec3(1.0));

      // 2. Координаты для боковых проекций
      vec2 uvX = vTriPos.zy * (uTiling / 100.0);
      vec2 uvZ = vTriPos.xy * (uTiling / 100.0);

      // 3. Выборка текстур
      // Скала (Трипланар)
      vec4 cxRock = texture2D(tRock, uvX);
      vec4 cyRock = texture2D(tRock, tiledUv);
      vec4 czRock = texture2D(tRock, uvZ);
      vec4 colRock = cxRock * blend.x + cyRock * blend.y + czRock * blend.z;

      // Почва (Трипланар)
      vec4 cxDirt = texture2D(tDirt, uvX);
      vec4 cyDirt = texture2D(tDirt, tiledUv);
      vec4 czDirt = texture2D(tDirt, uvZ);
      vec4 colDirt = cxDirt * blend.x + cyDirt * blend.y + czDirt * blend.z;

      float weightSum = splat.r + splat.g + splat.b + splat.a;
      if (weightSum <= 0.0001) weightSum = 1.0;

      vec4 blendedColor = (colGrass * splat.r + colRock * splat.g + colDirt * splat.b + colSand * splat.a) / weightSum;
      diffuseColor *= blendedColor;
      `
    );
  };

  return material;
}
