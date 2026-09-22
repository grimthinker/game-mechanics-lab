import * as THREE from 'three';
import { World } from '../World';
import { EntityId } from '../types';
import { GameMode } from '../../config/gameConfig';
import { AssetManager } from '../../rendering/AssetManager';
import { CREATURE_RIG_PROFILES } from '../../rendering/rigProfiles';
import { BodyStructureType } from '../templates';
import { getAggregatedInteractionSlots } from '../utils/hierarchy';
import { EventBus } from '../../core/EventBus';
import {
  computeDetachedLimbGrip,
  computeItemGrip,
  GripTransform,
} from '../../rendering/gripCalculators';
import { ProceduralAssetManager } from '../../rendering/procedural/ProceduralAssetManager';

interface AnimatorState {
  mixer: THREE.AnimationMixer;
  currentClipName: string;
  targetClipName: string;
  currentAction: THREE.AnimationAction | null;
  rig: THREE.Object3D;
  socketBones: Map<string, THREE.Object3D>;
}

interface AttackVisualState {
  object: THREE.Object3D;
  key: string;
  phase: 'prep' | 'cast';
}

export class ThreeSyncSystem {
  private scene: THREE.Scene;
  private meshes: Map<EntityId, THREE.Object3D> = new Map();
  private loadingMeshes: Set<EntityId> = new Set();
  private loadingGenerations: Map<EntityId, number> = new Map();
  private unsubWorldUpdated: () => void;

  // Кэш для аниматоров (Стейт-машина)
  private animators: Map<EntityId, AnimatorState> = new Map();

  // Визуализаторы зон атак
  private attackVisuals: Map<EntityId, AttackVisualState> = new Map();

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
  private matSilhouetteOutline = new THREE.MeshBasicMaterial({
    color: 0x2ecc71, // Ярко-зеленый цвет контура выделения
    side: THREE.BackSide,
  });

  public static attachOutlines(object: THREE.Object3D, material: THREE.Material): void {
    object.traverse((child) => {
      if (child instanceof THREE.Mesh && !child.userData.isSelectionOutline) {
        const outline = new THREE.Mesh(child.geometry, material);
        outline.scale.set(1.06, 1.06, 1.06);
        outline.userData.isSelectionOutline = true;
        outline.visible = false;
        child.add(outline);
      }
    });
  }

  // Материалы для визуализации атак
  private matAttackPrepMesh = new THREE.MeshBasicMaterial({
    color: 0xf39c12,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private matAttackCastMesh = new THREE.MeshBasicMaterial({
    color: 0xe74c3c,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  private matAttackPrepLine = new THREE.LineBasicMaterial({
    color: 0xf39c12,
    transparent: true,
    opacity: 0.75,
  });
  private matAttackCastLine = new THREE.LineBasicMaterial({
    color: 0xe74c3c,
    transparent: true,
    opacity: 0.95,
  });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.unsubWorldUpdated = EventBus.on('world:updated', () => {
      this.clearMeshes();
    });
  }

  public static disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.userData.isSharedAsset) {
          child.geometry?.dispose();
        }
        if (!child.userData.isSharedAsset && !child.userData.isSharedMaterial) {
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      }
    });
  }

  public clearMeshes(): void {
    for (const [, mesh] of this.meshes.entries()) {
      ThreeSyncSystem.disposeObject(mesh);
      this.scene.remove(mesh);
    }
    for (const [, visual] of this.attackVisuals.entries()) {
      this.disposeAttackObject(visual.object);
      this.scene.remove(visual.object);
    }
    this.meshes.clear();
    this.animators.clear();
    this.attackVisuals.clear();
    this.loadingMeshes.clear();
    this.loadingGenerations.clear();
  }

  public destroy(): void {
    this.unsubWorldUpdated();
    this.clearMeshes();

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

    // Очищаем материалы атак
    this.matAttackPrepMesh.dispose();
    this.matAttackCastMesh.dispose();
    this.matAttackPrepLine.dispose();
    this.matAttackCastLine.dispose();
  }
  public update(dt: number, world: World, _gameMode: GameMode, selectedIds: Set<EntityId>): void {
    const activeIds = new Set<EntityId>();
    const renderables = world.getEntitiesWith('transform', 'renderable');

    // Обновляем миксеры с учетом локального масштаба времени (timeScale) сущности
    for (const [id, state] of this.animators.entries()) {
      const ts = world.getComponent(id, 'timeScale')?.multiplier.current ?? 1.0;
      state.mixer.timeScale = ts;
      state.mixer.update(dt);
    }

    for (const [id, { transform, renderable }] of renderables) {
      const ownership = world.getComponent(id, 'ownership');
      const isEquippedInHand = ownership && ownership.status === 'equipped';

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
        const ownership = world.getComponent(id, 'ownership');
        const isEquipped = ownership && ownership.status === 'equipped';

        // Если предмет не экипирован, гарантируем его нахождение в корне сцены
        if (!isEquipped) {
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

          // Модульные существа масштабируются пропорционально метрическому радиусу коллизии (база = 0.4м)
          if (obj.userData.isModularRig) {
            const physStats = world.getComponent(id, 'physicsStats');
            const radius = physStats ? physStats.radius.current : 0.4;
            const baseRadius = 0.4;
            const scaleFactor = radius / baseRadius;
            obj.scale.set(scaleFactor, scaleFactor, scaleFactor);
          } else if (obj.userData.isDetachedLimb) {
            // Сохраняем анатомический масштаб гуманоида (0.3 / 0.4 = 0.75) для отсоединенных частей
            obj.scale.set(0.75, 0.75, 0.75);
          } else if (archetype === 'zone') {
            const effector = world.getComponent(id, 'areaEffector');
            const physStats = world.getComponent(id, 'physicsStats');
            const r = effector?.radius ?? physStats?.radius.current ?? 2.5;
            obj.scale.set(r, 1, r);
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

        const isSelected = selectedIds.has(id);
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.isSelectionOutline !== undefined) {
            child.visible = isSelected;
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

            // Прикрепление экипированного оружия/предметов в кости рук (через защищенный кэш сокетов)
            const aggSlots = getAggregatedInteractionSlots(world, id);
            for (const info of aggSlots) {
              if (info.slot.itemId && info.slot.rigSocketName) {
                const itemObj = this.meshes.get(info.slot.itemId);
                if (itemObj) {
                  const socketBone =
                    animState.socketBones.get(info.slot.rigSocketName) ||
                    animState.rig.getObjectByName(info.slot.rigSocketName);

                  if (socketBone && itemObj.parent !== socketBone) {
                    socketBone.add(itemObj);
                    const grip = itemObj.userData.gripTransform as GripTransform | undefined;
                    if (grip) {
                      itemObj.position.copy(grip.position);
                      itemObj.quaternion.copy(grip.quaternion);
                    } else {
                      itemObj.position.set(0, 0, 0);
                      itemObj.rotation.set(0, 0, 0);
                    }
                  }
                }
              }
            }
          }
        }
        // 4. Фоллбэк-визуализация примитивов
        else if (!isEquipped) {
          const health = world.getComponent(id, 'health');
          // В блинчик сплющиваются только погибшие существа (трупы), но не предметы!
          if (health && !health.isAlive && archetype === 'creature') {
            obj.scale.set(1, 0.1, 1);
            obj.position.y = 0.05;
          } else if (archetype === 'creature') {
            const STANCE_HEIGHTS: Record<string, number> = {
              standing: 1.8,
              crouching: 1.2,
              prone: 0.4,
            };
            const transition = world.getComponent(id, 'stanceTransition');
            let currentHeight = 1.8;

            if (transition && transition.totalDuration > 0) {
              const progress = Math.min(
                1,
                Math.max(0, 1 - transition.timer / transition.totalDuration)
              );
              const fromH = STANCE_HEIGHTS[transition.fromStance] || 1.8;
              const toH = STANCE_HEIGHTS[transition.toStance] || 1.8;
              currentHeight = fromH + (toH - fromH) * progress;
            } else {
              const currentStance = world.getComponent(id, 'meta')?.stance || 'standing';
              currentHeight = STANCE_HEIGHTS[currentStance] || 1.8;
            }
            obj.scale.set(1, currentHeight / 1.8, 1);
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
        // Инвалидируем все фоновые загрузки для этого ID
        this.loadingGenerations.set(id, (this.loadingGenerations.get(id) ?? 0) + 1);
        ThreeSyncSystem.disposeObject(mesh);
        this.scene.remove(mesh);
        this.meshes.delete(id);
        this.animators.delete(id);
      }
    }

    // Синхронизация 3D зон атак в активных фазах prep и cast
    this.updateAttackVisuals(world);
  }

  private updateAttackVisuals(world: World): void {
    const activeAttackEntities = world.getEntitiesWith('activeAttacks', 'transform', 'health');
    const currentAttackingIds = new Set<EntityId>();

    for (const [id, { activeAttacks, transform, health }] of activeAttackEntities) {
      if (!health.isAlive) continue;

      const currentAttack = activeAttacks.attacks[0];
      if (!currentAttack) continue;
      if (currentAttack.phase !== 'prep' && currentAttack.phase !== 'cast') continue;

      const weaponZone = world.getComponent(currentAttack.weaponId, 'weaponZone');
      if (!weaponZone) continue;

      currentAttackingIds.add(id);
      this.syncAttackVisual(id, currentAttack.phase, weaponZone, transform);
    }

    // Удаляем визуализаторы завершившихся атак
    for (const [id, visual] of this.attackVisuals.entries()) {
      if (!currentAttackingIds.has(id)) {
        this.scene.remove(visual.object);
        this.disposeAttackObject(visual.object);
        this.attackVisuals.delete(id);
      }
    }
  }

  private syncAttackVisual(
    entityId: EntityId,
    phase: 'prep' | 'cast',
    zone: import('../components/combat').HitZoneConfig,
    transform: import('../components/physics').TransformComponent
  ): void {
    const key = `${zone.hitZoneType}_${zone.radius ?? 0}_${zone.length ?? 0}_${zone.angle ?? 0}_${zone.rayCount ?? 0}`;
    let visual = this.attackVisuals.get(entityId);

    if (!visual || visual.key !== key) {
      if (visual) {
        this.scene.remove(visual.object);
        this.disposeAttackObject(visual.object);
      }
      const object = this.createAttackObject(zone, phase);
      visual = { object, key, phase };
      this.attackVisuals.set(entityId, visual);
      this.scene.add(object);
    } else if (visual.phase !== phase) {
      visual.phase = phase;
      this.updateAttackObjectPhase(visual.object, zone.hitZoneType, phase);
    }

    // Привязываем положение чуть выше пола (0.02м) во избежание z-fighting
    visual.object.position.set(transform.x, transform.y + 0.02, transform.z);
    if (transform.rotation) {
      visual.object.quaternion.set(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z,
        transform.rotation.w
      );
    }
  }

  private createAttackObject(
    zone: import('../components/combat').HitZoneConfig,
    phase: 'prep' | 'cast'
  ): THREE.Object3D {
    const isCast = phase === 'cast';

    if (zone.hitZoneType === 'radius') {
      const radius = zone.radius ?? 2.5;
      const geo = new THREE.CircleGeometry(radius, 32);
      geo.rotateX(-Math.PI / 2);
      return new THREE.Mesh(geo, isCast ? this.matAttackCastMesh : this.matAttackPrepMesh);
    }

    if (zone.hitZoneType === 'angle') {
      const radius = zone.length ?? zone.radius ?? 4.5;
      const angle = zone.angle ?? Math.PI / 6;
      const segments = 24;
      const positions: number[] = [];
      const halfAngle = angle / 2;

      for (let i = 0; i < segments; i++) {
        const a1 = -halfAngle + (i / segments) * angle;
        const a2 = -halfAngle + ((i + 1) / segments) * angle;

        positions.push(0, 0, 0);
        positions.push(Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
        positions.push(Math.cos(a2) * radius, 0, Math.sin(a2) * radius);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.computeVertexNormals();

      return new THREE.Mesh(geo, isCast ? this.matAttackCastMesh : this.matAttackPrepMesh);
    }

    if (zone.hitZoneType === 'forward_line') {
      const len = zone.length ?? 6.0;
      const hw = 0.15; // полуширина полосы удара (15 см)
      const positions = [0, 0, -hw, len, 0, -hw, len, 0, hw, 0, 0, -hw, len, 0, hw, 0, 0, hw];

      const meshGeo = new THREE.BufferGeometry();
      meshGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      meshGeo.computeVertexNormals();
      const mesh = new THREE.Mesh(
        meshGeo,
        isCast ? this.matAttackCastMesh : this.matAttackPrepMesh
      );

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(len, 0, 0),
      ]);
      const line = new THREE.Line(
        lineGeo,
        isCast ? this.matAttackCastLine : this.matAttackPrepLine
      );

      const group = new THREE.Group();
      group.add(mesh);
      group.add(line);
      return group;
    }

    if (zone.hitZoneType === 'shrapnel') {
      const length = zone.length ?? 5.0;
      const angle = zone.angle ?? Math.PI / 3;
      const count = Math.max(2, zone.rayCount ?? 5);
      const halfAngle = angle / 2;
      const points: THREE.Vector3[] = [];

      for (let i = 0; i < count; i++) {
        const fraction = count > 1 ? i / (count - 1) : 0.5;
        const rayAngle = -halfAngle + fraction * angle;
        points.push(new THREE.Vector3(0, 0, 0));
        points.push(new THREE.Vector3(Math.cos(rayAngle) * length, 0, Math.sin(rayAngle) * length));
      }

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.LineSegments(geo, isCast ? this.matAttackCastLine : this.matAttackPrepLine);
    }

    return new THREE.Group();
  }

  private updateAttackObjectPhase(
    obj: THREE.Object3D,
    hitZoneType: import('../components/combat').HitZoneType,
    phase: 'prep' | 'cast'
  ): void {
    const isCast = phase === 'cast';

    if (hitZoneType === 'shrapnel') {
      if (obj instanceof THREE.LineSegments) {
        obj.material = isCast ? this.matAttackCastLine : this.matAttackPrepLine;
      }
    } else if (hitZoneType === 'forward_line') {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = isCast ? this.matAttackCastMesh : this.matAttackPrepMesh;
        } else if (child instanceof THREE.Line) {
          child.material = isCast ? this.matAttackCastLine : this.matAttackPrepLine;
        }
      });
    } else {
      if (obj instanceof THREE.Mesh) {
        obj.material = isCast ? this.matAttackCastMesh : this.matAttackPrepMesh;
      }
    }
  }

  private disposeAttackObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (
        child instanceof THREE.Mesh ||
        child instanceof THREE.Line ||
        child instanceof THREE.LineSegments
      ) {
        child.geometry?.dispose();
      }
    });
  }

  private async playAnimation(
    entityId: EntityId,
    animatorComp: import('../components/rendering').AnimatorComponent,
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

    if (ProceduralAssetManager.getInstance().hasBuilder(structureType)) {
      clip = ProceduralAssetManager.getInstance().getAnimationClip(structureType, animKey);
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
      animKey === 'attack' ||
      animKey === 'pickup' ||
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
    const animator = world.getComponent(id, 'animator');
    const rigProfile = animator
      ? CREATURE_RIG_PROFILES[animator.rigType as BodyStructureType]
      : null;

    // Сборка модульного рига для существ (только при наличии валидного 3D-ассета рига)
    if (animator && archetype === 'creature' && rigProfile?.rigAsset) {
      this.loadingMeshes.add(id);
      const group = new THREE.Group();
      group.userData.entityId = id;
      group.userData.isModularRig = true;
      this.assembleModularRigAsync(id, group, world).catch(console.error);
      return group;
    }

    // Сборка оторванной составной части тела (предмет с иерархией assemblyRoot)
    const assembly = world.getComponent(id, 'assemblyRoot');
    if (assembly && (archetype === 'item' || archetype === 'bodyPart')) {
      this.loadingMeshes.add(id);
      const group = new THREE.Group();
      group.userData.entityId = id;
      group.userData.isDetachedLimb = true;
      this.assembleDetachedLimbAsync(id, group, world).catch(console.error);
      return group;
    }

    // Загрузка реального 3D меша для оторванных конечностей и предметов на полу
    const visual = world.getComponent(id, 'visualModel');
    if (visual && visual.modelId && (archetype === 'item' || archetype === 'bodyPart')) {
      const group = new THREE.Group();
      group.userData.entityId = id;
      this.loadingMeshes.add(id);

      const currentGen = (this.loadingGenerations.get(id) ?? 0) + 1;
      this.loadingGenerations.set(id, currentGen);

      AssetManager.getInstance()
        .getClonedModel(visual.modelId)
        .then((mesh) => {
          // Проверяем, не была ли сущность удалена, пересоздана или отменена во время загрузки
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

            // Рассчитываем и кэшируем точку хвата предмета
            const itemComp = world.getComponent(id, 'item');
            group.userData.gripTransform = computeItemGrip(group, itemComp?.type);

            // Добавляем невидимый куб для возможности клика и выделения
            const physStats = world.getComponent(id, 'physicsStats');
            const radius = physStats ? physStats.radius.current : 16;
            const outlineGeo = new THREE.BoxGeometry(radius * 1.5, radius * 1.5, radius * 1.5);
            const outline = new THREE.Mesh(outlineGeo, this.matSelection);
            outline.userData.isSelectionOutline = true;
            outline.userData.isSharedMaterial = true; // Защищаем this.matSelection
            outline.visible = false;
            group.add(outline);
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

      const h = 1.8;
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
      // Метрическая высота стены (1.5 метра)
      const h = 1.5;
      const geo = new THREE.BoxGeometry(w, h, d);
      mainMesh = new THREE.Mesh(geo, this.matObstacle);
      mainMesh.position.y = h / 2;
    } else if (archetype === 'item' || archetype === 'bodyPart') {
      const item = world.getComponent(id, 'item');
      let mat = this.matWeapon;
      if (archetype === 'bodyPart') mat = this.matEnemy;
      else if (item?.type === 'armor') mat = this.matArmor;
      else if (item?.type === 'bag') mat = this.matBag;

      const size = radius * 0.8; // Размер синхронизирован с физическим кубическим коллайдером
      const geo = new THREE.BoxGeometry(size, size, size);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = 0; // Центр меша совпадает с центром тяжести тела Rapier
    } else if (archetype === 'zone') {
      const effector = world.getComponent(id, 'areaEffector');
      let mat = this.matZoneNeutral;
      if (effector?.effect === 'damage') mat = this.matZoneDmg;
      else if (effector?.effect === 'joint_damage') mat = this.matZoneJoint;
      else if (effector?.effect === 'heal') mat = this.matZoneHeal;
      else if (effector?.effect === 'time_dilation') {
        mat = (effector.valuePerSec ?? 1) > 1.0 ? this.matZoneFast : this.matZoneSlow;
      }
      // Создаем базовый цилиндр радиусом 1 метр, который динамически масштабируется в update
      const geo = new THREE.CylinderGeometry(1, 1, 2, 32);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = 1;
      const r = effector?.radius ?? radius;
      group.scale.set(r, 1, r);
    }

    if (mainMesh) {
      group.userData.entityId = id;
      mainMesh.userData.entityId = id;
      mainMesh.userData.isSharedMaterial = true; // Защищаем кэшированный материал
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

  private async assembleModularRigAsync(
    rootId: EntityId,
    parentGroup: THREE.Group,
    world: World
  ): Promise<void> {
    const animator = world.getComponent(rootId, 'animator');
    const assembly = world.getComponent(rootId, 'assemblyRoot');
    if (!animator || !assembly) {
      this.loadingMeshes.delete(rootId);
      return;
    }

    const rigProfile = CREATURE_RIG_PROFILES[animator.rigType as BodyStructureType];
    if (!rigProfile || !rigProfile.rigAsset) {
      this.loadingMeshes.delete(rootId);
      return;
    }

    const currentGen = (this.loadingGenerations.get(rootId) ?? 0) + 1;
    this.loadingGenerations.set(rootId, currentGen);

    const isAborted = () =>
      this.loadingGenerations.get(rootId) !== currentGen || !world.getEntity(rootId);

    try {
      const assetManager = AssetManager.getInstance();

      const rig = await assetManager.getClonedModel(rigProfile.rigAsset);
      if (!rig) throw new Error(`Rig ${rigProfile.rigAsset} failed to load`);

      // Проверка актуальности после загрузки скелета
      if (isAborted()) {
        ThreeSyncSystem.disposeObject(rig);
        ThreeSyncSystem.disposeObject(parentGroup);
        this.scene.remove(parentGroup);
        return;
      }

      // Метрический масштаб рига: 1 единица = 1 метр
      rig.scale.set(1, 1, 1);
      // Компенсация ориентации 3D-моделей (GLTF смотрит в +Z, физика смотрит в +X)
      rig.rotation.y = Math.PI / 2;

      parentGroup.add(rig);

      // Кэшируем оригинальные кости сокетов персонажа ДО прикрепления оружия и конечностей
      const socketBones = new Map<string, THREE.Object3D>();
      rig.traverse((child) => {
        if (child.name.includes('Socket')) {
          socketBones.set(child.name, child);
        }
      });

      const mixer = new THREE.AnimationMixer(rig);
      this.animators.set(rootId, {
        mixer,
        currentClipName: '',
        targetClipName: '',
        currentAction: null,
        rig,
        socketBones,
      });

      // Итерируемся по частям тела и собираем меши
      for (const partId of assembly.partIds) {
        const visual = world.getComponent(partId, 'visualModel');
        if (visual && visual.modelId && visual.rigNodeName) {
          const targetNode = rig.getObjectByName(visual.rigNodeName);
          if (targetNode) {
            const meshClone = await assetManager.getClonedModel(visual.modelId);

            // Проверка актуальности после загрузки каждой части тела
            if (isAborted()) {
              if (meshClone) ThreeSyncSystem.disposeObject(meshClone);
              ThreeSyncSystem.disposeObject(parentGroup);
              this.scene.remove(parentGroup);
              return;
            }

            if (meshClone) {
              meshClone.userData.partId = partId;
              meshClone.userData.entityId = partId;

              meshClone.traverse((c) => {
                c.userData.partId = partId;
                c.userData.entityId = partId;
              });

              if (meshClone.type === 'Scene' || meshClone.type === 'Group') {
                targetNode.add(...meshClone.children);
              } else {
                targetNode.add(meshClone);
              }
            }
          } else {
            console.warn(`[ThreeSync] Socket node ${visual.rigNodeName} not found in rig!`);
          }
        }
      }

      ThreeSyncSystem.attachOutlines(parentGroup, this.matSilhouetteOutline);

      const box = new THREE.Box3().setFromObject(rig);
      const visualCorrectionY = -box.min.y; // Автоматически поднимет или опустит меш так, чтобы нижняя точка всегда касалась Y = 0
      rig.position.set(0, visualCorrectionY, 0);
      // Запускаем дефолтную анимацию
      this.playAnimation(rootId, animator, 'stand_idle').catch(console.error);
    } catch (err) {
      console.error(`[ThreeSyncSystem] Error assembling rig for ${rootId}:`, err);
    } finally {
      if (this.loadingGenerations.get(rootId) === currentGen) {
        this.loadingMeshes.delete(rootId);
      }
    }
  }

  private async assembleDetachedLimbAsync(
    rootId: EntityId,
    parentGroup: THREE.Group,
    world: World
  ): Promise<void> {
    const assembly = world.getComponent(rootId, 'assemblyRoot');
    const visual = world.getComponent(rootId, 'visualModel');
    if (!assembly || !assembly.partIds || assembly.partIds.length === 0) {
      this.loadingMeshes.delete(rootId);
      return;
    }

    const currentGen = (this.loadingGenerations.get(rootId) ?? 0) + 1;
    this.loadingGenerations.set(rootId, currentGen);

    const isAborted = () =>
      this.loadingGenerations.get(rootId) !== currentGen || !world.getEntity(rootId);

    try {
      const assetManager = AssetManager.getInstance();
      const rigStructure = (visual?.rigType as BodyStructureType) || 'humanoid';
      const rigProfile = CREATURE_RIG_PROFILES[rigStructure] || CREATURE_RIG_PROFILES.humanoid;
      const rigAsset = rigProfile?.rigAsset;

      if (!rigAsset) {
        throw new Error(`Rig asset not found for structure: ${rigStructure}`);
      }

      // Клонируем риг (в исходной T-позе без анимаций)
      const rig = await assetManager.getClonedModel(rigAsset);
      if (!rig) throw new Error(`Rig ${rigAsset} failed to load for detached limb`);

      if (isAborted()) {
        ThreeSyncSystem.disposeObject(rig);
        ThreeSyncSystem.disposeObject(parentGroup);
        this.scene.remove(parentGroup);
        return;
      }

      // Масштаб 1:1, компенсация ориентации рига (GLTF смотрит в +Z, физика в +X)
      rig.scale.set(1, 1, 1);
      rig.rotation.y = Math.PI / 2;

      // Скрываем все встроенные базовые меши рига
      rig.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.visible = false;
        }
      });

      // Прикрепляем меши только для тех частей тела, которые входят в отделившийся фрагмент
      for (const partId of assembly.partIds) {
        const partVisual = world.getComponent(partId, 'visualModel');
        if (partVisual && partVisual.modelId && partVisual.rigNodeName) {
          const targetNode = rig.getObjectByName(partVisual.rigNodeName);
          if (targetNode) {
            const meshClone = await assetManager.getClonedModel(partVisual.modelId);

            if (isAborted()) {
              if (meshClone) ThreeSyncSystem.disposeObject(meshClone);
              ThreeSyncSystem.disposeObject(rig);
              ThreeSyncSystem.disposeObject(parentGroup);
              this.scene.remove(parentGroup);
              return;
            }

            if (meshClone) {
              // Для отсоединенного предмета привязываем клик строго к rootId (предмету), а не к скрытой части
              meshClone.userData.entityId = rootId;
              delete meshClone.userData.partId;

              meshClone.traverse((c) => {
                c.userData.entityId = rootId;
                delete c.userData.partId;
              });

              // Безопасный перенос дочерних объектов с сохранением ссылок
              const childrenToAttach = [...meshClone.children];
              if (childrenToAttach.length > 0) {
                for (const child of childrenToAttach) {
                  targetNode.add(child);
                }
              } else {
                targetNode.add(meshClone);
              }
            }
          } else {
            console.warn(
              `[ThreeSync] Rig node ${partVisual.rigNodeName} not found in detached limb rig!`
            );
          }
        }
      }

      // Обновляем мировую матрицу скелета для точного расчета видимой геометрии
      rig.updateMatrixWorld(true);

      // setFromObject автоматически учитывает только видимые меши (скрытые кости рига игнорируются)
      const limbBox = new THREE.Box3().setFromObject(rig);

      const boxCenter = new THREE.Vector3();
      const boxSize = new THREE.Vector3(0.4, 0.4, 0.4);

      if (!limbBox.isEmpty()) {
        limbBox.getCenter(boxCenter);
        limbBox.getSize(boxSize);
        // Смещаем скелет так, чтобы геометрический центр видимой части совпал с (0, 0, 0) коллайдера
        rig.position.sub(boxCenter);
      }

      parentGroup.add(rig);

      // Получаем анатомический подтип части тела (torso, arm, leg, head)
      const anchorPartId = assembly.rootPartId;
      const anchorTag = world.getComponent(anchorPartId, 'tag');
      const subType = anchorTag?.subType;

      // Автоматический расчет точки хвата строго по локальным координатам меша
      parentGroup.userData.gripTransform = computeDetachedLimbGrip(parentGroup, subType);

      ThreeSyncSystem.attachOutlines(parentGroup, this.matSilhouetteOutline);
    } catch (err) {
      console.error(`[ThreeSyncSystem] Ошибка сборки отсоединенной конечности ${rootId}:`, err);
    } finally {
      if (this.loadingGenerations.get(rootId) === currentGen) {
        this.loadingMeshes.delete(rootId);
      }
    }
  }
}
