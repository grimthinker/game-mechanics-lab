import * as THREE from 'three';
import { World } from '../World';
import { EntityId, AnimatorComponent } from '../types';
import { IPhysicsDriver } from '../../physics/IPhysicsDriver';
import { GameMode } from '../../config/gameConfig';
import { AssetManager } from '../../rendering/AssetManager';
import { CREATURE_RIG_PROFILES } from '../../rendering/rigProfiles';
import { BodyStructureType } from '../templates';
import { getAggregatedInteractionSlots, getRootOwner } from '../utils/hierarchy';
import { computeItemGrip, GripTransform } from '../../rendering/gripCalculators';
import { ProceduralCreatureAssetManager } from '../../rendering/creatures/ProceduralAssetManager';
import { TerrainSyncSystem } from '../../rendering/terrain/TerrainSyncSystem';
import {
  CreatureMeshAssembler,
  RigAnimatorState as AnimatorState,
} from '../../rendering/creatures/CreatureMeshAssembler';
import { RigSocketBinder } from '../../rendering/creatures/RigSocketBinder';
import {
  disposeObject,
  attachOutlines,
  createOutlineShaderMaterial,
} from '../../rendering/renderUtils';
import { AttackVisualsManager } from '../../rendering/attacks/AttackVisualsManager';
import { GrassSyncSystem } from '../../rendering/grass/GrassSyncSystem';
import { BALANCE_CONFIG } from '../../config/balanceConfig';
import { ToonMaterialManager } from '../../rendering/materials/ToonMaterialManager';

const PROCEDURAL_PROP_SCALES: Record<string, { baseRadius: number; baseHeight: number }> = {
  'proc://prop/tree': { baseRadius: 0.6, baseHeight: 4.0 },
  'proc://prop/house': { baseRadius: 2.7, baseHeight: 5.5 },
  'proc://prop/fence': { baseRadius: 1.2, baseHeight: 1.15 },
  'proc://prop/rock_1': { baseRadius: 1.1, baseHeight: 1.25 },
  'proc://prop/rock_2': { baseRadius: 1.2, baseHeight: 0.75 },
  'proc://prop/rock_3': { baseRadius: 1.2, baseHeight: 1.5 },
  'proc://prop/rock_4': { baseRadius: 1.2, baseHeight: 1.6 },
  'proc://prop/rock_5': { baseRadius: 1.1, baseHeight: 1.45 },
};

export class ThreeSyncSystem {
  public static disposeObject = disposeObject;
  public static attachOutlines = attachOutlines;

  private scene: THREE.Scene;
  private meshes: Map<EntityId, THREE.Object3D> = new Map();
  private loadingMeshes: Set<EntityId> = new Set();
  private loadingGenerations: Map<EntityId, number> = new Map();

  // Кэш для аниматоров (Стейт-машина)
  private animators: Map<EntityId, AnimatorState> = new Map();

  // Делегированные подсистемы
  public physicsDriver: IPhysicsDriver | null = null;
  private attackVisualsManager: AttackVisualsManager;
  private terrainSync: TerrainSyncSystem;
  private creatureAssembler: CreatureMeshAssembler;
  private socketBinder: RigSocketBinder = new RigSocketBinder();
  private grassSync: GrassSyncSystem;
  private toonManager = ToonMaterialManager.getInstance();
  private isCelShading: boolean = false;

  // Кэшированные материалы для производительности (фоллбэк)
  private matPlayer = new THREE.MeshLambertMaterial({ color: 0x2980b9 });
  private matEnemy = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  private matIdle = new THREE.MeshLambertMaterial({ color: 0x34495e });
  private matObstacle = new THREE.MeshLambertMaterial({ color: 0x555555 });
  private matWeapon = new THREE.MeshLambertMaterial({ color: 0xf1c40f });
  private matArmor = new THREE.MeshLambertMaterial({ color: 0x3498db });
  private matBag = new THREE.MeshLambertMaterial({ color: 0x2ecc71 });

  private matZoneDmg = new THREE.MeshBasicMaterial({
    color: 0xe74c3c,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  private matZoneJoint = new THREE.MeshBasicMaterial({
    color: 0xe67e22,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  private matZoneHeal = new THREE.MeshBasicMaterial({
    color: 0x2ecc71,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  private matZoneNeutral = new THREE.MeshBasicMaterial({
    color: 0x9b59b6,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  private matZoneSlow = new THREE.MeshBasicMaterial({
    color: 0x3498db,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  private matZoneFast = new THREE.MeshBasicMaterial({
    color: 0x1abc9c,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  private matSelection = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });
  private matSilhouetteOutline = createOutlineShaderMaterial(0x2ecc71, 3.2);
  private matCelOutline = createOutlineShaderMaterial(0x151515, 2.0);

  constructor(scene: THREE.Scene, renderer?: THREE.WebGLRenderer) {
    this.scene = scene;
    this.attackVisualsManager = new AttackVisualsManager(scene);
    this.terrainSync = new TerrainSyncSystem();
    this.creatureAssembler = new CreatureMeshAssembler(
      scene,
      this.matSilhouetteOutline,
      this.loadingMeshes,
      this.loadingGenerations,
      (id, state) => this.animators.set(id, state),
      (id, animator, anim) => this.playAnimation(id, animator, anim)
    );
    this.grassSync = new GrassSyncSystem(scene, renderer);
  }

  public clearMeshes(): void {
    for (const [, mesh] of this.meshes.entries()) {
      ThreeSyncSystem.disposeObject(mesh);
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
    }
    this.attackVisualsManager.clear();
    this.grassSync.clear();
    this.meshes.clear();
    this.animators.clear();
    this.loadingMeshes.clear();
    this.loadingGenerations.clear();
  }

  public destroy(): void {
    this.clearMeshes();
    this.attackVisualsManager.destroy();
    this.grassSync.destroy();
    this.toonManager.clear();

    // Очищаем кэшированные фоллбэк-материалы
    this.matPlayer.dispose();
    this.matEnemy.dispose();
    this.matIdle.dispose();
    this.matObstacle.dispose();
    this.matWeapon.dispose();
    this.matArmor.dispose();
    this.matBag.dispose();
    this.matZoneDmg.dispose();
    this.matZoneJoint.dispose();
    this.matZoneHeal.dispose();
    this.matZoneNeutral.dispose();
    this.matZoneSlow.dispose();
    this.matZoneFast.dispose();
    this.matSelection.dispose();
    this.matSilhouetteOutline.dispose();
    this.matCelOutline.dispose();
  }

  public update(
    dt: number,
    world: World,
    _gameMode: GameMode,
    selectedIds: Set<EntityId>,
    celShading: boolean = false,
    cameraTargetX: number = 0,
    cameraTargetZ: number = 0
  ): void {
    if (celShading !== this.isCelShading) {
      this.isCelShading = celShading;
      for (const [, obj] of this.meshes.entries()) {
        if (this.isCelShading) {
          this.toonManager.applyToon(obj);
          obj.userData.isToonApplied = true;
        } else {
          this.toonManager.restoreOriginal(obj);
          delete obj.userData.isToonApplied;
        }
      }
    }

    const activeIds = new Set<EntityId>();
    const renderables = world.getEntitiesWith('transform', 'renderable');

    // Обновляем миксеры с учетом динамической скорости (playbackSpeed) и локального масштаба времени (timeScale) сущности
    for (const [id, state] of this.animators.entries()) {
      const animatorComp = world.getComponent(id, 'animator');
      if (state.currentAction && animatorComp) {
        const structureType = animatorComp.rigType as BodyStructureType;
        const rigProfile = CREATURE_RIG_PROFILES[structureType];
        const profileSpeed = rigProfile?.animationSpeeds?.[state.currentClipName] ?? 1.0;
        const ecsSpeed = animatorComp.playbackSpeed ?? 1.0;
        state.currentAction.setEffectiveTimeScale(profileSpeed * ecsSpeed);
      }

      const ts = world.getComponent(id, 'timeScale')?.multiplier.current ?? 1.0;
      state.mixer.timeScale = ts;
      state.mixer.update(dt);
    }

    for (const [id, { transform, renderable }] of renderables) {
      const ownership = world.getComponent(id, 'ownership');

      // Предмет находится в руке, если его держит ячейка взаимодействия части тела или существа
      let isEquippedInHand = false;
      if (ownership && ownership.status === 'equipped') {
        const directSlot = world.getComponent(ownership.ownerId, 'interactionSlots');
        if (directSlot && directSlot.itemId === id) {
          isEquippedInHand = true;
        } else {
          const aggSlots = getAggregatedInteractionSlots(world, ownership.ownerId);
          if (aggSlots.some((s) => s.slot.itemId === id)) {
            isEquippedInHand = true;
          } else {
            const rootOwner = getRootOwner(world, ownership.ownerId);
            if (rootOwner && rootOwner !== ownership.ownerId) {
              const rootSlots = getAggregatedInteractionSlots(world, rootOwner);
              if (rootSlots.some((s) => s.slot.itemId === id)) {
                isEquippedInHand = true;
              }
            }
          }
        }
      }

      // Экипированные в руки предметы не отбрасываются из рендера, даже если скрыты на полу
      if (!renderable.isVisible && !isEquippedInHand) continue;

      activeIds.add(id);

      const tag = world.getComponent(id, 'tag');
      const archetype = tag?.archetype;

      if (archetype === 'marker') continue;

      let obj = this.meshes.get(id);

      // 1. Создание меша
      if (!obj) {
        if (!this.loadingMeshes.has(id)) {
          obj = this.createMeshForEntity(world, id, archetype);
          if (obj) {
            this.scene.add(obj);
            this.meshes.set(id, obj);
          }
        }
      }

      // 2. Обновление состояния меша
      if (obj) {
        // Если предмет не находится в руке, гарантируем его нахождение в корне сцены
        if (!isEquippedInHand) {
          if (obj.parent !== this.scene) {
            this.scene.add(obj);
          }
          obj.position.set(transform.x, transform.y, transform.z);
          if (transform.rotation) {
            obj.quaternion.set(
              transform.rotation.x,
              transform.rotation.y,
              transform.rotation.z,
              transform.rotation.w
            );
          }

          // Модульные существа масштабируются непропорционально: по осям X/Z от радиуса, по оси Y от роста
          if (obj.userData.isModularRig) {
            const physStats = world.getComponent(id, 'physicsStats');
            const animator = world.getComponent(id, 'animator');
            const rigType = animator?.rigType as BodyStructureType;

            let baseRadius = 0.4;
            let baseHeight = 1.8;
            if (rigType === 'quadruped') {
              baseRadius = 0.35;
              baseHeight = 0.8;
            } else if (rigType === 'arachnid') {
              baseRadius = 0.6;
              baseHeight = 0.5;
            }

            const radius = physStats?.radius.current ?? baseRadius;
            const height = physStats?.height.current ?? baseHeight;

            const scaleXZ = radius / baseRadius;
            const scaleY = height / baseHeight;
            obj.scale.set(scaleXZ, scaleY, scaleXZ);
          } else if (obj.userData.isDetachedLimb) {
            // Масштаб отрубленной конечности пропорционален ее реальному сохраненному радиусу
            const physStats = world.getComponent(id, 'physicsStats');
            const limbRadius = physStats?.radius.current ?? 0.3;
            const limbScale = (limbRadius / 0.3) * 0.75;
            obj.scale.set(limbScale, limbScale, limbScale);
          } else if (archetype === 'zone') {
            const effector = world.getComponent(id, 'areaEffector');
            const physStats = world.getComponent(id, 'physicsStats');
            const r = effector?.radius ?? physStats?.radius.current ?? 2.5;
            obj.scale.set(r, 1, r);
          } else if (archetype === 'obstacle') {
            const physStats = world.getComponent(id, 'physicsStats');
            const visual = world.getComponent(id, 'visualModel');
            const propScale = visual?.modelId ? PROCEDURAL_PROP_SCALES[visual.modelId] : undefined;

            if (propScale) {
              const r = physStats?.radius.current ?? propScale.baseRadius;
              const h = physStats?.height.current ?? propScale.baseHeight;
              obj.scale.set(
                r / propScale.baseRadius,
                h / propScale.baseHeight,
                r / propScale.baseRadius
              );
            } else {
              const r = physStats?.radius.current ?? 1.0;
              const h = physStats?.height.current ?? 1.5;
              const baseW = (obj.userData.baseWidth as number) ?? 2.0;
              const baseD = (obj.userData.baseDepth as number) ?? 2.0;
              const baseH = (obj.userData.baseHeight as number) ?? 1.5;
              const baseR = Math.max(baseW, baseD) / 2 || 1;
              obj.scale.set(r / baseR, h / baseH, r / baseR);
            }
          } else {
            obj.scale.set(1, 1, 1);
          }
        } else {
          // Применяем рассчитанную точку хвата (Grip Transform)
          const grip = obj.userData.gripTransform as GripTransform | undefined;
          if (grip) {
            obj.position.copy(grip.position);
            obj.quaternion.copy(grip.quaternion);
          } else {
            obj.position.set(0, 0, 0);
            obj.rotation.set(0, 0, 0);
          }
          obj.scale.set(1, 1, 1);
        }

        // Применение Cel Shading к новым и асинхронно загруженным моделям
        if (this.isCelShading && !obj.userData.isToonApplied) {
          this.toonManager.applyToon(obj);
          if (!this.loadingMeshes.has(id)) {
            obj.userData.isToonApplied = true;
          }
        }

        // Синхронизация геометрии и текстурных масок террейна
        if (archetype === 'terrain') {
          const terrainComp = world.getComponent(id, 'terrain');
          if (terrainComp) {
            this.terrainSync.syncTerrain(obj, terrainComp);
          }
        }

        const isSelected = selectedIds.has(id);
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.isSelectionOutline) {
            if (isSelected) {
              child.material = this.matSilhouetteOutline;
              child.visible = true;
            } else if (this.isCelShading) {
              child.material = this.matCelOutline;
              child.visible = true;
            } else {
              child.visible = false;
            }
          }
        });

        // 3. Управление анимацией и ригом модульного существа
        if (obj.userData.isModularRig) {
          const animState = this.animators.get(id);
          const animatorComp = world.getComponent(id, 'animator');

          if (animState && animatorComp) {
            // Воспроизведение анимации строго из состояния ECS без обратной мутации
            if (animState.targetClipName !== animatorComp.currentAnimation) {
              animState.targetClipName = animatorComp.currentAnimation;
              this.playAnimation(id, animatorComp, animatorComp.currentAnimation).catch((e) =>
                console.warn(e)
              );
            }

            // Управление отрубленными конечностями
            const assembly = world.getComponent(id, 'assemblyRoot');
            if (assembly && assembly.partIds) {
              const currentPartIds = new Set(assembly.partIds);
              obj.traverse((child) => {
                if (child.userData.partId) {
                  child.visible = currentPartIds.has(child.userData.partId);
                }
              });
            }

            // Прикрепление экипированного оружия/предметов в кости рук через RigSocketBinder
            this.socketBinder.syncCreatureSockets(id, animState, world, this.meshes, this.scene);
          }
        }
        // 4. Фоллбэк-визуализация примитивов
        else if (!isEquippedInHand) {
          const health = world.getComponent(id, 'health');
          if (health && !health.isAlive && archetype === 'creature') {
            obj.scale.set(1, 0.1, 1);
            obj.position.y = 0.05;
          } else if (archetype === 'creature') {
            const physStats = world.getComponent(id, 'physicsStats');
            const baseH = physStats?.height.current ?? 1.8;
            const radius = physStats?.radius.current ?? 0.4;
            const scaleXZ = radius / 0.4; // базовая ширина "заглушки"

            const transition = world.getComponent(id, 'stanceTransition');
            let currentHeight = baseH;

            const getH = (st: string) =>
              baseH *
              (BALANCE_CONFIG.creature.stanceHeightMultipliers[
                st as keyof typeof BALANCE_CONFIG.creature.stanceHeightMultipliers
              ] ?? 1.0);

            if (transition && transition.totalDuration > 0) {
              const progress = Math.min(
                1,
                Math.max(0, 1 - transition.timer / transition.totalDuration)
              );
              const fromH = getH(transition.fromStance);
              const toH = getH(transition.toStance);
              currentHeight = fromH + (toH - fromH) * progress;
            } else {
              const currentStance = world.getComponent(id, 'meta')?.stance || 'standing';
              currentHeight = getH(currentStance);
            }

            // Если фоллбэк - это CylinderGeometry, его оригинальная высота была 1.8
            obj.scale.set(scaleXZ, currentHeight / 1.8, scaleXZ);
            obj.position.y = 0;
          }

          if (archetype === 'zone') {
            const effector = world.getComponent(id, 'areaEffector');
            if (effector) {
              let mat = this.matZoneNeutral;
              if (effector.effect === 'damage') mat = this.matZoneDmg;
              else if (effector.effect === 'joint_damage') mat = this.matZoneJoint;
              else if (effector.effect === 'heal') mat = this.matZoneHeal;
              else if (effector.effect === 'time_dilation') {
                mat = effector.valuePerSec > 1.0 ? this.matZoneFast : this.matZoneSlow;
              }
              const mainMesh = obj.children.find(
                (c) => c instanceof THREE.Mesh && !c.userData.isSelectionOutline
              ) as THREE.Mesh;
              if (mainMesh && mainMesh.material !== mat) mainMesh.material = mat;
            }
          }
        }
      }
    }

    // Очистка удаленных из мира сущностей с освобождением VRAM
    for (const [id, mesh] of this.meshes.entries()) {
      if (!activeIds.has(id)) {
        this.loadingGenerations.set(id, (this.loadingGenerations.get(id) ?? 0) + 1);
        ThreeSyncSystem.disposeObject(mesh);
        if (mesh.parent) {
          mesh.parent.remove(mesh);
        }
        this.meshes.delete(id);
        this.animators.delete(id);
      }
    }

    // Синхронизация 3D зон атак в активных фазах prep и cast через менеджер
    this.attackVisualsManager.update(world);

    // Синхронизация процедурной интерактивной травы с поддержкой многоуровневых мешей
    const terrainEntities = world.getEntitiesWith('terrain');
    const terrainComp = terrainEntities.length > 0 ? terrainEntities[0][1].terrain : undefined;
    this.grassSync.update(dt, world, this.physicsDriver, terrainComp, cameraTargetX, cameraTargetZ);
  }

  private async playAnimation(
    entityId: EntityId,
    animatorComp: AnimatorComponent,
    animKey: string
  ) {
    const state = this.animators.get(entityId);
    if (!state) return;

    if (state.currentClipName === animKey && state.currentAction?.isRunning()) {
      return;
    }

    const structureType = animatorComp.rigType as BodyStructureType;
    const rigProfile = CREATURE_RIG_PROFILES[structureType];
    if (!rigProfile) return;

    let clip: THREE.AnimationClip | null = null;

    if (ProceduralCreatureAssetManager.getInstance().hasBuilder(structureType)) {
      clip = ProceduralCreatureAssetManager.getInstance().getAnimationClip(structureType, animKey);
    }

    if (!clip) {
      const animUrl = rigProfile.animations[animKey] || rigProfile.animations['stand_idle'];
      if (!animUrl || animUrl.startsWith('proc://')) return;

      try {
        const gltfAnim = await AssetManager.getInstance().loadGLTF(animUrl);
        if (state.targetClipName !== animKey) return;
        if (gltfAnim.animations && gltfAnim.animations.length > 0) {
          clip = gltfAnim.animations[0];
        }
      } catch (e) {
        console.warn(`[ThreeSyncSystem] Animation failed to load: ${animUrl}`);
        return;
      }
    }

    if (!clip) return;
    if (state.targetClipName !== animKey) return;

    const action = state.mixer.clipAction(clip);
    action.reset();

    const profileSpeed = rigProfile.animationSpeeds?.[animKey] ?? 1.0;
    const ecsSpeed = animatorComp.playbackSpeed ?? 1.0;

    action.setEffectiveTimeScale(profileSpeed * ecsSpeed);
    action.setEffectiveWeight(1);

    const isOneShot =
      animKey === 'dead' ||
      animKey.startsWith('attack') ||
      animKey.startsWith('pickup') ||
      animKey.startsWith('drop_item') ||
      animKey.startsWith('throw_item') ||
      animKey === 'throw' ||
      animKey.includes('_to_');

    if (isOneShot) {
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
    } else {
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.clampWhenFinished = false;
    }

    action.fadeIn(0.12);
    action.play();

    if (state.currentAction && state.currentAction !== action) {
      state.currentAction.fadeOut(0.12);
    }

    state.currentAction = action;
    state.currentClipName = animKey;
  }

  private createMeshForEntity(
    world: World,
    id: EntityId,
    archetype: string | undefined
  ): THREE.Object3D | undefined {
    // Сборка модульного рига для существ через ассемблер
    if (this.creatureAssembler.canAssembleModularRig(world, id, archetype)) {
      return this.creatureAssembler.createModularRig(world, id);
    }

    // Сборка оторванной составной части тела через ассемблер
    if (this.creatureAssembler.canAssembleDetachedLimb(world, id, archetype)) {
      return this.creatureAssembler.createDetachedLimb(world, id);
    }

    // Загрузка реального 3D меша для сущностей с визуальной моделью (предметы, препятствия, части тела)
    const visual = world.getComponent(id, 'visualModel');
    if (visual && visual.modelId) {
      const group = new THREE.Group();
      group.userData.entityId = id;
      this.loadingMeshes.add(id);

      const currentGen = (this.loadingGenerations.get(id) ?? 0) + 1;
      this.loadingGenerations.set(id, currentGen);

      AssetManager.getInstance()
        .getClonedModel(visual.modelId)
        .then((mesh) => {
          if (this.loadingGenerations.get(id) !== currentGen || !world.getEntity(id)) {
            if (mesh) ThreeSyncSystem.disposeObject(mesh);
            ThreeSyncSystem.disposeObject(group);
            this.scene.remove(group);
            return;
          }

          if (mesh) {
            if (mesh.type === 'Scene' || mesh.type === 'Group') {
              group.add(...mesh.children);
            } else {
              group.add(mesh);
            }

            if (archetype === 'item' || archetype === 'bodyPart') {
              const itemComp = world.getComponent(id, 'item');
              group.userData.gripTransform = computeItemGrip(group, itemComp?.type);
            }

            ThreeSyncSystem.attachOutlines(group, this.matSilhouetteOutline);
          }
        })
        .catch(console.error)
        .finally(() => {
          if (this.loadingGenerations.get(id) === currentGen) {
            this.loadingMeshes.delete(id);
          }
        });

      return group;
    }

    // --- ФОЛЛБЭК ДЛЯ ПРИМИТИВОВ (Зоны, Препятствия) ---
    const physStats = world.getComponent(id, 'physicsStats');
    const radius = physStats ? physStats.radius.current : 0.4;
    const group = new THREE.Group();
    let mainMesh: THREE.Mesh | null = null;

    if (archetype === 'creature') {
      const aiStats = world.getComponent(id, 'aiStats');
      const behavior = aiStats?.behavior?.current;
      let mat = this.matIdle;
      if (behavior === 'PlayerTree') mat = this.matPlayer;
      else if (behavior === 'AttackerTree') mat = this.matEnemy;

      const h = physStats?.height?.current ?? 1.8;
      const geo = new THREE.CylinderGeometry(radius, radius, h, 16);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = h / 2;

      const noseGeo = new THREE.BoxGeometry(radius, radius * 0.4, radius * 0.4);
      const nose = new THREE.Mesh(noseGeo, mat);
      nose.position.set(radius, h * 0.75, 0);
      group.add(nose);
    } else if (archetype === 'obstacle') {
      let w = 4.0,
        d = 1.0;
      if (physStats?.points && physStats.points.length > 0) {
        let minX = physStats.points[0].x,
          maxX = physStats.points[0].x,
          minY = physStats.points[0].y,
          maxY = physStats.points[0].y;
        physStats.points.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
        w = Math.max(0.2, maxX - minX);
        d = Math.max(0.2, maxY - minY);
      }
      const h = physStats?.height?.current ?? 1.5;
      const geo = new THREE.BoxGeometry(w, h, d);
      mainMesh = new THREE.Mesh(geo, this.matObstacle);
      mainMesh.position.y = h / 2;

      group.userData.baseWidth = w;
      group.userData.baseDepth = d;
      group.userData.baseHeight = h;
    } else if (archetype === 'item' || archetype === 'bodyPart') {
      const item = world.getComponent(id, 'item');
      let mat = this.matWeapon;
      if (archetype === 'bodyPart') mat = this.matEnemy;
      else if (item?.type === 'armor') mat = this.matArmor;
      else if (item?.type === 'bag') mat = this.matBag;

      const size = radius * 0.8;
      const geo = new THREE.BoxGeometry(size, size, size);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = 0;
    } else if (archetype === 'zone') {
      const effector = world.getComponent(id, 'areaEffector');
      let mat = this.matZoneNeutral;
      if (effector?.effect === 'damage') mat = this.matZoneDmg;
      else if (effector?.effect === 'joint_damage') mat = this.matZoneJoint;
      else if (effector?.effect === 'heal') mat = this.matZoneHeal;
      else if (effector?.effect === 'time_dilation') {
        mat = (effector.valuePerSec ?? 1) > 1.0 ? this.matZoneFast : this.matZoneSlow;
      }
      const geo = new THREE.CylinderGeometry(1, 1, 2, 32);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = 1;
      const r = effector?.radius ?? radius;
      group.scale.set(r, 1, r);
    } else if (archetype === 'terrain') {
      const terrainComp = world.getComponent(id, 'terrain');
      if (terrainComp) {
        return this.terrainSync.createTerrainMesh(id, terrainComp);
      }
    }

    if (mainMesh) {
      group.userData.entityId = id;
      mainMesh.userData.entityId = id;
      mainMesh.userData.isSharedMaterial = true;
      group.add(mainMesh);

      if (archetype === 'item' || archetype === 'bodyPart') {
        const itemComp = world.getComponent(id, 'item');
        group.userData.gripTransform = computeItemGrip(group, itemComp?.type);
      }

      ThreeSyncSystem.attachOutlines(group, this.matSilhouetteOutline);

      return group;
    }

    return undefined;
  }
}
