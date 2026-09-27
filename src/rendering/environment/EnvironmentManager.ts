import * as THREE from 'three';
import { EnvironmentComponent } from '../../ecs/components/environment';
import { SkyDome, SkyColors } from './SkyDome';

export class EnvironmentManager {
  private skyDome: SkyDome;
  public sunLight: THREE.DirectionalLight;
  public moonLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;

  private sunDir = new THREE.Vector3();
  private moonDir = new THREE.Vector3();
  private celestialMatrix = new THREE.Matrix4();
  private rotTilt = new THREE.Matrix4();
  private rotAzimuth = new THREE.Matrix4();
  private rotHour = new THREE.Matrix4();

  constructor(scene: THREE.Scene) {
    this.skyDome = new SkyDome();
    scene.add(this.skyDome.mesh);

    this.sunLight = new THREE.DirectionalLight(0xfff4e0, 1.2);
    this.setupShadowCamera(this.sunLight);
    scene.add(this.sunLight);
    scene.add(this.sunLight.target);

    this.moonLight = new THREE.DirectionalLight(0x8faee0, 0.4);
    this.setupShadowCamera(this.moonLight);
    scene.add(this.moonLight);
    scene.add(this.moonLight.target);

    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(this.ambientLight);

    scene.fog = new THREE.FogExp2(0xd6e5f5, 0.007);
  }

  private setupShadowCamera(light: THREE.DirectionalLight): void {
    light.castShadow = false;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
    light.shadow.bias = -0.00003;
    light.shadow.normalBias = 0.025;

    const cam = light.shadow.camera;
    const bounds = 36;
    cam.left = -bounds;
    cam.right = bounds;
    cam.top = bounds;
    cam.bottom = -bounds;
    cam.near = 1.0;
    cam.far = 160.0;
  }

  public update(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    focusTarget: { x: number; y: number; z: number },
    env: EnvironmentComponent
  ): void {
    const time = env.timeOfDay;
    const hourAngle = ((time - 6.0) / 24.0) * Math.PI * 2.0;

    this.rotHour.makeRotationZ(-hourAngle);
    this.rotTilt.makeRotationX(env.axialTilt);
    this.rotAzimuth.makeRotationY(env.azimuth);

    this.celestialMatrix.identity().multiply(this.rotAzimuth).multiply(this.rotTilt);

    const baseSun = new THREE.Vector3(Math.cos(hourAngle), Math.sin(hourAngle), 0);
    this.sunDir.copy(baseSun).applyMatrix4(this.celestialMatrix).normalize();
    this.moonDir.copy(this.sunDir).negate();

    const sunElevation = this.sunDir.y;
    const colors = this.evaluateAtmosphereColors(sunElevation);
    const starFade = Math.max(0.0, Math.min(1.0, (-sunElevation - 0.05) / 0.25));

    const starMatrix = new THREE.Matrix4()
      .multiply(this.rotAzimuth)
      .multiply(this.rotTilt)
      .multiply(this.rotHour);

    this.skyDome.update(camera.position, this.sunDir, this.moonDir, starMatrix, colors, starFade);

    if (scene.fog && scene.fog instanceof THREE.FogExp2) {
      scene.fog.color.copy(colors.haze);
      scene.fog.density = env.fogDensity;
    }

    const isSunDominant = sunElevation >= -0.05;

    this.sunLight.color.copy(colors.sunLight);
    const sunIntensity = Math.max(0.0, Math.min(1.3, (sunElevation + 0.1) * 2.0));
    this.sunLight.intensity = sunIntensity;

    this.moonLight.color.copy(colors.moonLight);
    const moonIntensity = Math.max(0.0, Math.min(0.45, (-sunElevation + 0.1) * 0.9));
    this.moonLight.intensity = moonIntensity;

    this.ambientLight.color.copy(colors.ambient);

    if (isSunDominant) {
      this.sunLight.castShadow = true;
      this.moonLight.castShadow = false;
      this.alignLightWithTarget(this.sunLight, this.sunDir, focusTarget);
    } else {
      this.sunLight.castShadow = false;
      this.moonLight.castShadow = true;
      this.alignLightWithTarget(this.moonLight, this.moonDir, focusTarget);
    }
  }

  private alignLightWithTarget(
    light: THREE.DirectionalLight,
    dir: THREE.Vector3,
    target: { x: number; y: number; z: number }
  ): void {
    const dist = 60.0;
    light.position.set(
      target.x + dir.x * dist,
      target.y + Math.max(10, dir.y * dist),
      target.z + dir.z * dist
    );
    light.target.position.set(target.x, target.y, target.z);
    light.target.updateMatrixWorld();
  }

  private evaluateAtmosphereColors(sunY: number): SkyColors {
    const colors: SkyColors = {
      zenith: new THREE.Color(),
      horizon: new THREE.Color(),
      haze: new THREE.Color(),
      sunset: new THREE.Color(),
      sunDisk: new THREE.Color(0xfff5d0),
      moonDisk: new THREE.Color(0xecf0f1),
      ambient: new THREE.Color(),
      sunLight: new THREE.Color(),
      moonLight: new THREE.Color(0x8faee0),
    };

    // Опорные цветовые состояния атмосферы
    const cDayZenith = new THREE.Color(0.15, 0.42, 0.88);
    const cDayHorizon = new THREE.Color(0.65, 0.8, 0.95);
    const cDayHaze = new THREE.Color(0.7, 0.84, 0.96);
    const cDaySunLight = new THREE.Color(1.0, 0.98, 0.9);
    const cDayAmbient = new THREE.Color(0.42, 0.46, 0.52);

    const cSunsetZenith = new THREE.Color(0.1, 0.16, 0.4);
    const cSunsetHorizon = new THREE.Color(0.38, 0.36, 0.52); // Сумеречный лавандовый тыл
    const cSunsetHaze = new THREE.Color(0.42, 0.38, 0.5);
    const cSunsetGlow = new THREE.Color(1.0, 0.45, 0.14); // Огненно-золотой закатный сектор
    const cSunsetLight = new THREE.Color(1.0, 0.55, 0.22);
    const cSunsetAmbient = new THREE.Color(0.28, 0.22, 0.28);

    const cDuskZenith = new THREE.Color(0.03, 0.05, 0.14);
    const cDuskHorizon = new THREE.Color(0.1, 0.09, 0.18);
    const cDuskHaze = new THREE.Color(0.12, 0.1, 0.2);
    const cDuskSunsetGlow = new THREE.Color(0.45, 0.12, 0.16); // Догорающий пурпурный сектор
    const cDuskAmbient = new THREE.Color(0.13, 0.12, 0.18);

    const cNightZenith = new THREE.Color(0.015, 0.025, 0.06);
    const cNightHorizon = new THREE.Color(0.035, 0.05, 0.11);
    const cNightHaze = new THREE.Color(0.045, 0.065, 0.13);
    const cNightAmbient = new THREE.Color(0.08, 0.1, 0.16);

    // Непрерывная 5-фазная шкала высоты солнца (sunY)
    if (sunY >= 0.2) {
      // 1. Полный день
      colors.zenith.copy(cDayZenith);
      colors.horizon.copy(cDayHorizon);
      colors.haze.copy(cDayHaze);
      colors.sunset.setRGB(0, 0, 0);
      colors.sunLight.copy(cDaySunLight);
      colors.ambient.copy(cDayAmbient);
    } else if (sunY >= 0.05) {
      // 2. День -> Золотой час / Закат у горизонта
      const t = (sunY - 0.05) / 0.15; // 0..1
      colors.zenith.lerpColors(cSunsetZenith, cDayZenith, t);
      colors.horizon.lerpColors(cSunsetHorizon, cDayHorizon, t);
      colors.haze.lerpColors(cSunsetHaze, cDayHaze, t);
      colors.sunset.lerpColors(cSunsetGlow, new THREE.Color(0, 0, 0), t);
      colors.sunLight.lerpColors(cSunsetLight, cDaySunLight, t);
      colors.ambient.lerpColors(cSunsetAmbient, cDayAmbient, t);
    } else if (sunY >= -0.08) {
      // 3. Закат у горизонта -> Ранние сумерки (солнце садится под горизонт)
      const t = (sunY - -0.08) / 0.13; // 0..1
      colors.zenith.lerpColors(cDuskZenith, cSunsetZenith, t);
      colors.horizon.lerpColors(cDuskHorizon, cSunsetHorizon, t);
      colors.haze.lerpColors(cDuskHaze, cSunsetHaze, t);
      colors.sunset.lerpColors(cDuskSunsetGlow, cSunsetGlow, t);
      colors.sunLight.lerpColors(new THREE.Color(0.5, 0.18, 0.1), cSunsetLight, t);
      colors.ambient.lerpColors(cDuskAmbient, cSunsetAmbient, t);
    } else if (sunY >= -0.22) {
      // 4. Глубокие сумерки -> Наступление ночи
      const t = (sunY - -0.22) / 0.14; // 0..1
      colors.zenith.lerpColors(cNightZenith, cDuskZenith, t);
      colors.horizon.lerpColors(cNightHorizon, cDuskHorizon, t);
      colors.haze.lerpColors(cNightHaze, cDuskHaze, t);
      colors.sunset.lerpColors(new THREE.Color(0, 0, 0), cDuskSunsetGlow, t);
      colors.sunLight.setRGB(0, 0, 0);
      colors.ambient.lerpColors(cNightAmbient, cDuskAmbient, t);
    } else {
      // 5. Полная ночь
      colors.zenith.copy(cNightZenith);
      colors.horizon.copy(cNightHorizon);
      colors.haze.copy(cNightHaze);
      colors.sunset.setRGB(0, 0, 0);
      colors.sunLight.setRGB(0, 0, 0);
      colors.ambient.copy(cNightAmbient);
    }

    return colors;
  }

  public destroy(): void {
    if (this.skyDome.mesh.parent) {
      this.skyDome.mesh.parent.remove(this.skyDome.mesh);
    }
    this.skyDome.destroy();
    if (this.sunLight.parent) this.sunLight.parent.remove(this.sunLight);
    if (this.sunLight.target.parent) this.sunLight.target.parent.remove(this.sunLight.target);
    if (this.moonLight.parent) this.moonLight.parent.remove(this.moonLight);
    if (this.moonLight.target.parent) this.moonLight.target.parent.remove(this.moonLight.target);
    if (this.ambientLight.parent) this.ambientLight.parent.remove(this.ambientLight);
  }
}
