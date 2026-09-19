import * as THREE from 'three';
import { World } from '../World';
import { EntityId } from '../types';
import { GameMode } from '../../config/gameConfig';
import { AssetManager } from '../../rendering/AssetManager';
import { CREATURE_RIG_PROFILES } from '../../rendering/rigProfiles';
import { BodyStructureType } from '../templates';
import { getAggregatedInteractionSlots } from '../utils/hierarchy';
import { EventBus } from '../../core/EventBus';

interface AnimatorState {
  mixer: THREE.AnimationMixer;
  currentClipName: string;
  targetClipName: string;
  currentAction: THREE.AnimationAction | null;
  rig: THREE.Object3D;
}

export class ThreeSyncSystem {
  private scene: THREE.Scene;
  private meshes: Map<EntityId, THREE.Object3D> = new Map();
  private loadingMeshes: Set<EntityId> = new Set();
  private unsubWorldUpdated: () => void;

  // Кэш для аниматоров (Стейт-машина)
  private animators: Map<EntityId, AnimatorState> = new Map();

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

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.unsubWorldUpdated = EventBus.on('world:updated', () => {
      this.clearMeshes();
    });
  }

  public static disposeObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    });
  }

  public clearMeshes(): void {
    for (const [, mesh] of this.meshes.entries()) {
      ThreeSyncSystem.disposeObject(mesh);
      this.scene.remove(mesh);
    }
    this.meshes.clear();
    this.animators.clear();
    this.loadingMeshes.clear();
  }

  public destroy(): void {
    this.unsubWorldUpdated();
    this.clearMeshes();
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
      if (!renderable.isVisible) continue;

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
          obj.position.x = transform.x;
          obj.position.z = transform.y;
          obj.rotation.y = -transform.angle + Math.PI / 2;
          obj.scale.set(1, 1, 1);
        } else {
          // Сброс локальных трансформаций внутри сустава
          obj.position.set(0, 0, 0);
          obj.rotation.set(0, 0, 0);
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
              this.playAnimation(id, animatorComp.rigType, animatorComp.currentAnimation).catch(
                (e) => console.warn(e)
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

            // Прикрепление экипированного оружия/предметов в кости рук
            const aggSlots = getAggregatedInteractionSlots(world, id);
            for (const info of aggSlots) {
              if (info.slot.itemId && info.slot.rigSocketName) {
                const itemObj = this.meshes.get(info.slot.itemId);
                if (itemObj) {
                  const socketBone = animState.rig.getObjectByName(info.slot.rigSocketName);
                  if (socketBone && itemObj.parent !== socketBone) {
                    socketBone.add(itemObj);
                    itemObj.position.set(0, 0, 0);
                    itemObj.rotation.set(0, 0, 0);
                  }
                }
              }
            }
          }
        }
        // 4. Фоллбэк-визуализация примитивов
        else if (!isEquipped) {
          const health = world.getComponent(id, 'health');
          if (health && !health.isAlive) {
            obj.scale.set(1, 0.1, 1);
            obj.position.y = 2;
          } else if (archetype === 'creature') {
            const STANCE_HEIGHTS: Record<string, number> = {
              standing: 40,
              crouching: 28,
              prone: 14,
            };
            const transition = world.getComponent(id, 'stanceTransition');
            let currentHeight = 40;

            if (transition && transition.totalDuration > 0) {
              const progress = Math.min(
                1,
                Math.max(0, 1 - transition.timer / transition.totalDuration)
              );
              const fromH = STANCE_HEIGHTS[transition.fromStance] || 40;
              const toH = STANCE_HEIGHTS[transition.toStance] || 40;
              currentHeight = fromH + (toH - fromH) * progress;
            } else {
              const currentStance = world.getComponent(id, 'meta')?.stance || 'standing';
              currentHeight = STANCE_HEIGHTS[currentStance] || 40;
            }
            obj.scale.set(1, currentHeight / 40, 1);
            obj.position.y = 0;
          }

          if (archetype === 'zone') {
            const effector = world.getComponent(id, 'areaEffector');
            if (effector) {
              let mat = this.matZoneNeutral;
              if (effector.effect === 'damage') mat = this.matZoneDmg;
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
        ThreeSyncSystem.disposeObject(mesh);
        this.scene.remove(mesh);
        this.meshes.delete(id);
        this.animators.delete(id);
      }
    }
  }

  private async playAnimation(entityId: EntityId, rigType: string, animKey: string) {
    const state = this.animators.get(entityId);
    if (!state) return;

    const rigProfile = CREATURE_RIG_PROFILES[rigType as BodyStructureType];
    if (!rigProfile) return;

    // Фоллбэк на idle при отсутствии специфичной анимации
    const animUrl = rigProfile.animations[animKey] || rigProfile.animations['stand_idle'];
    if (!animUrl) return;

    try {
      const gltfAnim = await AssetManager.getInstance().loadGLTF(animUrl);

      // Предотвращение гонки: если за время сети анимация сменилась, отменяем
      if (state.targetClipName !== animKey) return;

      if (gltfAnim.animations && gltfAnim.animations.length > 0) {
        const clip = gltfAnim.animations[0];
        const action = state.mixer.clipAction(clip);

        if (state.currentAction && state.currentAction !== action) {
          action.reset();

          // Для анимаций смерти и атаки ставим LoopOnce
          if (animKey === 'dead' || animKey === 'attack' || animKey === 'pickup') {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          } else {
            action.setLoop(THREE.LoopRepeat, Infinity);
          }

          action.play();
          action.crossFadeFrom(state.currentAction, 0.2, true);
        } else if (!state.currentAction) {
          action.play();
        }

        state.currentAction = action;
        state.currentClipName = animKey;
      }
    } catch (e) {
      console.warn(`[ThreeSyncSystem] Animation failed to load: ${animUrl}`);
    }
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

    // Загрузка реального 3D меша для оторванных конечностей и предметов на полу
    const visual = world.getComponent(id, 'visualModel');
    if (visual && visual.modelId && (archetype === 'item' || archetype === 'bodyPart')) {
      const group = new THREE.Group();
      group.userData.entityId = id;
      this.loadingMeshes.add(id);

      AssetManager.getInstance()
        .getClonedModel(visual.modelId)
        .then((mesh) => {
          if (mesh) {
            if (mesh.type === 'Scene' || mesh.type === 'Group') {
              group.add(...mesh.children);
            } else {
              group.add(mesh);
            }

            // Добавляем невидимый куб для возможности клика и выделения
            const physStats = world.getComponent(id, 'physicsStats');
            const radius = physStats ? physStats.radius.current : 16;
            const outlineGeo = new THREE.BoxGeometry(radius * 1.5, radius * 1.5, radius * 1.5);
            const outline = new THREE.Mesh(outlineGeo, this.matSelection);
            outline.userData.isSelectionOutline = true;
            outline.visible = false;
            group.add(outline);
          }
          this.loadingMeshes.delete(id);
        })
        .catch(console.error);

      return group;
    }

    // --- ФОЛЛБЭК ДЛЯ ПРИМИТИВОВ (Зоны, Препятствия) ---
    const physStats = world.getComponent(id, 'physicsStats');
    const radius = physStats ? physStats.radius.current : 16;
    const group = new THREE.Group();
    let mainMesh: THREE.Mesh | null = null;

    if (archetype === 'creature') {
      const aiStats = world.getComponent(id, 'aiStats');
      const behavior = aiStats?.behavior?.current;
      let mat = this.matIdle;
      if (behavior === 'PlayerTree') mat = this.matPlayer;
      else if (behavior === 'AttackerTree') mat = this.matEnemy;

      const h = 40;
      const geo = new THREE.CylinderGeometry(radius, radius, h, 16);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = h / 2;

      const noseGeo = new THREE.BoxGeometry(radius, radius * 0.4, radius * 0.4);
      const nose = new THREE.Mesh(noseGeo, mat);
      nose.position.set(radius, h * 0.75, 0);
      group.add(nose);
    } else if (archetype === 'obstacle') {
      let w = 100,
        d = 40;
      if (physStats?.points) {
        let minX = 0,
          maxX = 0,
          minY = 0,
          maxY = 0;
        physStats.points.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
        w = maxX - minX;
        d = maxY - minY;
      }
      const h = 60;
      const geo = new THREE.BoxGeometry(w, h, d);
      mainMesh = new THREE.Mesh(geo, this.matObstacle);
      mainMesh.position.y = h / 2;
    } else if (archetype === 'item' || archetype === 'bodyPart') {
      const item = world.getComponent(id, 'item');
      let mat = this.matWeapon;
      if (archetype === 'bodyPart') mat = this.matEnemy;
      else if (item?.type === 'armor') mat = this.matArmor;
      else if (item?.type === 'bag') mat = this.matBag;

      const size = radius * 1.5;
      const geo = new THREE.BoxGeometry(size, size, size);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = size / 2;
    } else if (archetype === 'zone') {
      const effector = world.getComponent(id, 'areaEffector');
      let mat = this.matZoneNeutral;
      if (effector?.effect === 'damage') mat = this.matZoneDmg;
      else if (effector?.effect === 'heal') mat = this.matZoneHeal;
      else if (effector?.effect === 'time_dilation') {
        mat = (effector.valuePerSec ?? 1) > 1.0 ? this.matZoneFast : this.matZoneSlow;
      }
      const geo = new THREE.CylinderGeometry(radius, radius, 2, 32);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = 1;
    }

    if (mainMesh) {
      group.userData.entityId = id;
      mainMesh.userData.entityId = id;
      group.add(mainMesh);

      const outlineGeo = mainMesh.geometry.clone();
      const outline = new THREE.Mesh(outlineGeo, this.matSelection);
      outline.scale.set(1.05, 1.05, 1.05);
      outline.position.copy(mainMesh.position);
      outline.userData.isSelectionOutline = true;
      outline.visible = false;
      group.add(outline);

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

    try {
      const assetManager = AssetManager.getInstance();

      const rig = await assetManager.getClonedModel(rigProfile.rigAsset);
      if (!rig) throw new Error(`Rig ${rigProfile.rigAsset} failed to load`);
      if (!world.getEntity(rootId)) {
        ThreeSyncSystem.disposeObject(rig);
        return;
      }

      parentGroup.add(rig);

      const mixer = new THREE.AnimationMixer(rig);
      this.animators.set(rootId, {
        mixer,
        currentClipName: '',
        targetClipName: '',
        currentAction: null,
        rig,
      });

      // Итерируемся по частям тела и собираем меши
      for (const partId of assembly.partIds) {
        const visual = world.getComponent(partId, 'visualModel');
        if (visual && visual.modelId && visual.rigNodeName) {
          const targetNode = rig.getObjectByName(visual.rigNodeName);
          if (targetNode) {
            const meshClone = await assetManager.getClonedModel(visual.modelId);
            if (!world.getEntity(rootId)) {
              if (meshClone) ThreeSyncSystem.disposeObject(meshClone);
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

      // Создаем фантомный цилиндр для выделения рамкой (Outline)
      const physStats = world.getComponent(rootId, 'physicsStats');
      const r = physStats ? physStats.radius.current : 16;
      const outlineGeo = new THREE.CylinderGeometry(r * 1.1, r * 1.1, 45, 16);
      const outline = new THREE.Mesh(outlineGeo, this.matSelection);
      outline.position.y = 22.5;
      outline.userData.isSelectionOutline = true;
      outline.visible = false;
      parentGroup.add(outline);

      // Запускаем дефолтную анимацию
      this.playAnimation(rootId, animator.rigType, 'stand_idle').catch(console.error);
    } catch (err) {
      console.error(`[ThreeSyncSystem] Error assembling rig for ${rootId}:`, err);
    } finally {
      this.loadingMeshes.delete(rootId);
    }
  }
}
