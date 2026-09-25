import * as THREE from 'three';
import { GRASS_CONFIG } from '../../config/grassConfig';

export interface TrampleStamp {
  x: number;
  z: number;
  radius: number;
  dirX: number;
  dirZ: number;
  strength: number;
}

export class TrampleTextureManager {
  public readonly resolution: number;
  private readTarget: THREE.WebGLRenderTarget;
  private writeTarget: THREE.WebGLRenderTarget;
  private simScene: THREE.Scene;
  private simCamera: THREE.OrthographicCamera;
  private simMaterial: THREE.ShaderMaterial;
  private quadMesh: THREE.Mesh;

  private stampsUniform: THREE.Vector4[];
  private dirsUniform: THREE.Vector2[];

  /** Скорость распрямления травы */
  public recoverySpeed: number = GRASS_CONFIG.trample.recoverySpeed;
  /** Скорость приминания вниз при наступании */
  public bendSpeed: number = GRASS_CONFIG.trample.bendSpeed;
  /** Приоритет вектора движения над боковым расталкиванием */
  public motionBias: number = GRASS_CONFIG.trample.motionBias;

  constructor(resolution: number = 256) {
    this.resolution = resolution;

    const options: THREE.RenderTargetOptions = {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      wrapS: THREE.ClampToEdgeWrapping,
      wrapT: THREE.ClampToEdgeWrapping,
      depthBuffer: false,
      stencilBuffer: false,
    };

    this.readTarget = new THREE.WebGLRenderTarget(resolution, resolution, options);
    this.writeTarget = new THREE.WebGLRenderTarget(resolution, resolution, options);

    this.stampsUniform = Array.from({ length: 32 }, () => new THREE.Vector4(0, 0, 0, 0));
    this.dirsUniform = Array.from({ length: 32 }, () => new THREE.Vector2(0, 0));

    this.simScene = new THREE.Scene();
    this.simCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.simMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tPrev: { value: null },
        uDeltaTime: { value: 0.016 },
        uRecoverySpeed: { value: this.recoverySpeed },
        uBendSpeed: { value: this.bendSpeed },
        uMotionBias: { value: this.motionBias },
        uStamps: { value: this.stampsUniform },
        uDirs: { value: this.dirsUniform },
        uStampCount: { value: 0 },
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
        uniform float uDeltaTime;
        uniform float uRecoverySpeed;
        uniform float uBendSpeed;
        uniform float uMotionBias;
        uniform vec4 uStamps[32];
        uniform vec2 uDirs[32];
        uniform int uStampCount;

        varying vec2 vUv;

        void main() {
          vec4 prev = texture2D(tPrev, vUv);
          float prevTrample = prev.r;
          vec2 prevDir = prev.gb * 2.0 - 1.0;
          float prevDirLen = length(prevDir);
          prevDir = prevDirLen > 0.01 ? prevDir / prevDirLen : vec2(0.0, 1.0);

          float targetTrample = 0.0;
          vec2 targetDir = prevDir;
          float maxWeight = 0.0;

          for (int i = 0; i < 32; i++) {
            if (i >= uStampCount) break;

            vec4 stamp = uStamps[i];
            float radius = stamp.z;
            if (radius <= 0.0001) continue;

           vec2 toPixel = vUv - stamp.xy;
            float dist = length(toPixel);
            if (dist < radius) {
              float coreRadius = radius * 0.25;
              float falloff = 1.0;
              if (dist > coreRadius) {
                float t = (dist - coreRadius) / (radius - coreRadius);
                falloff = 1.0 - t * t;
              }
              float pressure = falloff * stamp.w;

              if (pressure > targetTrample) {
                targetTrample = pressure;
              }

              vec2 radialDir = dist > 0.0001 ? toPixel / dist : vec2(0.0, 1.0);
              vec2 motionDir = uDirs[i];
              float motionSpeed = length(motionDir);

              vec2 stampDir = radialDir;

              // Кильватерная модель при движении: трава разваливается по бокам и заглаживается строго вперед
              if (motionSpeed > 0.01) {
                vec2 normMotion = motionDir / motionSpeed;
                vec2 lateralNorm = vec2(-normMotion.y, normMotion.x);
                float latOffset = dot(toPixel, lateralNorm);
                float latSign = clamp(latOffset / (radius * 0.4), -1.0, 1.0);
                vec2 lateralPush = lateralNorm * latSign;

                vec2 wakeDir = normMotion * uMotionBias + lateralPush * (1.0 - uMotionBias);
                stampDir = normalize(wakeDir);
              } else {
                // Если существо остановилось на уже примятой траве, не разворачиваем вектор в противоположную сторону,
                // чтобы векторы не гасили друг друга в ноль
                if (prevTrample > 0.15 && dot(prevDir, radialDir) < 0.0) {
                  stampDir = prevDir;
                }
              }

              if (pressure > maxWeight) {
                maxWeight = pressure;
                targetDir = stampDir;
              }
            }
          }

          // 1. Инерция через 2D-вектор (Vector Bend Inertia)
          // Объединяем силу примятости и направление в единый вектор
          vec2 currentBend = prevDir * prevTrample;
          vec2 nextBend;

          if (maxWeight > 0.01) {
            // Наступание: вектор плавно тянется к новой цели.
            // Если идем в обратную сторону, он сам пройдет через (0,0), трава встанет и согнется обратно!
            vec2 targetBend = targetDir * maxWeight;
            float bendFactor = clamp(uBendSpeed * uDeltaTime, 0.0, 1.0);
            nextBend = mix(currentBend, targetBend, bendFactor);
          } else {
            // Распрямление: линейно уменьшаем длину вектора (трава встает вертикально)
            float currentLen = length(currentBend);
            if (currentLen > 0.001) {
              float decayAmount = uRecoverySpeed * uDeltaTime;
              float nextLen = max(0.0, currentLen - decayAmount);
              nextBend = (currentBend / currentLen) * nextLen;
            } else {
              nextBend = vec2(0.0);
            }
          }

          float finalTrample = length(nextBend);
          // Защита: если трава полностью встала, сохраняем её последнее направление
          vec2 finalDir = finalTrample > 0.001 ? nextBend / finalTrample : prevDir;

          vec2 encodedDir = finalDir * 0.5 + 0.5;
          gl_FragColor = vec4(clamp(finalTrample, 0.0, 1.0), encodedDir.x, encodedDir.y, 1.0);
        }
      `,
      depthTest: false,
      depthWrite: false,
    });

    this.quadMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.simMaterial);
    this.simScene.add(this.quadMesh);
  }

  public getTexture(): THREE.Texture {
    return this.readTarget.texture;
  }

  public update(
    renderer: THREE.WebGLRenderer,
    dt: number,
    stamps: TrampleStamp[],
    terrainSize: number
  ): void {
    this.simMaterial.uniforms.uDeltaTime.value = dt;
    this.simMaterial.uniforms.uRecoverySpeed.value = this.recoverySpeed;
    this.simMaterial.uniforms.uBendSpeed.value = this.bendSpeed;
    this.simMaterial.uniforms.uMotionBias.value = this.motionBias;
    this.simMaterial.uniforms.tPrev.value = this.readTarget.texture;

    const count = Math.min(32, stamps.length);
    const halfSize = terrainSize * 0.5;

    for (let i = 0; i < 32; i++) {
      if (i < count) {
        const s = stamps[i];
        const uvX = (s.x + halfSize) / terrainSize;
        const uvY = (s.z + halfSize) / terrainSize;
        const uvRadius = s.radius / terrainSize;
        this.stampsUniform[i].set(uvX, uvY, uvRadius, s.strength);
        this.dirsUniform[i].set(s.dirX, s.dirZ);
      } else {
        this.stampsUniform[i].set(0, 0, 0, 0);
        this.dirsUniform[i].set(0, 0);
      }
    }

    this.simMaterial.uniforms.uStampCount.value = count;

    // Рендер симуляции в writeTarget
    const prevTarget = renderer.getRenderTarget();
    renderer.setRenderTarget(this.writeTarget);
    renderer.render(this.simScene, this.simCamera);
    renderer.setRenderTarget(prevTarget);

    // Смена буферов местами (Ping-Pong)
    const temp = this.readTarget;
    this.readTarget = this.writeTarget;
    this.writeTarget = temp;
  }

  public clear(renderer?: THREE.WebGLRenderer): void {
    if (renderer) {
      const prevTarget = renderer.getRenderTarget();
      const clearColor = renderer.getClearColor(new THREE.Color());
      const clearAlpha = renderer.getClearAlpha();

      // Очистка нейтральным состоянием (R=0: прямо, G=0.5, B=0.5: нулевой вектор)
      renderer.setClearColor(new THREE.Color(0.0, 0.5, 0.5), 1.0);
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
