import * as THREE from 'three';
import { WaterComponent } from '../../ecs/components/water';

export function createWaterMaterial(comp: WaterComponent): THREE.ShaderMaterial {
  const baseColor = new THREE.Color(comp.color || '#2980b9');
  const deepColor = baseColor.clone().multiplyScalar(0.65);

  const flowDir = new THREE.Vector2(comp.flowDirection?.x ?? 0, comp.flowDirection?.z ?? 0);
  if (flowDir.lengthSq() > 0.001) {
    flowDir.normalize();
  }

  const material = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib['fog'],
      {
        uTime: { value: 0 },
        uColor: { value: baseColor },
        uDeepColor: { value: deepColor },
        uOpacity: { value: comp.opacity ?? 0.8 },
        uWaveSpeed: { value: comp.waveSpeed ?? 1.2 },
        uWaveHeight: { value: comp.waveHeight ?? 0.12 },
        uFlowDirection: { value: flowDir },
        uFlowSpeed: { value: comp.flowSpeed ?? 0.0 },
        // Юниформы динамического освещения сцены
        uSunDirection: { value: new THREE.Vector3(0.5, 0.8, 0.3).normalize() },
        uSunColor: { value: new THREE.Color(1.0, 0.95, 0.85) },
        uAmbientColor: { value: new THREE.Color(0.25, 0.3, 0.4) },
      },
    ]),
    vertexShader: `
      #include <fog_pars_vertex>

      uniform float uTime;
      uniform float uWaveSpeed;
      uniform float uWaveHeight;
      uniform vec2 uFlowDirection;
      uniform float uFlowSpeed;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying float vWaveHeight;

      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        
        // Вектор течения реки и фазовый сдвиг волн
        vec2 flow = uFlowDirection * (uFlowSpeed * uTime * 0.5);
        vec2 p = worldPos.xz * 0.4 + flow;
        
        // Органическая деформация геометрии: наложение разнонаправленных непараллельных волн
        float w1 = sin(p.x * 1.2 + uTime * uWaveSpeed) * cos(p.y * 1.1 + uTime * uWaveSpeed * 0.8);
        float w2 = sin(p.x * 0.8 - p.y * 1.3 + uTime * uWaveSpeed * 1.1) * 0.6;
        float w3 = cos(p.x * 1.5 + p.y * 0.7 - uTime * uWaveSpeed * 0.9) * 0.4;
        
        float totalWave = (w1 + w2 + w3) * uWaveHeight * 0.6;

        vec3 transformed = position;
        transformed.y += totalWave;

        vWaveHeight = totalWave;
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

        vec3 waveNormal = normalize(vec3(-dH_dx, 1.0, -dH_dz));
        vNormal = normalize((modelMatrix * vec4(waveNormal, 0.0)).xyz);
        
        vec4 mvPosition = viewMatrix * vec4(vWorldPosition, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <fog_pars_fragment>

      uniform vec3 uColor;
      uniform vec3 uDeepColor;
      uniform float uOpacity;
      uniform float uTime;
      uniform vec2 uFlowDirection;
      uniform float uFlowSpeed;
      uniform float uWaveHeight;

      uniform vec3 uSunDirection;
      uniform vec3 uSunColor;
      uniform vec3 uAmbientColor;

      varying vec2 vUv;
      varying vec3 vWorldPosition;
      varying vec3 vNormal;
      varying float vWaveHeight;

      void main() {
        // Градиент глубины: впадины темнее, гребни светлее
        float hFactor = clamp((vWaveHeight / max(0.01, uWaveHeight)) * 0.5 + 0.5, 0.0, 1.0);
        vec3 waterBase = mix(uDeepColor, uColor, hFactor);

        // Сдвиг координат для течения (учитываем скорость реки)
        vec2 flowOffset = uFlowDirection * uFlowSpeed * uTime * 0.5;
        vec2 p = (vWorldPosition.xz + flowOffset) * 0.8; 

        float t = uTime * 0.6;

        // Генератор каустики: наложение волн под разными углами
        float wave1 = sin(p.x + t) * cos(p.y - t);
        float wave2 = sin(p.x * 0.7 - p.y * 1.3 + t * 1.2) * cos(p.y * 0.8 + p.x * 1.1 - t * 0.9);
        float wave3 = sin(p.x * 1.5 + p.y * 0.5 - t * 1.4) * cos(p.y * 1.2 - p.x * 0.6 + t * 1.1);

        float ripple = wave1 + wave2 + wave3;
        float highlights = smoothstep(1.0, 1.8, abs(ripple));
        float foamMask = highlights * smoothstep(-0.02, 0.05, vWaveHeight);

        // Пена на гребнях
        waterBase += vec3(0.5, 0.7, 0.9) * foamMask;

        // --- ДИНАМИЧЕСКИЙ РАСЧЕТ ОСВЕЩЕНИЯ (ДЕНЬ / НОЧЬ / БЛЕСК) ---
        vec3 N = normalize(vNormal);
        if (!gl_FrontFacing) N = -N;

        // 1. Рассеянный направленный свет (солнце / луна)
        float NdotL = max(0.0, dot(N, uSunDirection));
        vec3 diffuseLight = uSunColor * NdotL;

        // 2. Окружающий свет (ambient)
        vec3 totalLight = uAmbientColor + diffuseLight;

        // 3. Зеркальный блик на волнах (Specular Blinn-Phong)
        vec3 V = normalize(cameraPosition - vWorldPosition);
        vec3 H = normalize(uSunDirection + V);
        float NdotH = max(0.0, dot(N, H));
        float specFactor = pow(NdotH, 64.0);
        vec3 specular = uSunColor * (specFactor * 0.85);

        // Итоговый цвет воды с учетом освещения и бликов
        vec3 finalColor = waterBase * totalLight + specular;

        gl_FragColor = vec4(finalColor, uOpacity);
        
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  material.userData.isSharedMaterial = true;
  return material;
}
