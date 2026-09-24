import * as THREE from 'three';
import { getTerrainTextures } from './proceduralTextures';

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
  material.customProgramCacheKey = () => 'TerrainSplatMaterial_v5';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.tSplat = { value: splatTexture };
    shader.uniforms.tGrass = { value: textures.grass };
    shader.uniforms.tRock = { value: textures.rock };
    shader.uniforms.tDirt = { value: textures.dirt };
    shader.uniforms.tSand = { value: textures.sand };
    shader.uniforms.uTiling = { value: textureTiling };

    shader.fragmentShader = `
      uniform sampler2D tSplat;
      uniform sampler2D tGrass;
      uniform sampler2D tRock;
      uniform sampler2D tDirt;
      uniform sampler2D tSand;
      uniform float uTiling;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>

      vec2 baseUv = vec2(vUv.x, 1.0 - vUv.y);

      // Органический микро-шум для разбиения пиксельных ступеней растра
      float jitter = (sin(vUv.x * 250.0) * cos(vUv.y * 250.0)) * 0.0025;
      vec2 splatUv = baseUv + vec2(jitter, -jitter);

      // 5-точечный мультисэмплинг: расширяет физическое размытие на ~1 метр вокруг границы
      vec2 texel = vec2(1.0 / 512.0) * 1.8;
      vec4 splat = texture2D(tSplat, splatUv) * 0.36;
      splat += texture2D(tSplat, splatUv + vec2(texel.x, 0.0)) * 0.16;
      splat += texture2D(tSplat, splatUv - vec2(texel.x, 0.0)) * 0.16;
      splat += texture2D(tSplat, splatUv + vec2(0.0, texel.y)) * 0.16;
      splat += texture2D(tSplat, splatUv - vec2(0.0, texel.y)) * 0.16;

      vec2 tiledUv = vUv * uTiling;

      vec4 colGrass = texture2D(tGrass, tiledUv);
      vec4 colRock  = texture2D(tRock, tiledUv);
      vec4 colDirt  = texture2D(tDirt, tiledUv);
      vec4 colSand  = texture2D(tSand, tiledUv);

      float weightSum = splat.r + splat.g + splat.b + splat.a;
      if (weightSum <= 0.0001) weightSum = 1.0;

      vec4 blendedColor = (colGrass * splat.r + colRock * splat.g + colDirt * splat.b + colSand * splat.a) / weightSum;
      diffuseColor *= blendedColor;
      `
    );
  };

  return material;
}
