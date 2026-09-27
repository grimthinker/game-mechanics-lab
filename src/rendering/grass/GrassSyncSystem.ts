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

/** Быстрый целочисленный хэш для пространственной привязки параметров травы (Детерминизм) */
function fastHash(x: number, y: number, seed: number): number {
  let h = (seed + Math.floor(x) * 374761393 + Math.floor(y) * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

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

  // Параметры потоковой подгрузки вокруг камеры
  private lastCamX: number = 999999;
  private lastCamZ: number = 999999;
  private readonly RENDER_RADIUS: number = GRASS_CONFIG.fade.renderRadius;
  private readonly CAM_MOVE_THRESHOLD: number = GRASS_CONFIG.fade.camMoveThreshold;
  private readonly CELL_SIZE: number = 0.4; // Шаг сетки (плотность засева)
  public fadeStartDistance: number = GRASS_CONFIG.fade.fadeStartDistance;
  public fadeEndDistance: number = GRASS_CONFIG.fade.fadeEndDistance;

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.trampleManager = new TrampleTextureManager(256);

    this.geo3 = GrassGeometryBuilder.createClusterGeometry({ bladeCount: 3 });
    this.geo4 = GrassGeometryBuilder.createClusterGeometry({ bladeCount: 4 });
    this.geo5 = GrassGeometryBuilder.createClusterGeometry({ bladeCount: 5 });

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
    if (!terrainComp) {
      if (this.mesh3 || this.mesh4 || this.mesh5) this.clear();
      return;
    }

    const currentSplatVer = terrainComp.splatVersion ?? 0;
    const currentGeomVer = terrainComp.geometryVersion ?? 0;

    const splatChanged = currentSplatVer !== this.lastSplatVersion;
    const geomChanged = currentGeomVer !== this.lastGeometryVersion;
    const densityChanged = this.densityFactor !== this.lastDensityFactor;

    // Перестраиваем траву, если камера сдвинулась дальше порогового значения
    const camMoved =
      Math.hypot(camX - this.lastCamX, camZ - this.lastCamZ) > this.CAM_MOVE_THRESHOLD;

    if (!this.isGenerated || splatChanged || densityChanged || camMoved) {
      // При изменении текстуры, первом запуске, изменении плотности или движении камеры — пересобираем
      this.timeSinceLastRegen += dt;
      if (!this.isGenerated || this.timeSinceLastRegen >= 0.08) {
        this.rebuildGrass(terrainComp, camX, camZ, world, physicsDriver);
        this.isGenerated = true;
        this.timeSinceLastRegen = 0;
        this.lastSplatVersion = currentSplatVer;
        this.lastGeometryVersion = currentGeomVer;
        this.lastDensityFactor = this.densityFactor;
        this.lastCamX = camX;
        this.lastCamZ = camZ;
      }
    } else if (geomChanged) {
      // При изменении высот (скульптинг холмов) — плавно двигаем существующую траву по высоте Y
      this.updateHeightsOnly(terrainComp);
      this.lastGeometryVersion = currentGeomVer;
    }

    // Обновляем время для волн ветра, параметры террейна и положение фокуса камеры для плавного затухания
    const shader = this.grassMaterial.userData.shader;
    if (shader) {
      if (shader.uniforms.uTime) {
        shader.uniforms.uTime.value += dt;
      }
      if (shader.uniforms.uTerrainSize) {
        shader.uniforms.uTerrainSize.value.set(terrainComp.width, terrainComp.depth);
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

    // Симуляция текстуры приминания (GPU Trample Map)
    if (this.renderer) {
      const stamps = this.collectTrampleStamps(world);
      this.trampleManager.update(this.renderer, dt, stamps, terrainComp.width, terrainComp.depth);

      if (shader && shader.uniforms.uTrampleMap) {
        shader.uniforms.uTrampleMap.value = this.trampleManager.getTexture();
      }
    }
  }

  private rebuildGrass(
    terrain: TerrainComponent,
    camX: number,
    camZ: number,
    world?: World,
    physicsDriver?: IPhysicsDriver | null
  ): void {
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

    const width = terrain.width;
    const depth = terrain.depth;
    const halfW = width / 2;
    const halfD = depth / 2;
    const splatRes = terrain.splatResolution || 512;
    const splatData = terrain.splatData;

    this.instanceCache = [];
    let count3 = 0;
    let count4 = 0;
    let count5 = 0;

    // Рассчитываем пределы сетки вокруг камеры с учетом размера ячейки
    const minX = Math.floor((camX - this.RENDER_RADIUS) / this.CELL_SIZE);
    const maxX = Math.ceil((camX + this.RENDER_RADIUS) / this.CELL_SIZE);
    const minZ = Math.floor((camZ - this.RENDER_RADIUS) / this.CELL_SIZE);
    const maxZ = Math.ceil((camZ + this.RENDER_RADIUS) / this.CELL_SIZE);

    outerLoop: for (let z = minZ; z <= maxZ; z++) {
      for (let x = minX; x <= maxX; x++) {
        // Проверяем, не исчерпаны ли пулы инстансов
        const can3 = count3 < targetMax3;
        const can4 = count4 < targetMax4;
        const can5 = count5 < targetMax5;
        if (!can3 && !can4 && !can5) break outerLoop;

        const wx = x * this.CELL_SIZE;
        const wz = z * this.CELL_SIZE;

        // Отбрасываем точки за пределами карты
        if (wx < -halfW || wx > halfW || wz < -halfD || wz > halfD) continue;

        // Отрисовываем траву только в круговом радиусе от камеры (а не в квадрате)
        const distToCam = Math.hypot(wx - camX, wz - camZ);
        if (distToCam > this.RENDER_RADIUS) continue;

        // Подход А: чтение плотности травы по 2D-координатам (X, Z) из Splatmap
        const u = (wx + halfW) / width;
        const v = (wz + halfD) / depth;
        const px = Math.min(splatRes - 1, Math.max(0, Math.floor(u * splatRes)));
        const pz = Math.min(splatRes - 1, Math.max(0, Math.floor(v * splatRes)));
        const splatIdx = (pz * splatRes + px) * 4;

        const grassDensity = splatData[splatIdx + 0];
        if (grassDensity < GRASS_CONFIG.densityThreshold) continue;

        const hProb = fastHash(x, z, 1) * 255;
        if (hProb > grassDensity) continue;

        // Точная высота и уклон базового террейна в данной точке
        const terrainY = getTerrainHeightAt(terrain, wx, wz);
        if (terrainY === null) continue;

        const terrainNorm = getTerrainNormalAt(terrain, wx, wz);
        const canGrowOnTerrain = terrainNorm.y >= 0.75; // Уклон террейна <= ~41 градуса

        // Многоуровневый вертикальный поиск поверхностей (Multi-Surface Raycast)
        const candidateSurfaces: Array<{ y: number; isMeshSurface: boolean }> = [];

        // 1. Поиск 3D-мешей (скалы, козырьки, уступы) строго выше базового уровня земли
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

            // Фильтр нормали для 3D-меша
            const isUpward = hit.normal.y >= 0.75;

            // Фильтр архетипа: разрешено только для природных скал/уступов, исключая искусственные постройки
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

        // 2. Добавляем базовый террейн (только если его поверхность пологая)
        if (canGrowOnTerrain) {
          candidateSurfaces.push({ y: terrainY, isMeshSurface: false });
        }

        // Если склон крутой и нависающих скал нет — трава в этой ячейке не создается
        if (candidateSurfaces.length === 0) continue;

        // Засев травы на каждом подтвержденном ярусе (например: в гроте под навесом и на крыше навеса)
        for (let sIdx = 0; sIdx < candidateSurfaces.length; sIdx++) {
          const surface = candidateSurfaces[sIdx];
          const wy = surface.y;

          const roll = fastHash(x + sIdx * 101, z + sIdx * 37, 2);
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

          // Пространственно-стабильный джиттеринг для устранения эффекта сетки
          const jitterX = (fastHash(x + sIdx * 53, z, 3) - 0.5) * this.CELL_SIZE * 0.85;
          const jitterZ = (fastHash(x, z + sIdx * 71, 4) - 0.5) * this.CELL_SIZE * 0.85;
          const finalX = wx + jitterX;
          const finalZ = wz + jitterZ;

          const rotX = (fastHash(x, z + sIdx * 17, 5) - 0.5) * 0.1;
          const rotY = fastHash(x + sIdx * 29, z, 6) * Math.PI * 2;
          const rotZ = (fastHash(x, z + sIdx * 43, 7) - 0.5) * 0.1;

          const baseScale = 0.75 + fastHash(x + sIdx * 11, z, 8) * 0.55;
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

          if (variant === 3) {
            if (count3 < targetMax3) this.mesh3!.setMatrixAt(count3++, this.dummy.matrix);
          } else if (variant === 4) {
            if (count4 < targetMax4) this.mesh4!.setMatrixAt(count4++, this.dummy.matrix);
          } else {
            if (count5 < targetMax5) this.mesh5!.setMatrixAt(count5++, this.dummy.matrix);
          }
        }
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
      let wy = inst.y;
      let scaleMult = 1.0;

      if (!inst.isMeshSurface) {
        const h = getTerrainHeightAt(terrain, inst.x, inst.z);
        if (h !== null) {
          wy = h;
          // Динамический расчет уклона при редактировании кистью
          const norm = getTerrainNormalAt(terrain, inst.x, inst.z);
          if (norm.y < 0.75) {
            scaleMult = 0.0; // Скрываем траву, если склон стал слишком крутым
          }
        }
      }

      this.dummy.position.set(inst.x, wy, inst.z);
      this.dummy.rotation.set(inst.rotX, inst.rotY, inst.rotZ);
      this.dummy.scale.set(
        inst.scaleX * scaleMult,
        inst.scaleY * scaleMult,
        inst.scaleZ * scaleMult
      );
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
