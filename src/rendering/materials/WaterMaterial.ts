import * as THREE from 'three';
import { WaterComponent } from '../../ecs/components/water';
import { GRAPHICS_CONFIG } from '../../config/graphicsConfig';

export function createWaterMaterial(
  comp: WaterComponent,
  rippleTexture?: THREE.Texture | null
): THREE.ShaderMaterial {
  const baseColor = new THREE.Color(comp.color || '#3498db');
  const deepColor = new THREE.Color(comp.deepColor || '#0b3954');

  const flowDir = new THREE.Vector2(comp.flowDirection?.x ?? 0, comp.flowDirection?.z ?? 0);
  if (flowDir.lengthSq() > 0.001) {
    flowDir.normalize();
  }

  const defaultRippleTex = new THREE.DataTexture(
    new Float32Array([0, 0, 0, 1]),
    1,
    1,
    THREE.RGBAFormat,
    THREE.FloatType
  );
  defaultRippleTex.needsUpdate = true;

  const rippleRes = GRAPHICS_CONFIG.water.ripples.resolution;

  const waterUniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib['lights'],
    THREE.UniformsLib['fog'],
    {
      receiveShadow: { value: true },
      uTime: { value: 0 },
      // Цвета мелководья и глубины
      uColor: { value: baseColor },
      uDeepColor: { value: deepColor },
      // Прозрачность у берега и на глубине
      uOpacity: { value: comp.opacity ?? 0.88 },
      uShallowOpacity: { value: comp.shallowOpacity ?? 0.25 },
      uClarity: { value: comp.clarity ?? 2.5 },
      // Параметры волн и течения
      uWaveSpeed: { value: comp.waveSpeed ?? 1.2 },
      uWaveHeight: { value: comp.waveHeight ?? 0.12 },
      uFlowDirection: { value: flowDir },
      uFlowSpeed: { value: comp.flowSpeed ?? 0.0 },
      // Интерактивная рябь: инициализируем null для предотвращения попытки клонирования RenderTarget текстуры
      tRipple: { value: null },
      uRippleTexel: { value: new THREE.Vector2(1.0 / rippleRes, 1.0 / rippleRes) },
      uRippleDisplacement: { value: GRAPHICS_CONFIG.water.ripples.displacementScale },
      // Освещение
      uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
      uSunColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
      uAmbientColor: { value: new THREE.Color(0.25, 0.3, 0.4) },
      // Глубина сцены
      tDepth: { value: null },
      uCameraNear: { value: 0.1 },
      uCameraFar: { value: 1000.0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    },
  ]);

  // Присваиваем текстуру напрямую по ссылке в обход cloneUniforms
  waterUniforms.tRipple.value = rippleTexture || defaultRippleTex;

  const material = new THREE.ShaderMaterial({
    lights: true, // Включаем прием теней от источников света Three.js
    fog: true,
    uniforms: waterUniforms,
    vertexShader: `
    #include <common>
    #include <fog_pars_vertex>
    #include <shadowmap_pars_vertex>

    uniform float uTime;
    uniform float uWaveSpeed;
    uniform float uWaveHeight;
    uniform vec2 uFlowDirection;
    uniform float uFlowSpeed;
    uniform sampler2D tRipple;
    uniform float uRippleDisplacement;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;
    varying float vWaveHeight;

    void main() {
      vUv = uv;
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      
      vec2 flow = uFlowDirection * (uFlowSpeed * uTime * 0.5);
      vec2 p = worldPos.xz * 0.4 + flow;
      
      // Органическая деформация геометрии: наложение непараллельных волн
      float w1 = sin(p.x * 1.2 + uTime * uWaveSpeed) * cos(p.y * 1.1 + uTime * uWaveSpeed * 0.8);
      float w2 = sin(p.x * 0.8 - p.y * 1.3 + uTime * uWaveSpeed * 1.1) * 0.6;
      float w3 = cos(p.x * 1.5 + p.y * 0.7 - uTime * uWaveSpeed * 0.9) * 0.4;
      
      float totalWave = (w1 + w2 + w3) * uWaveHeight * 0.6;

      // Смещение вершин от интерактивных расходящихся волн
      float rippleSample = texture2D(tRipple, uv).r;
      float rippleHeight = rippleSample * uRippleDisplacement;

      vec3 transformed = position;
      transformed.y += totalWave + rippleHeight;

      vWaveHeight = totalWave + rippleHeight;
      vWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;

      // Аналитическое вычисление нормалей волн для честного отражения света
      float dw1_dx = 1.2 * cos(p.x * 1.2 + uTime * uWaveSpeed) * cos(p.y * 1.1 + uTime * uWaveSpeed * 0.8);
      float dw1_dz = -1.1 * sin(p.x * 1.2 + uTime * uWaveSpeed) * sin(p.y * 1.1 + uTime * uWaveSpeed * 0.8);

      float dw2_dx = 0.8 * cos(p.x * 0.8 - p.y * 1.3 + uTime * uWaveSpeed * 1.1) * 0.6;
      float dw2_dz = -1.3 * cos(p.x * 0.8 - p.y * 1.3 + uTime * uWaveSpeed * 1.1) * 0.6;

      float dw3_dx = -1.5 * sin(p.x * 1.5 + p.y * 0.7 - uTime * uWaveSpeed * 0.9) * 0.4;
      float dw3_dz = -0.7 * sin(p.x * 1.5 + p.y * 0.7 - uTime * uWaveSpeed * 0.9) * 0.4;

      float dH_dx = (dw1_dx + dw2_dx + dw3_dx) * (uWaveHeight * 0.6 * 0.4);
      float dH_dz = (dw1_dz + dw2_dz + dw3_dz) * (uWaveHeight * 0.6 * 0.4);

      vec3 objectNormal = normalize(vec3(-dH_dx, 1.0, -dH_dz));
      vNormal = normalize((modelMatrix * vec4(objectNormal, 0.0)).xyz);
      
      vec3 transformedNormal = normalize(normalMatrix * objectNormal);
      vec4 worldPosition = vec4(vWorldPosition, 1.0);
      
      vec4 mvPosition = viewMatrix * worldPosition;
      gl_Position = projectionMatrix * mvPosition;
      
      #include <shadowmap_vertex>
      #include <fog_vertex>
    }
  `,
    fragmentShader: `
    #include <common>
    #include <packing>
    uniform bool receiveShadow;
    #include <fog_pars_fragment>
    #include <shadowmap_pars_fragment>
    #include <shadowmask_pars_fragment>

      uniform vec3 uColor;
      uniform vec3 uDeepColor;
      uniform float uOpacity;
      uniform float uShallowOpacity;
      uniform float uClarity;

      uniform float uTime;
      uniform vec2 uFlowDirection;
      uniform float uFlowSpeed;
      uniform float uWaveHeight;

      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;

      uniform sampler2D tDepth;
      uniform float uCameraNear;
      uniform float uCameraFar;
      uniform vec2 uResolution;

      uniform sampler2D tRipple;
      uniform vec2 uRippleTexel;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying float vWaveHeight;

      float readLinearDepth(sampler2D depthSampler, vec2 coord) {
        float rawDepth = texture2D(depthSampler, coord).r;
        return (uCameraNear * uCameraFar) / (uCameraFar - rawDepth * (uCameraFar - uCameraNear));
      }

      float getLinearDepthFromFragCoord(float fragCoordZ) {
        return (uCameraNear * uCameraFar) / (uCameraFar - fragCoordZ * (uCameraFar - uCameraNear));
      }

      void main() {
        // --- 1. РАСЧЕТ ТОЛЩИНЫ ВОДЫ (DEPTH) И ПОГЛОЩЕНИЯ СВЕТА ---
        float waterDepth = 2.0;
        if (uResolution.x > 10.0) {
          vec2 screenUv = gl_FragCoord.xy / uResolution;
          float sceneDepth = readLinearDepth(tDepth, screenUv);
          float surfaceDepth = getLinearDepthFromFragCoord(gl_FragCoord.z);
          waterDepth = max(0.0, sceneDepth - surfaceDepth);
        }

        // Нормализованный коэффициент глубины от 0.0 (кромка берега) до 1.0 (на дистанции uClarity)
        float depthRatio = clamp(waterDepth / max(0.1, uClarity), 0.0, 1.0);
        float absorption = 1.0 - exp(-depthRatio * 2.8);

        // Градиент цвета: у берега - uColor, на глубине - uDeepColor
        vec3 waterBase = mix(uColor, uDeepColor, absorption);

        // Игра светотени на гребнях волн
        float hFactor = clamp((vWaveHeight / max(0.01, uWaveHeight)) * 0.5 + 0.5, 0.0, 1.0);
        waterBase = mix(waterBase * 0.92, waterBase * 1.12, hFactor);

        // Градиент прозрачности: у берега - uShallowOpacity, на глубине - uOpacity
        float dynamicOpacity = mix(uShallowOpacity, uOpacity, absorption);

        // --- 2. ГЕНЕРАТОР КАУСТИКИ, БЕРЕГОВОЙ И КИЛЬВАТЕРНОЙ ПЕНЫ ---
        vec2 flowOffset = uFlowDirection * uFlowSpeed * uTime * 0.5;
        vec2 p = (vWorldPosition.xz + flowOffset) * 0.8; 
        float t = uTime * 0.6;

        float wave1 = sin(p.x + t) * cos(p.y - t);
        float wave2 = sin(p.x * 0.7 - p.y * 1.3 + t * 1.2) * cos(p.y * 0.8 + p.x * 1.1 - t * 0.9);
        float wave3 = sin(p.x * 1.5 + p.y * 0.5 - t * 1.4) * cos(p.y * 1.2 - p.x * 0.6 + t * 1.1);
        float ripple = wave1 + wave2 + wave3;
        float highlights = smoothstep(1.0, 1.8, abs(ripple));

        float waveFoam = highlights * smoothstep(-0.02, 0.05, vWaveHeight);
        float shoreFoam = smoothstep(${GRAPHICS_CONFIG.water.shoreFoamDistance.toFixed(2)}, 0.02, waterDepth);

        // Расчет нормалей и пены от интерактивной ряби
        float rL = texture2D(tRipple, vUv - vec2(uRippleTexel.x, 0.0)).r;
        float rR = texture2D(tRipple, vUv + vec2(uRippleTexel.x, 0.0)).r;
        float rD = texture2D(tRipple, vUv - vec2(0.0, uRippleTexel.y)).r;
        float rU = texture2D(tRipple, vUv + vec2(0.0, uRippleTexel.y)).r;
        float rCenter = texture2D(tRipple, vUv).r;

        vec3 rippleNormal = vec3(-(rR - rL) * 2.8, 0.0, (rU - rD) * 2.8);
        
        // Мягкая пена на гребне волны: объединяем высоту волны и наклон склона, устраняя провал/дырку в центре
        float wavePeak = max(0.0, rCenter);
        float waveSlope = length(vec2(rR - rL, rU - rD));
        float waveEnergy = wavePeak * 0.65 + waveSlope * 0.35;
        float wakeFoam = smoothstep(${GRAPHICS_CONFIG.water.ripples.foamThreshold.toFixed(2)}, 0.16, waveEnergy) * 0.35;

        float totalFoam = clamp(max(waveFoam, shoreFoam * 0.85) + wakeFoam * 0.5, 0.0, 0.85);
        // Мягкое смешивание цвета пены без аддитивного пересвета
        waterBase = mix(waterBase, vec3(0.85, 0.95, 1.0), totalFoam);

        // --- 3. ДИНАМИЧЕСКИЙ РАСЧЕТ ОСВЕЩЕНИЯ И ТЕНЕЙ (SHADOW MAP) ---
        vec3 perturbedN = normalize(vNormal + rippleNormal);
        vec3 N = normalize(perturbedN);
        if (!gl_FrontFacing) N = -N;

        float shadow = 1.0;
        #ifdef USE_SHADOWMAP
          shadow = getShadowMask();
        #endif

        float NdotL = max(0.0, dot(N, uSunDirection));
        vec3 diffuseLight = uSunColor * NdotL * shadow;
        vec3 totalLight = uAmbientColor + diffuseLight;

        vec3 V = normalize(cameraPosition - vWorldPosition);
        vec3 H = normalize(uSunDirection + V);
        float NdotH = max(0.0, dot(N, H));
        float specFactor = pow(NdotH, 64.0);
        vec3 specular = uSunColor * (specFactor * 0.85) * shadow;

        vec3 finalColor = waterBase * totalLight + specular;

        gl_FragColor = vec4(finalColor, dynamicOpacity);
        
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  material.userData.isSharedMaterial = true;
  material.customProgramCacheKey = () => 'WaterShaderMaterial_v9';
  return material;
}
