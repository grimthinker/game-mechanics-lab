import * as THREE from 'three';
import { World } from '../../ecs/World';
import {
  TerrainComponent,
  getTerrainHeightAt,
  getTerrainNormalAt,
} from '../../ecs/components/terrain';
import { GrassGeometryBuilder } from './GrassGeometryBuilder';
import { createGrassMaterial } from './GrassMaterial';
import { GRASS_CONFIG } from '../../config/grassConfig';
import { TrampleStamp, TrampleTextureManager } from './TrampleTextureManager';
import { IPhysicsDriver } from '../../physics/IPhysicsDriver';

/** Быстрый целочисленный хэш для детерминированной привязки параметров растительности */
function fastHash(x: number, y: number, seed: number): number {
  let h = (seed + Math.floor(x) * 374761393 + Math.floor(y) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

export type FoliageVariant =
  | 'grass3'
  | 'grass4'
  | 'grass5'
  | 'wheat'
  | 'reeds'
  | 'dryGrass'
  | 'flowerRed'
  | 'flowerBlue'
  | 'flowerWhite'
  | 'flowerYellow';

interface GrassInstanceData {
  x: number;
  y: number;
  z: number;
  isMeshSurface: boolean;
  rotX: number;
  rotY: number;
  rotZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  variant: FoliageVariant;
}

export class GrassSyncSystem {
  private scene: THREE.Scene;
  private renderer?: THREE.WebGLRenderer;
  private trampleManager: TrampleTextureManager;

  // Инстанс-меши под каждую модель растительности
  private meshGrass3: THREE.InstancedMesh | null = null;
  private meshGrass4: THREE.InstancedMesh | null = null;
  private meshGrass5: THREE.InstancedMesh | null = null;
  private meshWheat: THREE.InstancedMesh | null = null;
  private meshReeds: THREE.InstancedMesh | null = null;
  private meshDryGrass: THREE.InstancedMesh | null = null;
  private meshFlowerRed: THREE.InstancedMesh | null = null;
  private meshFlowerBlue: THREE.InstancedMesh | null = null;
  private meshFlowerWhite: THREE.InstancedMesh | null = null;
  private meshFlowerYellow: THREE.InstancedMesh | null = null;

  private geoGrass3: THREE.BufferGeometry;
  private geoGrass4: THREE.BufferGeometry;
  private geoGrass5: THREE.BufferGeometry;
  private geoWheat: THREE.BufferGeometry;
  private geoReeds: THREE.BufferGeometry;
  private geoDryGrass: THREE.BufferGeometry;
  private geoFlowerRed: THREE.BufferGeometry;
  private geoFlowerBlue: THREE.BufferGeometry;
  private geoFlowerWhite: THREE.BufferGeometry;
  private geoFlowerYellow: THREE.BufferGeometry;

  private grassMaterial: THREE.MeshStandardMaterial;

  /** Общий коэффициент плотности растительности (0.0..1.0) */
  public densityFactor: number = GRASS_CONFIG.defaultDensityFactor;
  private dummy = new THREE.Object3D();
  private instanceCache: GrassInstanceData[] = [];

  private isGenerated: boolean = false;
  private timeSinceLastRegen: number = 0;
  private lastFoliageVersion: number = -1;
  private lastGeometryVersion: number = -1;
  private lastDensityFactor: number = GRASS_CONFIG.defaultDensityFactor;

  // Параметры потоковой подгрузки вокруг фокуса камеры
  private lastCamX: number = 999999;
  private lastCamZ: number = 999999;
  private readonly RENDER_RADIUS: number = GRASS_CONFIG.fade.renderRadius;
  private readonly CAM_MOVE_THRESHOLD: number = GRASS_CONFIG.fade.camMoveThreshold;
  private readonly CELL_SIZE: number = 0.4;
  public fadeStartDistance: number = GRASS_CONFIG.fade.fadeStartDistance;
  public fadeEndDistance: number = GRASS_CONFIG.fade.fadeEndDistance;

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.trampleManager = new TrampleTextureManager(256);

    this.geoGrass3 = GrassGeometryBuilder.createClusterGeometry({ bladeCount: 3 });
    this.geoGrass4 = GrassGeometryBuilder.createClusterGeometry({ bladeCount: 4 });
    this.geoGrass5 = GrassGeometryBuilder.createClusterGeometry({ bladeCount: 5 });
    this.geoWheat = GrassGeometryBuilder.createWheatGeometry();
    this.geoReeds = GrassGeometryBuilder.createReedsGeometry();
    this.geoDryGrass = GrassGeometryBuilder.createDryGrassGeometry();
    this.geoFlowerRed = GrassGeometryBuilder.createFlowerGeometry('poppy');
    this.geoFlowerBlue = GrassGeometryBuilder.createFlowerGeometry('cornflower');
    this.geoFlowerWhite = GrassGeometryBuilder.createFlowerGeometry('daisy');
    this.geoFlowerYellow = GrassGeometryBuilder.createFlowerGeometry('dandelion');

    this.grassMaterial = createGrassMaterial();
  }

  public update(
    dt: number,
    world: World,
    physicsDriver?: IPhysicsDriver | null,
    terrainComp?: TerrainComponent,
    camX: number = 0,
    camZ: number = 0
  ): void {
    if (!terrainComp || !terrainComp.foliageData) {
      if (this.meshGrass3) this.clear();
      return;
    }

    const currentFoliageVer = terrainComp.foliageVersion ?? 0;
    const currentGeomVer = terrainComp.geometryVersion ?? 0;

    const foliageChanged = currentFoliageVer !== this.lastFoliageVersion;
    const geomChanged = currentGeomVer !== this.lastGeometryVersion;
    const densityChanged = this.densityFactor !== this.lastDensityFactor;

    // Перестроение при движении камеры дальше порогового смещения
    const camMoved =
      Math.hypot(camX - this.lastCamX, camZ - this.lastCamZ) > this.CAM_MOVE_THRESHOLD;

    if (!this.isGenerated || foliageChanged || densityChanged || camMoved) {
      this.timeSinceLastRegen += dt;
      if (!this.isGenerated || this.timeSinceLastRegen >= 0.06) {
        this.rebuildGrass(terrainComp, camX, camZ, world, physicsDriver);
        this.isGenerated = true;
        this.timeSinceLastRegen = 0;
        this.lastFoliageVersion = currentFoliageVer;
        this.lastGeometryVersion = currentGeomVer;
        this.lastDensityFactor = this.densityFactor;
        this.lastCamX = camX;
        this.lastCamZ = camZ;
      }
    } else if (geomChanged) {
      this.updateHeightsOnly(terrainComp);
      this.lastGeometryVersion = currentGeomVer;
    }

    // Обновление униформов ветра, позиции камеры и дистанций увядания
    const shader = this.grassMaterial.userData.shader;
    if (shader) {
      if (shader.uniforms.uTime) {
        shader.uniforms.uTime.value += dt;
      }
      if (shader.uniforms.uCameraPos) {
        shader.uniforms.uCameraPos.value.set(camX, 0, camZ);
      }
      if (shader.uniforms.uFadeStart) {
        shader.uniforms.uFadeStart.value = this.fadeStartDistance;
      }
      if (shader.uniforms.uFadeEnd) {
        shader.uniforms.uFadeEnd.value = this.fadeEndDistance;
      }
    }

    // Симуляция карты приминания (GPU Trample Map) в следящем окне вокруг камеры
    if (this.renderer) {
      const stamps = this.collectTrampleStamps(world);
      this.trampleManager.update(this.renderer, dt, stamps, camX, camZ);

      if (shader) {
        if (shader.uniforms.uTrampleMap) {
          shader.uniforms.uTrampleMap.value = this.trampleManager.getTexture();
        }
        if (shader.uniforms.uTrampleCenter) {
          shader.uniforms.uTrampleCenter.value.copy(this.trampleManager.center);
        }
        if (shader.uniforms.uTrampleSize) {
          shader.uniforms.uTrampleSize.value = this.trampleManager.mapSize;
        }
      }
    }
  }

  private ensureMeshes(): void {
    const caps = GRASS_CONFIG.capacities;
    const createMesh = (geo: THREE.BufferGeometry, cap: number) => {
      const mesh = new THREE.InstancedMesh(geo, this.grassMaterial, cap);
      mesh.userData.isGrassMesh = true;
      mesh.userData.isSharedAsset = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      return mesh;
    };

    if (!this.meshGrass3) this.meshGrass3 = createMesh(this.geoGrass3, caps.blade3);
    if (!this.meshGrass4) this.meshGrass4 = createMesh(this.geoGrass4, caps.blade4);
    if (!this.meshGrass5) this.meshGrass5 = createMesh(this.geoGrass5, caps.blade5);
    if (!this.meshWheat) this.meshWheat = createMesh(this.geoWheat, caps.wheat);
    if (!this.meshReeds) this.meshReeds = createMesh(this.geoReeds, caps.reeds);
    if (!this.meshDryGrass) this.meshDryGrass = createMesh(this.geoDryGrass, caps.dryGrass);
    if (!this.meshFlowerRed) this.meshFlowerRed = createMesh(this.geoFlowerRed, caps.flowerRed);
    if (!this.meshFlowerBlue) this.meshFlowerBlue = createMesh(this.geoFlowerBlue, caps.flowerBlue);
    if (!this.meshFlowerWhite)
      this.meshFlowerWhite = createMesh(this.geoFlowerWhite, caps.flowerWhite);
    if (!this.meshFlowerYellow)
      this.meshFlowerYellow = createMesh(this.geoFlowerYellow, caps.flowerYellow);
  }

  private rebuildGrass(
    terrain: TerrainComponent,
    camX: number,
    camZ: number,
    world?: World,
    physicsDriver?: IPhysicsDriver | null
  ): void {
    this.ensureMeshes();

    const caps = GRASS_CONFIG.capacities;
    const safeDensity = Math.max(0, Math.min(1, this.densityFactor));
    const targetMax: Record<FoliageVariant, number> = {
      grass3: Math.round(caps.blade3 * safeDensity),
      grass4: Math.round(caps.blade4 * safeDensity),
      grass5: Math.round(caps.blade5 * safeDensity),
      wheat: Math.round(caps.wheat * safeDensity),
      reeds: Math.round(caps.reeds * safeDensity),
      dryGrass: Math.round(caps.dryGrass * safeDensity),
      flowerRed: Math.round(caps.flowerRed * safeDensity),
      flowerBlue: Math.round(caps.flowerBlue * safeDensity),
      flowerWhite: Math.round(caps.flowerWhite * safeDensity),
      flowerYellow: Math.round(caps.flowerYellow * safeDensity),
    };

    const width = terrain.width;
    const depth = terrain.depth;
    const halfW = width / 2;
    const halfD = depth / 2;
    const splatRes = terrain.splatResolution || 512;
    const foliageData = terrain.foliageData;

    this.instanceCache = [];
    const counts: Record<FoliageVariant, number> = {
      grass3: 0,
      grass4: 0,
      grass5: 0,
      wheat: 0,
      reeds: 0,
      dryGrass: 0,
      flowerRed: 0,
      flowerBlue: 0,
      flowerWhite: 0,
      flowerYellow: 0,
    };

    const minX = Math.floor((camX - this.RENDER_RADIUS) / this.CELL_SIZE);
    const maxX = Math.ceil((camX + this.RENDER_RADIUS) / this.CELL_SIZE);
    const minZ = Math.floor((camZ - this.RENDER_RADIUS) / this.CELL_SIZE);
    const maxZ = Math.ceil((camZ + this.RENDER_RADIUS) / this.CELL_SIZE);

    for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        const wx = x * this.CELL_SIZE;
        const wz = z * this.CELL_SIZE;

        if (wx < -halfW || wx > halfW || wz < -halfD || wz > halfD) continue;

        const distToCam = Math.hypot(wx - camX, wz - camZ);
        if (distToCam > this.RENDER_RADIUS) continue;

        const u = (wx + halfW) / width;
        const v = (wz + halfD) / depth;
        const px = Math.min(splatRes - 1, Math.max(0, Math.floor(u * splatRes)));
        const pz = Math.min(splatRes - 1, Math.max(0, Math.floor(v * splatRes)));
        const fIdx = (pz * splatRes + px) * 5;

        // Плотность зон растительности
        const dGrass = foliageData[fIdx + 0];
        const dWheat = foliageData[fIdx + 1];
        const dReeds = foliageData[fIdx + 2];
        const dDryGrass = foliageData[fIdx + 3];
        const dFlowers = foliageData[fIdx + 4];

        const totalDensity = dGrass + dWheat + dReeds + dDryGrass + dFlowers;
        if (totalDensity < GRASS_CONFIG.densityThreshold) continue;

        const hProb = fastHash(x, z, 1) * 255;
        if (hProb > Math.min(255, totalDensity)) continue;

        const terrainY = getTerrainHeightAt(terrain, wx, wz);
        if (terrainY === null) continue;

        const terrainNorm = getTerrainNormalAt(terrain, wx, wz);
        const canGrowOnTerrain = terrainNorm.y >= 0.75;

        const candidateSurfaces: Array<{ y: number; isMeshSurface: boolean }> = [];

        // Поиск нависающих 3D-мешей (скалы, каменные уступы)
        if (physicsDriver && physicsDriver.isReady && world) {
          let rayStartY = Math.max(35.0, terrainY + 20.0);
          for (let layer = 0; layer < 3; layer++) {
            const maxRayDist = rayStartY - (terrainY + 0.3);
            if (maxRayDist <= 0.05) break;

            const hit = physicsDriver.castRay(
              { x: wx, y: rayStartY, z: wz },
              { x: 0, y: -1, z: 0 },
              maxRayDist,
              true
            );
            if (!hit || hit.point.y <= terrainY + 0.3) break;

            const isUpward = hit.normal.y >= 0.75;
            let canGrow = false;

            if (hit.entityId) {
              const hitTag = world.getComponent(hit.entityId, 'tag');
              const hitMeta = world.getComponent(hit.entityId, 'meta');
              const subType = hitTag?.subType;
              const arch = hitTag?.archetype ?? hitMeta?.entityType;

              const isNatural =
                subType === 'rock' || subType === 'terrain_extension' || arch === 'terrain';
              const isManMadeOrLiving =
                subType === 'house' ||
                subType === 'fence' ||
                arch === 'creature' ||
                arch === 'item' ||
                arch === 'zone' ||
                arch === 'marker';

              if (isNatural && !isManMadeOrLiving) {
                canGrow = true;
              }
            }

            if (isUpward && canGrow) {
              candidateSurfaces.push({ y: hit.point.y, isMeshSurface: true });
            }

            rayStartY = hit.point.y - 0.25;
            if (rayStartY <= terrainY + 0.3) break;
          }
        }

        if (canGrowOnTerrain) {
          candidateSurfaces.push({ y: terrainY, isMeshSurface: false });
        }

        if (candidateSurfaces.length === 0) continue;

        for (let sIdx = 0; sIdx < candidateSurfaces.length; sIdx++) {
          const surface = candidateSurfaces[sIdx];
          const wy = surface.y;

          // Взвешенный выбор модели по плотностям зон в текущей точке
          const choiceRoll = fastHash(x + sIdx * 101, z + sIdx * 37, 2) * totalDensity;
          let variant: FoliageVariant = 'grass3';

          if (choiceRoll < dWheat) {
            variant = 'wheat';
          } else if (choiceRoll < dWheat + dReeds) {
            variant = 'reeds';
          } else if (choiceRoll < dWheat + dReeds + dDryGrass) {
            variant = 'dryGrass';
          } else if (choiceRoll < dWheat + dReeds + dDryGrass + dFlowers) {
            const flowerRoll = fastHash(x + sIdx * 29, z + sIdx * 41, 10);
            if (flowerRoll < 0.25) variant = 'flowerRed';
            else if (flowerRoll < 0.5) variant = 'flowerBlue';
            else if (flowerRoll < 0.75) variant = 'flowerWhite';
            else variant = 'flowerYellow';
          } else {
            const grassRoll = fastHash(x + sIdx * 17, z + sIdx * 19, 11);
            if (grassRoll < 0.55) variant = 'grass3';
            else if (grassRoll < 0.85) variant = 'grass4';
            else variant = 'grass5';
          }

          if (counts[variant] >= targetMax[variant]) continue;

          // Джиттеринг для исключения эффекта регулярной сетки
          const jitterX = (fastHash(x + sIdx * 53, z, 3) - 0.5) * this.CELL_SIZE * 0.85;
          const jitterZ = (fastHash(x, z + sIdx * 71, 4) - 0.5) * this.CELL_SIZE * 0.85;
          const finalX = wx + jitterX;
          const finalZ = wz + jitterZ;

          const rotX = (fastHash(x, z + sIdx * 17, 5) - 0.5) * 0.1;
          const rotY = fastHash(x + sIdx * 29, z, 6) * Math.PI * 2;
          const rotZ = (fastHash(x, z + sIdx * 43, 7) - 0.5) * 0.1;

          let baseScale = 0.75 + fastHash(x + sIdx * 11, z, 8) * 0.5;
          if (variant === 'wheat' || variant === 'reeds') baseScale *= 1.25;

          const scaleX = baseScale;
          const scaleY = baseScale * (0.85 + fastHash(x, z + sIdx * 13, 9) * 0.3);
          const scaleZ = baseScale;

          this.instanceCache.push({
            x: finalX,
            y: wy,
            z: finalZ,
            isMeshSurface: surface.isMeshSurface,
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

          this.getMeshForVariant(variant)?.setMatrixAt(counts[variant]++, this.dummy.matrix);
        }
      }
    }

    this.commitInstanceCounts(counts);
  }

  private updateHeightsOnly(terrain: TerrainComponent): void {
    const caps = GRASS_CONFIG.capacities;
    const safeDensity = Math.max(0, Math.min(1, this.densityFactor));
    const targetMax: Record<FoliageVariant, number> = {
      grass3: Math.round(caps.blade3 * safeDensity),
      grass4: Math.round(caps.blade4 * safeDensity),
      grass5: Math.round(caps.blade5 * safeDensity),
      wheat: Math.round(caps.wheat * safeDensity),
      reeds: Math.round(caps.reeds * safeDensity),
      dryGrass: Math.round(caps.dryGrass * safeDensity),
      flowerRed: Math.round(caps.flowerRed * safeDensity),
      flowerBlue: Math.round(caps.flowerBlue * safeDensity),
      flowerWhite: Math.round(caps.flowerWhite * safeDensity),
      flowerYellow: Math.round(caps.flowerYellow * safeDensity),
    };

    const counts: Record<FoliageVariant, number> = {
      grass3: 0,
      grass4: 0,
      grass5: 0,
      wheat: 0,
      reeds: 0,
      dryGrass: 0,
      flowerRed: 0,
      flowerBlue: 0,
      flowerWhite: 0,
      flowerYellow: 0,
    };

    for (const inst of this.instanceCache) {
      let wy = inst.y;
      let scaleMult = 1.0;

      if (!inst.isMeshSurface) {
        const h = getTerrainHeightAt(terrain, inst.x, inst.z);
        if (h !== null) {
          wy = h;
          const norm = getTerrainNormalAt(terrain, inst.x, inst.z);
          if (norm.y < 0.75) {
            scaleMult = 0.0;
          }
        }
      }

      if (counts[inst.variant] >= targetMax[inst.variant]) continue;

      this.dummy.position.set(inst.x, wy, inst.z);
      this.dummy.rotation.set(inst.rotX, inst.rotY, inst.rotZ);
      this.dummy.scale.set(
        inst.scaleX * scaleMult,
        inst.scaleY * scaleMult,
        inst.scaleZ * scaleMult
      );
      this.dummy.updateMatrix();

      this.getMeshForVariant(inst.variant)?.setMatrixAt(counts[inst.variant]++, this.dummy.matrix);
    }

    this.commitInstanceCounts(counts);
  }

  private getMeshForVariant(variant: FoliageVariant): THREE.InstancedMesh | null {
    switch (variant) {
      case 'grass3':
        return this.meshGrass3;
      case 'grass4':
        return this.meshGrass4;
      case 'grass5':
        return this.meshGrass5;
      case 'wheat':
        return this.meshWheat;
      case 'reeds':
        return this.meshReeds;
      case 'dryGrass':
        return this.meshDryGrass;
      case 'flowerRed':
        return this.meshFlowerRed;
      case 'flowerBlue':
        return this.meshFlowerBlue;
      case 'flowerWhite':
        return this.meshFlowerWhite;
      case 'flowerYellow':
        return this.meshFlowerYellow;
    }
  }

  private commitInstanceCounts(counts: Record<FoliageVariant, number>): void {
    const list: [THREE.InstancedMesh | null, number][] = [
      [this.meshGrass3, counts.grass3],
      [this.meshGrass4, counts.grass4],
      [this.meshGrass5, counts.grass5],
      [this.meshWheat, counts.wheat],
      [this.meshReeds, counts.reeds],
      [this.meshDryGrass, counts.dryGrass],
      [this.meshFlowerRed, counts.flowerRed],
      [this.meshFlowerBlue, counts.flowerBlue],
      [this.meshFlowerWhite, counts.flowerWhite],
      [this.meshFlowerYellow, counts.flowerYellow],
    ];

    for (const [mesh, count] of list) {
      if (mesh) {
        mesh.count = count;
        mesh.instanceMatrix.needsUpdate = true;
        mesh.computeBoundingSphere();
      }
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

    // 2. Другие существа (включая собак)
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

    // 3. Предметы (брошенные, летящие или катящиеся мячи/палки)
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
    const meshes = [
      this.meshGrass3,
      this.meshGrass4,
      this.meshGrass5,
      this.meshWheat,
      this.meshReeds,
      this.meshDryGrass,
      this.meshFlowerRed,
      this.meshFlowerBlue,
      this.meshFlowerWhite,
      this.meshFlowerYellow,
    ];
    for (const m of meshes) {
      if (m) {
        this.scene.remove(m);
        m.dispose();
      }
    }
    this.meshGrass3 = null;
    this.meshGrass4 = null;
    this.meshGrass5 = null;
    this.meshWheat = null;
    this.meshReeds = null;
    this.meshDryGrass = null;
    this.meshFlowerRed = null;
    this.meshFlowerBlue = null;
    this.meshFlowerWhite = null;
    this.meshFlowerYellow = null;

    this.instanceCache = [];
    this.isGenerated = false;
    this.timeSinceLastRegen = 0;
    this.lastFoliageVersion = -1;
    this.lastGeometryVersion = -1;
    this.lastDensityFactor = GRASS_CONFIG.defaultDensityFactor;

    this.trampleManager.clear(this.renderer);
  }

  public destroy(): void {
    this.clear();
    this.geoGrass3.dispose();
    this.geoGrass4.dispose();
    this.geoGrass5.dispose();
    this.geoWheat.dispose();
    this.geoReeds.dispose();
    this.geoDryGrass.dispose();
    this.geoFlowerRed.dispose();
    this.geoFlowerBlue.dispose();
    this.geoFlowerWhite.dispose();
    this.geoFlowerYellow.dispose();
    this.grassMaterial.dispose();
    this.trampleManager.destroy();
  }
}
