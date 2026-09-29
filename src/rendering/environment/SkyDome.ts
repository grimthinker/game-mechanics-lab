import * as THREE from 'three';

export interface SkyColors {
  zenith: THREE.Color;
  horizon: THREE.Color;
  haze: THREE.Color;
  sunset: THREE.Color;
  sunDisk: THREE.Color;
  moonDisk: THREE.Color;
  ambient: THREE.Color;
  sunLight: THREE.Color;
  moonLight: THREE.Color;
}

const vertexShader = `
  varying vec3 vWorldDirection;

  void main() {
    vWorldDirection = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  varying vec3 vWorldDirection;

  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uHazeColor;
  uniform vec3 uSunsetColor;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;

  void main() {
    vec3 dir = normalize(vWorldDirection);
    float h = clamp(dir.y, 0.0, 1.0);

    // 1. Базовый вертикальный градиент атмосферы (360° вокруг наблюдателя)
    float skyCurve = pow(h, 0.45);
    vec3 skyColor = mix(uHorizonColor, uZenithColor, skyCurve);

    // 2. Направленный закат/рассвет (появляется со стороны солнца)
    vec2 flatDir = normalize(dir.xz);
    vec2 flatSun = length(uSunDirection.xz) > 0.001 ? normalize(uSunDirection.xz) : vec2(1.0, 0.0);
    float sunAlignment = dot(flatDir, flatSun);
    float sunsetCone = pow(clamp(sunAlignment * 0.5 + 0.5, 0.0, 1.0), 3.0);
    float sunsetAltitude = 1.0 - smoothstep(0.0, 0.35, h);
    vec3 sunsetGlow = uSunsetColor * (sunsetCone * sunsetAltitude);
    skyColor += sunsetGlow;

    // 3. Дымка у горизонта
    float hazeFactor = 1.0 - smoothstep(0.0, 0.22, h);
    vec3 effectiveHaze = uHazeColor + uSunsetColor * (sunsetCone * 0.5);
    skyColor = mix(skyColor, effectiveHaze, hazeFactor * 0.75);

    float sunDot = dot(dir, uSunDirection);
    float moonDot = dot(dir, uMoonDirection);

    // 4. Аккуратный, уменьшенный диск солнца и ореол
    if (sunDot > 0.996) {
      float sunDiskMask = smoothstep(0.99982, 0.99990, sunDot);
      float sunGlow = pow((sunDot - 0.996) / (0.99982 - 0.996), 2.0);
      vec3 glowColor = uSunColor * sunGlow * 0.7;
      skyColor += glowColor;
      skyColor = mix(skyColor, uSunColor * 1.5, sunDiskMask);
    }

    // 5. Диск луны
    vec3 mForward = normalize(uMoonDirection);
    vec3 mUp = abs(mForward.y) > 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    vec3 mRight = normalize(cross(mUp, mForward));
    vec3 mTrueUp = cross(mForward, mRight);

    float moonAngularRadius = 0.036;
    vec3 mOffset = dir - mForward;
    vec2 moonUV = vec2(dot(mOffset, mRight), dot(mOffset, mTrueUp)) / moonAngularRadius;
    float moonDist = length(moonUV);

    float nightFactor = smoothstep(0.05, -0.2, uSunDirection.y);

    if (moonDot > 0.992 && nightFactor > 0.01) {
      float moonGlow = pow((moonDot - 0.992) / (0.99935 - 0.992), 2.5);
      skyColor += uMoonColor * moonGlow * (0.2 * nightFactor);
    }

    float moonMask = 1.0 - smoothstep(0.97, 1.0, moonDist);
    if (moonMask > 0.0) {
      float m1 = smoothstep(0.45, 0.05, length(moonUV - vec2(-0.25, 0.22)));
      float m2 = smoothstep(0.40, 0.05, length(moonUV - vec2(0.22, 0.12)));
      float m3 = smoothstep(0.35, 0.05, length(moonUV - vec2(0.18, -0.28)));
      float m4 = smoothstep(0.38, 0.05, length(moonUV - vec2(-0.15, -0.32)));
      float maria = clamp(m1 * 0.9 + m2 * 0.8 + m3 * 0.85 + m4 * 0.75, 0.0, 1.0);

      vec3 moonBaseColor = vec3(0.89, 0.92, 0.96);
      vec3 moonSeaColor = vec3(0.68, 0.72, 0.79);
      vec3 moonSurface = mix(moonBaseColor, moonSeaColor, maria * 0.5);

      float moonOpacity = mix(0.72, 0.98, nightFactor);
      skyColor = mix(skyColor, moonSurface, moonMask * moonOpacity);
    }

    gl_FragColor = vec4(skyColor, 1.0);
  }
`;

// Вершинный шейдер для стилизованных 4-конечных звёзд:
// Звезда позиционируется на небесной сфере по uCelestialRotation,
// а её лучи ориентируются строго параллельно осям экрана (View Space биллбординг).
const starVertexShader = `
  attribute vec3 aCelestialPos;
  attribute vec2 aStarScale;
  attribute float aBrightness;
  attribute float aTwinkleSpeed;

  uniform mat4 uCelestialRotation;
  uniform vec3 uMoonDir;
  uniform vec3 uSunDir;
  uniform float uStarFade;
  uniform float uTime;

  varying float vAlpha;

  void main() {
    // 1. Положение звезды на небесной сфере с учетом оси наклона и времени
    vec3 worldDir = normalize((uCelestialRotation * vec4(aCelestialPos, 0.0)).xyz);

    // 2. Плавное угасание у горизонта
    float horizonFade = smoothstep(0.02, 0.22, worldDir.y);

    // 3. Скрытие только тех звёзд, которые физически перекрываются диском луны или солнца
    float moonDot = dot(worldDir, uMoonDir);
    float moonOcclusion = 1.0 - smoothstep(0.9988, 0.9996, moonDot);

    float sunDot = dot(worldDir, uSunDir);
    float sunOcclusion = 1.0 - smoothstep(0.9995, 0.9999, sunDot);

    // 4. Индивидуальное мерцание и синхронная пульсация размера
    float wave = sin(uTime * aTwinkleSpeed + aBrightness * 117.0);
    float twinkle = 0.84 + 0.16 * wave;
    float pulse = 0.82 + 0.36 * (wave * 0.5 + 0.5); // Коэффициент изменения размера (±18% в такт мерцанию)

    float alpha = uStarFade * horizonFade * moonOcclusion * sunOcclusion * aBrightness * twinkle;
    vAlpha = alpha;

    if (alpha <= 0.001) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }

    // 5. Биллбординг в пространстве камеры (View Space):
    // Центр звезды находится на расстоянии 3500м от камеры в направлении worldDir
    vec4 viewCenter = viewMatrix * vec4(cameraPosition + worldDir * 3500.0, 1.0);

    // Смещение вершин в плоскости экрана с учетом пульсации размера
    viewCenter.xy += position.xy * aStarScale * pulse;

    gl_Position = projectionMatrix * viewCenter;

    // Гарантируем, что звёзды лежат чуть ближе дальней плоскости отсечения,
    // но строго дальше любых объектов мира (дома, деревья, рельеф), позволяя глубине их перекрывать
    gl_Position.z = min(gl_Position.z, gl_Position.w * 0.9999);
  }
`;

const starFragmentShader = `
  varying float vAlpha;

  void main() {
    if (vAlpha <= 0.005) discard;
    gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha);
  }
`;

function fastHash(seed: number, salt: number): number {
  const h = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453123;
  return h - Math.floor(h);
}

export class SkyDome {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;
  private starsMesh: THREE.Mesh;
  private starsMaterial: THREE.ShaderMaterial;

  constructor() {
    const geometry = new THREE.SphereGeometry(3500, 32, 24);

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
        uMoonDirection: { value: new THREE.Vector3(0, -1, 0) },
        uZenithColor: { value: new THREE.Color() },
        uHorizonColor: { value: new THREE.Color() },
        uHazeColor: { value: new THREE.Color() },
        uSunsetColor: { value: new THREE.Color() },
        uSunColor: { value: new THREE.Color() },
        uMoonColor: { value: new THREE.Color() },
      },
      depthWrite: false,
      depthTest: false,
      side: THREE.BackSide,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.renderOrder = -1000;
    this.mesh.userData.isSkyDome = true;
    this.mesh.userData.isSharedAsset = true;
    this.mesh.frustumCulled = false;

    // --- Построение геометрии 4-конечных звёзд по референсу ---
    // Вертикальные лучи удлинены (соотношение высоты к ширине ~1.85:1)
    const starVertices = new Float32Array([
      0.0,
      0.0,
      0.0, // 0: центр
      0.0,
      1.0,
      0.0, // 1: верхний луч
      0.18,
      0.18,
      0.0, // 2: внутренний угол (верх-право)
      1.0,
      0.0,
      0.0, // 3: правый луч
      0.18,
      -0.18,
      0.0, // 4: внутренний угол (низ-право)
      0.0,
      -1.0,
      0.0, // 5: нижний луч
      -0.18,
      -0.18,
      0.0, // 6: внутренний угол (низ-лево)
      -1.0,
      0.0,
      0.0, // 7: левый луч
      -0.18,
      0.18,
      0.0, // 8: внутренний угол (верх-лево)
    ]);

    const starIndices = new Uint16Array([
      0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5, 0, 5, 6, 0, 6, 7, 0, 7, 8, 0, 8, 1,
    ]);

    const STAR_COUNT = 2000;
    const celestialPositions = new Float32Array(STAR_COUNT * 3);
    const starScales = new Float32Array(STAR_COUNT * 2);
    const brightnesses = new Float32Array(STAR_COUNT);
    const twinkleSpeeds = new Float32Array(STAR_COUNT);

    // Равномерное сферическое распределение Фибоначчи с псевдослучайными вариациями
    for (let i = 0; i < STAR_COUNT; i++) {
      const y = 1.0 - (i / (STAR_COUNT - 1)) * 2.0;
      const radius = Math.sqrt(Math.max(0, 1.0 - y * y));
      const phi = i * 2.399963229728653;

      const jitterAngle = fastHash(i, 1) * Math.PI * 2;
      const jitterDist = fastHash(i, 2) * 0.06;
      const rawX = Math.cos(phi) * radius + Math.cos(jitterAngle) * jitterDist;
      const rawY = y + (fastHash(i, 3) - 0.5) * 0.06;
      const rawZ = Math.sin(phi) * radius + Math.sin(jitterAngle) * jitterDist;

      const len = Math.hypot(rawX, rawY, rawZ) || 1.0;
      celestialPositions[i * 3 + 0] = rawX / len;
      celestialPositions[i * 3 + 1] = rawY / len;
      celestialPositions[i * 3 + 2] = rawZ / len;

      // Определение типа пропорций (соотношения высоты к ширине):
      // 40% — вытянуты вертикально, 30% — вытянуты горизонтально, 30% — симметричные
      const randAspect = fastHash(i, 4);
      let aspect = 1.0;

      if (randAspect < 0.4) {
        aspect = 1.45 + fastHash(i, 5) * 0.75; // 1.45 .. 2.2 (вертикальные)
      } else if (randAspect < 0.7) {
        aspect = 0.45 + fastHash(i, 5) * 0.23; // 0.45 .. 0.68 (горизонтальные)
      } else {
        aspect = 0.95 + fastHash(i, 5) * 0.1; // 0.95 .. 1.05 (симметричные)
      }

      // Степенной закон распределения размеров (Power-law):
      // Чем меньше размер, тем выше шанс его встретить (большинство звёзд мелкие, крупные редки).
      let size = 3.5;
      let bright = 0.7 + fastHash(i, 8) * 0.3;

      if (i === 0) {
        // Главная крупная звезда (вертикально вытянутая в центре)
        size = 16.0;
        aspect = 1.9;
        bright = 1.0;
      } else if (i === 1) {
        // Вторая крупная звезда (горизонтальная)
        size = 13.0;
        aspect = 0.52;
        bright = 1.0;
      } else {
        // Степенная функция смещает большинство значений к минимальным размерам
        const powerFactor = Math.pow(fastHash(i, 6), 2.5);
        size = 5 + powerFactor * 10;
        bright = 0.65 + (size / 22.0) * 0.35 + fastHash(i, 7) * 0.1;
      }

      const sqrtAspect = Math.sqrt(aspect);
      const baseW = size / sqrtAspect;
      const baseH = size * sqrtAspect;

      starScales[i * 2 + 0] = baseW;
      starScales[i * 2 + 1] = baseH;
      brightnesses[i] = Math.min(1.0, bright);
      twinkleSpeeds[i] = 0.8 + fastHash(i, 9) * 2.5;
    }

    const starGeo = new THREE.InstancedBufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starVertices, 3));
    starGeo.setIndex(new THREE.BufferAttribute(starIndices, 1));
    starGeo.setAttribute(
      'aCelestialPos',
      new THREE.InstancedBufferAttribute(celestialPositions, 3)
    );
    starGeo.setAttribute('aStarScale', new THREE.InstancedBufferAttribute(starScales, 2));
    starGeo.setAttribute('aBrightness', new THREE.InstancedBufferAttribute(brightnesses, 1));
    starGeo.setAttribute('aTwinkleSpeed', new THREE.InstancedBufferAttribute(twinkleSpeeds, 1));

    this.starsMaterial = new THREE.ShaderMaterial({
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      uniforms: {
        uCelestialRotation: { value: new THREE.Matrix4() },
        uMoonDir: { value: new THREE.Vector3() },
        uSunDir: { value: new THREE.Vector3() },
        uStarFade: { value: 0.0 },
        uTime: { value: 0.0 },
      },
      transparent: true,
      depthTest: true, // Включаем тест глубины: здания, деревья и террейн перекрывают звёзды
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.starsMesh = new THREE.Mesh(starGeo, this.starsMaterial);
    this.starsMesh.renderOrder = -990;
    this.starsMesh.userData.isSkyDome = true;
    this.starsMesh.userData.isSharedAsset = true;
    this.starsMesh.frustumCulled = false;

    this.mesh.add(this.starsMesh);
  }

  public update(
    cameraPos: THREE.Vector3,
    sunDir: THREE.Vector3,
    moonDir: THREE.Vector3,
    celestialRotMatrix: THREE.Matrix4,
    colors: SkyColors,
    starFade: number
  ): void {
    this.mesh.position.copy(cameraPos);

    const u = this.material.uniforms;
    u.uSunDirection.value.copy(sunDir);
    u.uMoonDirection.value.copy(moonDir);
    u.uZenithColor.value.copy(colors.zenith);
    u.uHorizonColor.value.copy(colors.horizon);
    u.uHazeColor.value.copy(colors.haze);
    u.uSunsetColor.value.copy(colors.sunset);
    u.uSunColor.value.copy(colors.sunDisk);
    u.uMoonColor.value.copy(colors.moonDisk);

    const su = this.starsMaterial.uniforms;
    su.uCelestialRotation.value.copy(celestialRotMatrix);
    su.uMoonDir.value.copy(moonDir);
    su.uSunDir.value.copy(sunDir);
    su.uStarFade.value = starFade;
    su.uTime.value = performance.now() * 0.001;
  }

  public destroy(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.starsMesh.geometry.dispose();
    this.starsMaterial.dispose();
  }
}
