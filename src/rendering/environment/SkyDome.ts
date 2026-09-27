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
  varying vec3 vCelestialCoords;
  uniform mat4 uCelestialRotation;

  void main() {
    vWorldDirection = position;
    vCelestialCoords = (uCelestialRotation * vec4(position, 0.0)).xyz;

    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  varying vec3 vWorldDirection;
  varying vec3 vCelestialCoords;

  uniform vec3 uSunDirection;
  uniform vec3 uMoonDirection;
  uniform vec3 uZenithColor;
  uniform vec3 uHorizonColor;
  uniform vec3 uHazeColor;
  uniform vec3 uSunsetColor;
  uniform vec3 uSunColor;
  uniform vec3 uMoonColor;
  uniform float uStarFade;

  float hash31(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yzx + 33.33);
    return fract((p.x + p.y) * p.z);
  }

  void main() {
    vec3 dir = normalize(vWorldDirection);
    float h = clamp(dir.y, 0.0, 1.0);

    // 1. Базовый вертикальный градиент атмосферы (360° вокруг наблюдателя)
    float skyCurve = pow(h, 0.45);
    vec3 skyColor = mix(uHorizonColor, uZenithColor, skyCurve);

    // 2. Направленный закат/рассвет (появляется СТРОГО со стороны солнца)
    vec2 flatDir = normalize(dir.xz);
    vec2 flatSun = length(uSunDirection.xz) > 0.001 ? normalize(uSunDirection.xz) : vec2(1.0, 0.0);
    float sunAlignment = dot(flatDir, flatSun); // +1 прямо на солнце, -1 в противоположную сторону
    float sunsetCone = pow(clamp(sunAlignment * 0.5 + 0.5, 0.0, 1.0), 3.0);
    float sunsetAltitude = 1.0 - smoothstep(0.0, 0.35, h);
    vec3 sunsetGlow = uSunsetColor * (sunsetCone * sunsetAltitude);
    skyColor += sunsetGlow;

    // 3. Дымка у горизонта (мягкое слияние с туманом сцены)
    float hazeFactor = 1.0 - smoothstep(0.0, 0.22, h);
    vec3 effectiveHaze = uHazeColor + uSunsetColor * (sunsetCone * 0.5);
    skyColor = mix(skyColor, effectiveHaze, hazeFactor * 0.75);

    float sunDot = dot(dir, uSunDirection);
    float moonDot = dot(dir, uMoonDirection);

    // 4. Процедурные звезды (рисуются СТРОГО под светилами и не перекрывают их)
    if (uStarFade > 0.01 && dir.y > 0.02 && sunDot < 0.998 && moonDot < 0.998) {
      vec3 starDir = normalize(vCelestialCoords);
      vec3 grid = floor(starDir * 180.0);
      float rnd = hash31(grid);
      if (rnd > 0.988) {
        float brightness = pow((rnd - 0.988) / (1.0 - 0.988), 3.0);
        skyColor += vec3(brightness * uStarFade * smoothstep(0.02, 0.25, dir.y));
      }
    }

    // 3. Диск солнца и ореол
    if (sunDot > 0.985) {
      float sunDiskMask = smoothstep(0.99915, 0.99935, sunDot);
      float sunGlow = pow((sunDot - 0.985) / (0.9992 - 0.985), 2.0);
      vec3 glowColor = uSunColor * sunGlow * 0.8;
      skyColor += glowColor;
      skyColor = mix(skyColor, uSunColor * 1.5, sunDiskMask);
    }

    // 4. Диск луны: построение локального 2D-базиса для устранения муарной сетки
    vec3 mForward = normalize(uMoonDirection);
    vec3 mUp = abs(mForward.y) > 0.99 ? vec3(0.0, 0.0, 1.0) : vec3(0.0, 1.0, 0.0);
    vec3 mRight = normalize(cross(mUp, mForward));
    vec3 mTrueUp = cross(mForward, mRight);

    // Угловой радиус луны (~2 градуса)
    float moonAngularRadius = 0.036;
    vec3 mOffset = dir - mForward;
    vec2 moonUV = vec2(dot(mOffset, mRight), dot(mOffset, mTrueUp)) / moonAngularRadius;
    float moonDist = length(moonUV);

    float nightFactor = smoothstep(0.05, -0.2, uSunDirection.y);

    // Ночное деликатное свечение строго снаружи диска луны
    if (moonDot > 0.992 && nightFactor > 0.01) {
      float moonGlow = pow((moonDot - 0.992) / (0.99935 - 0.992), 2.5);
      skyColor += uMoonColor * moonGlow * (0.2 * nightFactor);
    }

    // Четкая, графичная граница диска луны без размытия
    float moonMask = 1.0 - smoothstep(0.97, 1.0, moonDist);
    if (moonMask > 0.0) {
      // Крупные, плавные лунные моря (темные пятна) без высокочастотного шума
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

export class SkyDome {
  public mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

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
        uStarFade: { value: 0.0 },
        uCelestialRotation: { value: new THREE.Matrix4() },
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
    u.uCelestialRotation.value.copy(celestialRotMatrix);
    u.uZenithColor.value.copy(colors.zenith);
    u.uHorizonColor.value.copy(colors.horizon);
    u.uHazeColor.value.copy(colors.haze);
    u.uSunsetColor.value.copy(colors.sunset);
    u.uSunColor.value.copy(colors.sunDisk);
    u.uMoonColor.value.copy(colors.moonDisk);
    u.uStarFade.value = starFade;
  }

  public destroy(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
