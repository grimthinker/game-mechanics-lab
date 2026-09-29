import * as THREE from 'three';
import { GRAPHICS_CONFIG } from '../../config/graphicsConfig';

export interface WaterDisturbance {
  x: number;
  z: number;
  radius: number;
  strength: number;
}

export class WaterRippleManager {
  public readonly resolution: number;
  private width: number;
  private depth: number;

  private readTarget: THREE.WebGLRenderTarget;
  private writeTarget: THREE.WebGLRenderTarget;
  private simScene: THREE.Scene;
  private simCamera: THREE.OrthographicCamera;
  private simMaterial: THREE.ShaderMaterial;
  private quadMesh: THREE.Mesh;

  private disturbancesUniform: THREE.Vector4[];

  // Оптимизация: фиксированный шаг симуляции и спящий режим
  private simAccumulator: number = 0;
  private activityTimer: number = 0;
  private isSleeping: boolean = false;

  constructor(
    resolution: number = GRAPHICS_CONFIG.water.ripples.resolution,
    width: number = 20,
    depth: number = 20
  ) {
    this.resolution = resolution;
    this.width = width;
    this.depth = depth;

    const options: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.HalfFloatType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    };

    this.readTarget = new THREE.WebGLRenderTarget(resolution, resolution, options);
    this.writeTarget = new THREE.WebGLRenderTarget(resolution, resolution, options);

    this.disturbancesUniform = Array.from({ length: 32 }, () => new THREE.Vector4(0, 0, 0, 0));

    this.simScene = new THREE.Scene();
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const aspect = width / Math.max(0.1, depth);

    this.simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tPrev: { value: this.readTarget.texture },
        uTexelSize: { value: new THREE.Vector2(1.0 / resolution, 1.0 / resolution) },
        uDamping: { value: GRAPHICS_CONFIG.water.ripples.damping },
        uWaveSpeedSq: { value: 0.5 },
        uAspect: { value: aspect },
        uDisturbances: { value: this.disturbancesUniform },
        uDisturbanceCount: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D tPrev;
        uniform vec2 uTexelSize;
        uniform float uDamping;
        uniform float uWaveSpeedSq;
        uniform float uAspect;
        uniform vec4 uDisturbances[32];
        uniform int uDisturbanceCount;

        varying vec2 vUv;

        void main() {
          vec4 prevSample = texture2D(tPrev, vUv);
          float currentH = prevSample.r;
          float pastH = prevSample.g;

          float nL = texture2D(tPrev, vUv - vec2(uTexelSize.x, 0.0)).r;
          float nR = texture2D(tPrev, vUv + vec2(uTexelSize.x, 0.0)).r;
          float nD = texture2D(tPrev, vUv - vec2(0.0, uTexelSize.y)).r;
          float nU = texture2D(tPrev, vUv + vec2(0.0, uTexelSize.y)).r;

          // Физическое 2D-волновое уравнение с параметрической скоростью распространения (S = uWaveSpeedSq):
          float neighborSum = nL + nR + nD + nU;
          float nextH = ((2.0 - 4.0 * uWaveSpeedSq) * currentH - pastH + uWaveSpeedSq * neighborSum) * uDamping;

          // Поглощающие границы у берегов (предотвращают неестественное отражение от краев меша)
          float borderDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
          if (borderDist < uTexelSize.x * 3.5) {
            nextH *= smoothstep(0.0, uTexelSize.x * 3.5, borderDist);
          }

          // Нанесение возмущений от движущихся в воде объектов
          for (int i = 0; i < 32; i++) {
            if (i >= uDisturbanceCount) break;
            vec4 dist = uDisturbances[i];
            float radius = dist.z;
            if (radius <= 0.0001) continue;

            vec2 delta = vUv - dist.xy;
            delta.x *= uAspect;
            float d = length(delta);
            if (d < radius) {
              float falloff = cos(d / radius * 1.5707963);
              nextH += dist.w * falloff * falloff;
            }
          }

          nextH = clamp(nextH, -2.0, 2.0);
          gl_FragColor = vec4(nextH, currentH, 0.0, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMaterial);
    this.simScene.add(this.quadMesh);
  }

  public setSize(width: number, depth: number): void {
    this.width = width;
    this.depth = depth;
    if (this.simMaterial.uniforms.uAspect) {
      this.simMaterial.uniforms.uAspect.value = width / Math.max(0.1, depth);
    }
  }

  public getTexture(): THREE.Texture {
    return this.readTarget.texture;
  }

  public update(
    renderer: THREE.WebGLRenderer,
    dt: number,
    disturbances: WaterDisturbance[],
    waterCenterX: number,
    waterCenterZ: number,
    rippleSpeed: number = 1.0,
    rippleDamping: number = GRAPHICS_CONFIG.water.ripples.damping
  ): void {
    const count = Math.min(32, disturbances.length);

    // 1. Управление сном (Dormant Mode): если в воде никого нет и волны растворились — полностью выключаем расчет
    if (count > 0) {
      this.activityTimer = 3.5;
      this.isSleeping = false;
    } else if (this.activityTimer > 0) {
      this.activityTimer -= dt;
    } else {
      if (!this.isSleeping) {
        this.clear(renderer);
        this.isSleeping = true;
      }
      return; // Вода в покое: 0 проходов рендера GPU
    }

    // 2. Ограничение частоты симуляции (Fixed Simulation Rate, 30 FPS)
    const targetSimInterval = 1.0 / GRAPHICS_CONFIG.water.ripples.simFps;
    this.simAccumulator += dt;

    if (this.simAccumulator < targetSimInterval) {
      return; // Пропускаем тяжелый рендер, текущий кадр интерполируется билинейно
    }

    this.simAccumulator = Math.min(
      targetSimInterval * 2.0,
      this.simAccumulator - targetSimInterval
    );

    // 3. Расчет коэффициента скорости с ограничением подшагов до максимума 2
    const clampedSpeed = Math.max(0.05, Math.min(3.0, rippleSpeed));
    const subSteps = Math.min(2, Math.ceil(clampedSpeed * 0.7));
    const subSpeed = clampedSpeed / subSteps;

    const waveSpeedSq = 0.5 * Math.min(1.0, subSpeed * subSpeed);
    const decayRate = 1.0 - Math.max(0.85, Math.min(0.999, rippleDamping));
    const stepDamping = Math.max(0.85, Math.min(0.9999, 1.0 - decayRate * subSpeed));

    this.simMaterial.uniforms.uWaveSpeedSq.value = waveSpeedSq;
    this.simMaterial.uniforms.uDamping.value = stepDamping;

    for (let i = 0; i < 32; i++) {
      if (i < count) {
        const d = disturbances[i];
        const rx = d.x - waterCenterX;
        const rz = d.z - waterCenterZ;

        const uvX = rx / this.width + 0.5;
        const uvY = 0.5 - rz / this.depth;
        const uvRadius = d.radius / this.depth;

        if (uvX >= -0.1 && uvX <= 1.1 && uvY >= -0.1 && uvY <= 1.1) {
          this.disturbancesUniform[i].set(uvX, uvY, uvRadius, d.strength);
        } else {
          this.disturbancesUniform[i].set(0, 0, 0, 0);
        }
      } else {
        this.disturbancesUniform[i].set(0, 0, 0, 0);
      }
    }

    const prevTarget = renderer.getRenderTarget();

    // 4. Выполнение легкого шага симуляции
    for (let step = 0; step < subSteps; step++) {
      this.simMaterial.uniforms.uDisturbanceCount.value = step === 0 ? count : 0;
      this.simMaterial.uniforms.tPrev.value = this.readTarget.texture;

      renderer.setRenderTarget(this.writeTarget);
      renderer.render(this.simScene, this.simCamera);

      const temp = this.readTarget;
      this.readTarget = this.writeTarget;
      this.writeTarget = temp;
    }

    renderer.setRenderTarget(prevTarget);
  }

  public clear(renderer?: THREE.WebGLRenderer): void {
    if (renderer) {
      const prevTarget = renderer.getRenderTarget();
      const clearColor = renderer.getClearColor(new THREE.Color());
      const clearAlpha = renderer.getClearAlpha();

      renderer.setClearColor(new THREE.Color(0.0, 0.0, 0.0), 1.0);
      renderer.setRenderTarget(this.readTarget);
      renderer.clear();
      renderer.setRenderTarget(this.writeTarget);
      renderer.clear();

      renderer.setRenderTarget(prevTarget);
      renderer.setClearColor(clearColor, clearAlpha);
    }
  }

  public destroy(): void {
    this.readTarget.dispose();
    this.writeTarget.dispose();
    this.simMaterial.dispose();
    this.quadMesh.geometry.dispose();
  }
}
