import * as THREE from 'three';
import { getTerrainTextures } from './proceduralTextures';
import { TERRAIN_CONFIG } from '../../config/terrainConfig';

export function createTerrainSkirtMaterial(): THREE.MeshStandardMaterial {
  const textures = getTerrainTextures();

  const material = new THREE.MeshStandardMaterial({
    roughness: 0.88,
    metalness: 0.05,
    flatShading: false,
    side: THREE.DoubleSide,
  });

  material.defines = {
    USE_UV: '',
  };

  material.userData.isSharedMaterial = true;
  material.customProgramCacheKey = () => 'TerrainSkirtMaterial_v1';

  material.onBeforeCompile = (shader) => {
    shader.uniforms.tGrass = { value: textures.grass };
    shader.uniforms.tRock = { value: textures.rock };
    shader.uniforms.tDirt = { value: textures.dirt };
    shader.uniforms.uTiling = { value: TERRAIN_CONFIG.skirt.textureTiling };

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
      uniform sampler2D tGrass;
      uniform sampler2D tRock;
      uniform sampler2D tDirt;
      uniform float uTiling;

      varying vec3 vTriPos;
      varying vec3 vTriNormal;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>

      vec3 blend = abs(vTriNormal);
      blend = pow(blend, vec3(4.0));
      blend /= dot(blend, vec3(1.0));

      vec2 uvPlanar = vTriPos.xz * (uTiling / 1000.0);
      vec2 uvSideX  = vTriPos.zy * (uTiling / 1000.0);
      vec2 uvSideZ  = vTriPos.xy * (uTiling / 1000.0);

      vec4 colGrass = texture2D(tGrass, uvPlanar);
      vec4 cxDirt = texture2D(tDirt, uvSideX);
      vec4 cyDirt = texture2D(tDirt, uvPlanar);
      vec4 czDirt = texture2D(tDirt, uvSideZ);
      vec4 colDirt = cxDirt * blend.x + cyDirt * blend.y + czDirt * blend.z;

      vec4 cxRock = texture2D(tRock, uvSideX);
      vec4 cyRock = texture2D(tRock, uvPlanar);
      vec4 czRock = texture2D(tRock, uvSideZ);
      vec4 colRock = cxRock * blend.x + cyRock * blend.y + czRock * blend.z;

      float slope = 1.0 - clamp(vTriNormal.y, 0.0, 1.0);
      float rockWeight = smoothstep(0.18, 0.45, slope);

      float dirtMacro = sin(vTriPos.x * 0.012) * cos(vTriPos.z * 0.012) * 0.5 + 0.5;
      float dirtWeight = (1.0 - rockWeight) * smoothstep(0.4, 0.7, dirtMacro) * 0.5;
      float grassWeight = max(0.0, 1.0 - rockWeight - dirtWeight);

      // Бесшовное слияние с активной картой: первые 55 метров от края — чистая трава
      float distFromEdge = vUv.y;
      float borderGrassFactor = 1.0 - smoothstep(0.0, 55.0, distFromEdge);
      grassWeight = mix(grassWeight, 1.0, borderGrassFactor);
      dirtWeight *= (1.0 - borderGrassFactor);
      rockWeight *= (1.0 - borderGrassFactor);

      float totalWeight = rockWeight + dirtWeight + grassWeight;
      if (totalWeight <= 0.0001) totalWeight = 1.0;

      vec4 blendedColor = (colRock * rockWeight + colDirt * dirtWeight + colGrass * grassWeight) / totalWeight;
      diffuseColor *= blendedColor;
      `
    );
  };

  return material;
}
