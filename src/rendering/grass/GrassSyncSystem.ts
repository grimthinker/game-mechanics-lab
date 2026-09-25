import * as THREE from 'three';
import { World } from '../../ecs/World';
import { TerrainComponent, getTerrainHeightAt } from '../../ecs/components/terrain';
import { GrassGeometryBuilder } from './GrassGeometryBuilder';
import { createGrassMaterial } from './GrassMaterial';
import { GRASS_CONFIG } from '../../config/grassConfig';
import { TrampleStamp, TrampleTextureManager } from './TrampleTextureManager';

interface GrassInstanceData {
  x: number;
  z: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  variant: 3 | 4 | 5;
}

export class GrassSyncSystem {
  private scene: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;
  private trampleManager: TrampleTextureManager;

  // Три варианта мешей для разного количества лепестков в пучке
  private mesh3: THREE.InstancedMesh | null = null;
  private mesh4: THREE.InstancedMesh | null = null;
  private mesh5: THREE.InstancedMesh | null = null;

  private geo3: THREE.BufferGeometry;
  private geo4: THREE.BufferGeometry;
  private geo5: THREE.BufferGeometry;
  private grassMaterial: THREE.MeshStandardMaterial;

  /**
   * Общий коэффициент плотности травы от 0.0 до 1.0.
   * Идеально подходит для привязки к ползунку настроек графики в меню игры.
   */
  public densityFactor: number = GRASS_CONFIG.defaultDensityFactor;

  // Абсолютные максимумы пулов при плотности 100% (1.0)
  private cap3: number = GRASS_CONFIG.capacities.blade3;
  private cap4: number = GRASS_CONFIG.capacities.blade4;
  private cap5: number = GRASS_CONFIG.capacities.blade5;

  // Независимые целевые вероятности появления
  private prob3: number = GRASS_CONFIG.probabilities.blade3;
  private prob4: number = GRASS_CONFIG.probabilities.blade4;

  private dummy = new THREE.Object3D();

  // Кэш сгенерированных позиций для быстрого обновления высот при скульпте холмов
  private instanceCache: GrassInstanceData[] = [];

  private isGenerated: boolean = false;
  private needsRebuild: boolean = false;
  private timeSinceLastRegen: number = 0;
  private lastSplatVersion: number = -1;
  private lastGeometryVersion: number = -1;
  private lastDensityFactor: number = GRASS_CONFIG.defaultDensityFactor;

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.trampleManager = new TrampleTextureManager(256);

    this.geo3 = GrassGeometryBuilder.createClusterGeometry({ bladeCount: 3 });
    this.geo4 = GrassGeometryBuilder.createClusterGeometry({ bladeCount: 4 });
    this.geo5 = GrassGeometryBuilder.createClusterGeometry({ bladeCount: 5 });

    this.grassMaterial = createGrassMaterial();
  }

  public update(dt: number, world: World, terrainComp?: TerrainComponent): void {
    if (!terrainComp) {
      if (this.mesh3 || this.mesh4 || this.mesh5) this.clear();
      return;
    }

    const currentSplatVer = terrainComp.splatVersion ?? 0;
    const currentGeomVer = terrainComp.geometryVersion ?? 0;

    const splatChanged = currentSplatVer !== this.lastSplatVersion;
    const geomChanged = currentGeomVer !== this.lastGeometryVersion;
    const densityChanged = this.densityFactor !== this.lastDensityFactor;

    if (!this.isGenerated || splatChanged || densityChanged) {
      // При изменении текстуры, первом запуске или изменении настройки плотности — пересобираем
      this.timeSinceLastRegen += dt;
      if (!this.isGenerated || this.timeSinceLastRegen >= 0.08) {
        this.rebuildGrass(terrainComp);
        this.isGenerated = true;
        this.timeSinceLastRegen = 0;
        this.lastSplatVersion = currentSplatVer;
        this.lastGeometryVersion = currentGeomVer;
        this.lastDensityFactor = this.densityFactor;
      }
    } else if (geomChanged) {
      // При изменении высот (скульптинг холмов) — плавно двигаем существующую траву по высоте Y
      this.updateHeightsOnly(terrainComp);
      this.lastGeometryVersion = currentGeomVer;
    }

    // Обновляем время для волн ветра и параметры террейна в шейдере
    const shader = this.grassMaterial.userData.shader;
    if (shader) {
      if (shader.uniforms.uTime) {
        shader.uniforms.uTime.value += dt;
      }
      if (shader.uniforms.uTerrainSize) {
        shader.uniforms.uTerrainSize.value = terrainComp.size;
      }
    }

    // Симуляция текстуры приминания (GPU Trample Map)
    if (this.renderer) {
      const stamps = this.collectTrampleStamps(world);
      this.trampleManager.update(this.renderer, dt, stamps, terrainComp.size);

      if (shader && shader.uniforms.uTrampleMap) {
        shader.uniforms.uTrampleMap.value = this.trampleManager.getTexture();
      }
    }
  }

  private rebuildGrass(terrain: TerrainComponent): void {
    if (!this.mesh3) {
      this.mesh3 = new THREE.InstancedMesh(this.geo3, this.grassMaterial, this.cap3);
      this.mesh3.userData.isGrassMesh = true;
      this.mesh3.userData.isSharedAsset = true;
      this.mesh3.receiveShadow = true;
      this.scene.add(this.mesh3);
    }
    if (!this.mesh4) {
      this.mesh4 = new THREE.InstancedMesh(this.geo4, this.grassMaterial, this.cap4);
      this.mesh4.userData.isGrassMesh = true;
      this.mesh4.userData.isSharedAsset = true;
      this.mesh4.receiveShadow = true;
      this.scene.add(this.mesh4);
    }
    if (!this.mesh5) {
      this.mesh5 = new THREE.InstancedMesh(this.geo5, this.grassMaterial, this.cap5);
      this.mesh5.userData.isGrassMesh = true;
      this.mesh5.userData.isSharedAsset = true;
      this.mesh5.receiveShadow = true;
      this.scene.add(this.mesh5);
    }

    const safeDensity = Math.max(0, Math.min(1, this.densityFactor));
    const targetMax3 = Math.round(this.cap3 * safeDensity);
    const targetMax4 = Math.round(this.cap4 * safeDensity);
    const targetMax5 = Math.round(this.cap5 * safeDensity);

    const size = terrain.size;
    const halfSize = size / 2;
    const splatRes = terrain.splatResolution || 512;
    const splatData = terrain.splatData;

    this.instanceCache = [];
    let count3 = 0;
    let count4 = 0;
    let count5 = 0;
    const totalTarget = targetMax3 + targetMax4 + targetMax5;
    const maxAttempts = totalTarget * 3;

    for (
      let i = 0;
      i < maxAttempts && (count3 < targetMax3 || count4 < targetMax4 || count5 < targetMax5);
      i++
    ) {
      const wx = (Math.random() - 0.5) * size;
      const wz = (Math.random() - 0.5) * size;

      const u = (wx + halfSize) / size;
      const v = (wz + halfSize) / size;
      if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;

      const px = Math.min(splatRes - 1, Math.max(0, Math.floor(u * splatRes)));
      const pz = Math.min(splatRes - 1, Math.max(0, Math.floor(v * splatRes)));
      const splatIdx = (pz * splatRes + px) * 4;

      const grassDensity = splatData[splatIdx + 0];
      if (grassDensity < GRASS_CONFIG.densityThreshold) continue;
      if (Math.random() * 255 > grassDensity) continue;

      const wy = getTerrainHeightAt(terrain, wx, wz);
      if (wy === null) continue;

      const can3 = count3 < targetMax3;
      const can4 = count4 < targetMax4;
      const can5 = count5 < targetMax5;

      if (!can3 && !can4 && !can5) break;

      const roll = Math.random();
      let variant: 3 | 4 | 5 = 3;

      if (roll < this.prob3) {
        if (can3) variant = 3;
        else if (can4) variant = 4;
        else variant = 5;
      } else if (roll < this.prob3 + this.prob4) {
        if (can4) variant = 4;
        else if (can3) variant = 3;
        else variant = 5;
      } else {
        if (can5) variant = 5;
        else if (can3) variant = 3;
        else variant = 4;
      }

      const jitterX = (Math.random() - 0.5) * 0.4;
      const jitterZ = (Math.random() - 0.5) * 0.4;
      const finalX = wx + jitterX;
      const finalZ = wz + jitterZ;

      const rotX = (Math.random() - 0.5) * 0.1;
      const rotY = Math.random() * Math.PI * 2;
      const rotZ = (Math.random() - 0.5) * 0.1;

      const scale = 0.75 + Math.random() * 0.55;
      const scaleX = scale;
      const scaleY = scale * (0.85 + Math.random() * 0.3);
      const scaleZ = scale;

      this.instanceCache.push({
        x: finalX,
        z: finalZ,
        rotX,
        rotY,
        rotZ,
        scaleX,
        scaleY,
        scaleZ,
        variant,
      });

      this.dummy.position.set(finalX, wy, finalZ);
      this.dummy.rotation.set(rotX, rotY, rotZ);
      this.dummy.scale.set(scaleX, scaleY, scaleZ);
      this.dummy.updateMatrix();

      if (variant === 3) {
        this.mesh3!.setMatrixAt(count3++, this.dummy.matrix);
      } else if (variant === 4) {
        this.mesh4!.setMatrixAt(count4++, this.dummy.matrix);
      } else {
        this.mesh5!.setMatrixAt(count5++, this.dummy.matrix);
      }
    }

    this.mesh3!.count = count3;
    this.mesh3!.instanceMatrix.needsUpdate = true;
    this.mesh3!.computeBoundingSphere();

    this.mesh4!.count = count4;
    this.mesh4!.instanceMatrix.needsUpdate = true;
    this.mesh4!.computeBoundingSphere();

    this.mesh5!.count = count5;
    this.mesh5!.instanceMatrix.needsUpdate = true;
    this.mesh5!.computeBoundingSphere();
  }

  private updateHeightsOnly(terrain: TerrainComponent): void {
    const safeDensity = Math.max(0, Math.min(1, this.densityFactor));
    const targetMax3 = Math.round(this.cap3 * safeDensity);
    const targetMax4 = Math.round(this.cap4 * safeDensity);
    const targetMax5 = Math.round(this.cap5 * safeDensity);

    let count3 = 0;
    let count4 = 0;
    let count5 = 0;

    for (const inst of this.instanceCache) {
      const wy = getTerrainHeightAt(terrain, inst.x, inst.z);
      if (wy === null) continue;

      this.dummy.position.set(inst.x, wy, inst.z);
      this.dummy.rotation.set(inst.rotX, inst.rotY, inst.rotZ);
      this.dummy.scale.set(inst.scaleX, inst.scaleY, inst.scaleZ);
      this.dummy.updateMatrix();

      if (inst.variant === 3) {
        if (count3 < targetMax3) this.mesh3!.setMatrixAt(count3++, this.dummy.matrix);
      } else if (inst.variant === 4) {
        if (count4 < targetMax4) this.mesh4!.setMatrixAt(count4++, this.dummy.matrix);
      } else {
        if (count5 < targetMax5) this.mesh5!.setMatrixAt(count5++, this.dummy.matrix);
      }
    }

    if (this.mesh3) {
      this.mesh3.count = count3;
      this.mesh3.instanceMatrix.needsUpdate = true;
    }
    if (this.mesh4) {
      this.mesh4.count = count4;
      this.mesh4.instanceMatrix.needsUpdate = true;
    }
    if (this.mesh5) {
      this.mesh5.count = count5;
      this.mesh5.instanceMatrix.needsUpdate = true;
    }
  }

  private collectTrampleStamps(world: World): TrampleStamp[] {
    const stamps: TrampleStamp[] = [];

    // 1. Игрок
    const entities = world.getEntitiesWith('transform', 'aiStats', 'health');
    for (const [id, { transform, aiStats, health }] of entities) {
      if (health.isAlive && aiStats.behavior.current === 'PlayerTree') {
        const physStats = world.getComponent(id, 'physicsStats');
        const vel = world.getComponent(id, 'velocity');
        const speed = Math.hypot(vel?.vx ?? 0, vel?.vz ?? 0);
        const isMoving = speed > 0.1;

        const dirX = isMoving ? vel!.vx / speed : 0;
        const dirZ = isMoving ? vel!.vz / speed : 0;

        const baseRadius = physStats?.radius.current ?? 0.4;
        const stampRadius = baseRadius + (isMoving ? 0.35 : 0.22);

        stamps.push({
          x: transform.x,
          z: transform.z,
          radius: stampRadius,
          dirX,
          dirZ,
          strength: 1.0,
        });
        break;
      }
    }

    // 2. Другие существа (включая собаку)
    const creatures = world.getEntitiesWith('transform', 'health', 'meta');
    for (const [id, { transform, health, meta }] of creatures) {
      if (meta.entityType === 'creature' && health.isAlive) {
        const ai = world.getComponent(id, 'aiStats');
        if (ai?.behavior.current === 'PlayerTree') continue;

        const physStats = world.getComponent(id, 'physicsStats');
        const vel = world.getComponent(id, 'velocity');
        const speed = Math.hypot(vel?.vx ?? 0, vel?.vz ?? 0);
        const isMoving = speed > 0.1;

        const dirX = isMoving ? vel!.vx / speed : 0;
        const dirZ = isMoving ? vel!.vz / speed : 0;

        const baseRadius = physStats?.radius.current ?? 0.4;
        const stampRadius = baseRadius + (isMoving ? 0.3 : 0.2);

        stamps.push({
          x: transform.x,
          z: transform.z,
          radius: stampRadius,
          dirX,
          dirZ,
          strength: 0.95,
        });
      }
    }

    // 3. Предметы (брошенные, летящие или катящиеся)
    const items = world.getEntitiesWith('transform', 'item');
    for (const [id, { transform, item }] of items) {
      if (world.getComponent(id, 'ownership')) continue;

      const physStats = world.getComponent(id, 'physicsStats');
      const thrown = world.getComponent(id, 'thrownObject');
      const vel = world.getComponent(id, 'velocity');

      const weight = physStats?.weight.current ?? 1;
      const size = item.size ?? 1;
      const speed = Math.hypot(vel?.vx ?? 0, vel?.vz ?? 0);

      const isMoving = vel && (speed > 0.3 || Math.abs(vel.vy) > 0.3);
      const isAirborne = thrown?.isAirborne;

      if (size >= 4 || weight >= 2 || isAirborne || isMoving) {
        const itemRadius = physStats?.radius.current ?? 0.3;
        const isDirMoving = speed > 0.05;
        const dirX = isDirMoving ? vel!.vx / speed : 0;
        const dirZ = isDirMoving ? vel!.vz / speed : 0;
        const stampRadius = itemRadius + (isMoving || isAirborne ? 0.25 : 0.15);

        stamps.push({
          x: transform.x,
          z: transform.z,
          radius: stampRadius,
          dirX,
          dirZ,
          strength: Math.min(1.0, 0.4 + weight * 0.1),
        });
      }
    }

    return stamps;
  }

  public clear(): void {
    if (this.mesh3) {
      this.scene.remove(this.mesh3);
      this.mesh3.dispose();
      this.mesh3 = null;
    }
    if (this.mesh4) {
      this.scene.remove(this.mesh4);
      this.mesh4.dispose();
      this.mesh4 = null;
    }
    if (this.mesh5) {
      this.scene.remove(this.mesh5);
      this.mesh5.dispose();
      this.mesh5 = null;
    }
    this.instanceCache = [];
    this.isGenerated = false;
    this.timeSinceLastRegen = 0;
    this.lastSplatVersion = -1;
    this.lastGeometryVersion = -1;
    this.lastDensityFactor = GRASS_CONFIG.defaultDensityFactor;

    this.trampleManager.clear(this.renderer);
  }

  public destroy(): void {
    this.clear();
    this.geo3.dispose();
    this.geo4.dispose();
    this.geo5.dispose();
    this.grassMaterial.dispose();
    this.trampleManager.destroy();
  }
}
