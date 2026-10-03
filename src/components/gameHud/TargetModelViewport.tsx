import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { AssetManager } from '../../rendering/AssetManager';
import { CREATURE_RIG_PROFILES } from '../../rendering/rigProfiles';
import { BodyStructureType } from '../../ecs/templates';
import { ProceduralCreatureAssetManager } from '../../rendering/creatures/ProceduralAssetManager';
import {
  computeLocalBox,
  computeItemGrip,
  computeDetachedLimbGrip,
  GripTransform,
} from '../../rendering/gripCalculators';
import {
  disposeObject,
  attachOutlines,
  createOutlineShaderMaterial,
} from '../../rendering/renderUtils';
import { getAggregatedInteractionSlots } from '../../ecs/utils/hierarchy';
import { ToonMaterialManager } from '../../rendering/materials/ToonMaterialManager';

export interface TargetModelViewportProps {
  app?: GameApp | null;
  world: World | null | undefined;
  targetId: string;
  playerId: string | null;
}

export const TargetModelViewport: React.FC<TargetModelViewportProps> = ({
  app,
  world,
  targetId,
  playerId,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [zoomFactor, setZoomFactor] = useState<number>(1.0);

  // Ссылки на инстансы Three.js
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentClipNameRef = useRef<string>('');
  const targetCenterRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.5, 0));
  const rafIdRef = useRef<number>(0);
  const socketItemsHashRef = useRef<string>('');

  // Сброс зума при переключении на новую цель
  useEffect(() => {
    setZoomFactor(1.0);
  }, [targetId]);

  // Приближение/отдаление колесиком мыши (от 0.5x до 1.0x текущей дистанции)
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setZoomFactor((prev) => Math.max(0.5, Math.min(1.0, prev + e.deltaY * 0.001)));
  };

  // 1. Инициализация сцены, мягкого освещения и рендерера
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const w = container.clientWidth || 200;
    const h = container.clientHeight || 140;

    const scene = new THREE.Scene();
    // Темно-серый фон окна
    scene.background = new THREE.Color('#2d2d2d');
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    rendererRef.current = renderer;

    container.appendChild(renderer.domElement);

    // Рассеянное освещение полусферы (устраняет пластиковый глянец и жесткие блики)
    const hemiLight = new THREE.HemisphereLight(0xddeeff, 0x444444, 0.95);
    scene.add(hemiLight);

    // Мягкий рассеянный свет спереди
    const dirLight = new THREE.DirectionalLight(0xfff8ee, 0.65);
    dirLight.position.set(3, 6, 5);
    scene.add(dirLight);

    // Контурная подсветка сзади для объема
    const backLight = new THREE.DirectionalLight(0x708090, 0.35);
    backLight.position.set(-3, 2, -4);
    scene.add(backLight);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    return () => {
      cancelAnimationFrame(rafIdRef.current);
      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      disposeObject(modelGroup);
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Вспомогательная функция синхронизации предметов в сокетах рук
  const syncSocketItems = async (rig: THREE.Object3D, currentTargetId: string) => {
    if (!world) return;
    const aggSlots = getAggregatedInteractionSlots(world, currentTargetId);
    const newHash = aggSlots.map((s) => `${s.slot.rigSocketName}:${s.slot.itemId}`).join('|');
    if (newHash === socketItemsHashRef.current) return;
    socketItemsHashRef.current = newHash;

    for (const info of aggSlots) {
      if (!info.slot.rigSocketName) continue;
      const socketBone = rig.getObjectByName(info.slot.rigSocketName);
      if (!socketBone) continue;

      // Очищаем старые прикрепленные меши из кости
      while (socketBone.children.length > 0) {
        const child = socketBone.children[0];
        socketBone.remove(child);
        disposeObject(child);
      }

      if (info.slot.itemId) {
        const itemVisual = world.getComponent(info.slot.itemId, 'visualModel');
        const itemComp = world.getComponent(info.slot.itemId, 'item');
        if (itemVisual?.modelId) {
          const itemMesh = await AssetManager.getInstance().getClonedModel(itemVisual.modelId);
          if (itemMesh) {
            const grip = computeItemGrip(itemMesh, itemComp?.type);
            itemMesh.position.copy(grip.position);
            itemMesh.quaternion.copy(grip.quaternion);

            if (app?.celShading) {
              ToonMaterialManager.getInstance().applyToon(itemMesh);
            }
            socketBone.add(itemMesh);
          }
        }
      }
    }
  };

  // 2. Первичная загрузка геометрии и структуры модели
  useEffect(() => {
    if (!world || !sceneRef.current || !modelGroupRef.current) return;
    const modelGroup = modelGroupRef.current;

    if (mixerRef.current) {
      mixerRef.current.stopAllAction();
      mixerRef.current = null;
    }
    currentActionRef.current = null;
    currentClipNameRef.current = '';
    socketItemsHashRef.current = '';

    disposeObject(modelGroup);
    modelGroup.clear();

    let isCancelled = false;

    const loadTargetModel = async () => {
      const animator = world.getComponent(targetId, 'animator');
      const visual = world.getComponent(targetId, 'visualModel');
      const tag = world.getComponent(targetId, 'tag');
      const assembly = world.getComponent(targetId, 'assemblyRoot');

      let loadedObject: THREE.Object3D | null = null;
      const structureType = (animator?.rigType || visual?.rigType) as BodyStructureType | undefined;
      const rigProfile = structureType ? CREATURE_RIG_PROFILES[structureType] : undefined;

      // А. Существо с анимационным ригом
      if (structureType && rigProfile?.rigAsset) {
        const rig = await AssetManager.getInstance().getClonedModel(rigProfile.rigAsset);
        if (isCancelled || !rig) return;

        rig.scale.set(1, 1, 1);
        rig.rotation.y = Math.PI / 2;

        if (assembly && assembly.partIds) {
          for (const partId of assembly.partIds) {
            const partVisual = world.getComponent(partId, 'visualModel');
            if (partVisual?.modelId && partVisual.rigNodeName) {
              const targetNode = rig.getObjectByName(partVisual.rigNodeName);
              if (targetNode) {
                const meshClone = await AssetManager.getInstance().getClonedModel(
                  partVisual.modelId
                );
                if (!isCancelled && meshClone) {
                  if (meshClone.type === 'Scene' || meshClone.type === 'Group') {
                    targetNode.add(...meshClone.children);
                  } else {
                    targetNode.add(meshClone);
                  }
                }
              }
            }
          }
        }

        const mixer = new THREE.AnimationMixer(rig);
        mixerRef.current = mixer;

        // Синхронизируем предметы в руках
        await syncSocketItems(rig, targetId);

        loadedObject = rig;
      }
      // Б. Предмет или проп (мяч, меч, бочка, ящик)
      else if (visual?.modelId) {
        const clone = await AssetManager.getInstance().getClonedModel(visual.modelId);
        if (!isCancelled && clone) {
          loadedObject = clone;
        }
      }
      // В. Фоллбэк
      else {
        const physStats = world.getComponent(targetId, 'physicsStats');
        const r = physStats?.radius.current ?? 0.4;
        const h = physStats?.height?.current ?? 1.5;
        const geo =
          tag?.archetype === 'creature'
            ? new THREE.CylinderGeometry(r, r, h, 16)
            : new THREE.BoxGeometry(r * 2, h, r * 2);
        const mat = new THREE.MeshStandardMaterial({ color: 0x3498db, roughness: 0.6 });
        loadedObject = new THREE.Mesh(geo, mat);
        loadedObject.position.y = h / 2;
      }

      if (!isCancelled && loadedObject) {
        modelGroup.add(loadedObject);

        // Применяем стиль шейдинга из игры для единообразия картинки
        if (app?.celShading) {
          ToonMaterialManager.getInstance().applyToon(modelGroup);
          attachOutlines(modelGroup, createOutlineShaderMaterial(0x151515, 1.8));
        }

        const box = computeLocalBox(modelGroup);
        const center = new THREE.Vector3();
        box.getCenter(center);
        targetCenterRef.current.copy(center);
      }
    };

    loadTargetModel().catch(console.error);

    return () => {
      isCancelled = true;
    };
  }, [targetId, world, app?.celShading]);

  // 3. Покадровое копирование движений, положения головы, вращения и ракурса
  useEffect(() => {
    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      if (
        world &&
        sceneRef.current &&
        cameraRef.current &&
        rendererRef.current &&
        modelGroupRef.current
      ) {
        const playerTrans = playerId ? world.getComponent(playerId, 'transform') : undefined;
        const targetTrans = world.getComponent(targetId, 'transform');
        const animatorComp = world.getComponent(targetId, 'animator');
        const rig = modelGroupRef.current.children[0];

        // А. Синхронизация скелетной анимации и положения головы для существ
        if (rig && mixerRef.current && animatorComp) {
          const targetAnim = animatorComp.currentAnimation || 'stand_idle';
          const structureType = animatorComp.rigType as BodyStructureType;

          if (currentClipNameRef.current !== targetAnim) {
            currentClipNameRef.current = targetAnim;
            const pcam = ProceduralCreatureAssetManager.getInstance();
            const clip = pcam.getAnimationClip(structureType, targetAnim);
            if (clip) {
              mixerRef.current.stopAllAction();
              const action = mixerRef.current.clipAction(clip);
              action.play();
              currentActionRef.current = action;
            }
          }

          // Синхронизация времени кадра с живой анимацией оригинала
          const liveAnimator = (app?.simulation?.threeSyncSystem as any)?.animators?.get(targetId);
          if (liveAnimator?.currentAction && currentActionRef.current) {
            currentActionRef.current.time = liveAnimator.currentAction.time;
            currentActionRef.current.setEffectiveTimeScale(
              liveAnimator.currentAction.getEffectiveTimeScale()
            );
          }

          // Сброс предыдущего процедурного поворота шеи перед обновлением миксера
          const headBone = rig.getObjectByName('HeadPivot');
          if (headBone && headBone.userData.lastProceduralQuat) {
            const invQuat = headBone.userData.lastProceduralQuat.clone().invert();
            headBone.quaternion.multiply(invQuat);
          }

          mixerRef.current.update(dt);

          // Наложение точного поворота головы (Pitch/Yaw) из headOrientation
          const headOrientation = world.getComponent(targetId, 'headOrientation');
          if (headBone && headOrientation) {
            const headPitch = headOrientation.relativePitch ?? 0;
            const headYaw = headOrientation.relativeYaw ?? 0;
            if (Number.isFinite(headPitch) && Number.isFinite(headYaw)) {
              const headQuat = new THREE.Quaternion().setFromEuler(
                new THREE.Euler(-headPitch, -headYaw, 0, 'YXZ')
              );
              headBone.quaternion.multiply(headQuat);
              headBone.userData.lastProceduralQuat = headQuat;
            } else {
              headBone.userData.lastProceduralQuat = null;
            }
          }

          // Синхронизация предметов в руках при смене экипировки на лету
          syncSocketItems(rig, targetId);
        }

        // Б. Учет полного 3D-вращения объекта (катящийся мяч, падающие предметы)
        if (targetTrans) {
          if (animatorComp) {
            // У существ тело ориентируется по текущему курсу рыскания (Yaw)
            modelGroupRef.current.rotation.set(0, -targetTrans.angle, 0);
          } else if (targetTrans.rotation) {
            // У динамических предметов (мяч, меч) применяется полный 3D-кватернион вращения
            modelGroupRef.current.quaternion.set(
              targetTrans.rotation.x,
              targetTrans.rotation.y,
              targetTrans.rotation.z,
              targetTrans.rotation.w
            );
          } else {
            modelGroupRef.current.rotation.set(0, -targetTrans.angle, 0);
          }
        }

        // В. Расчет ракурса и зума камеры относительно игрока
        if (playerTrans && targetTrans) {
          const dx = playerTrans.x - targetTrans.x;
          const dy = playerTrans.y + 1.6 - (targetTrans.y + targetCenterRef.current.y);
          const dz = playerTrans.z - targetTrans.z;
          const realDist = Math.max(0.6, Math.hypot(dx, dy, dz));

          const effDist = realDist * zoomFactor;

          const dirX = dx / realDist;
          const dirY = dy / realDist;
          const dirZ = dz / realDist;

          const center = targetCenterRef.current;
          cameraRef.current.position.set(
            center.x + dirX * effDist,
            center.y + dirY * effDist,
            center.z + dirZ * effDist
          );
          cameraRef.current.lookAt(center);
        }

        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafIdRef.current);
  }, [world, targetId, playerId, zoomFactor, app?.celShading]);

  return (
    <div
      ref={containerRef}
      onWheel={handleWheel}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'ns-resize',
      }}
      title="Колесико мыши: приблизить/отдалить камеру на половину дистанции"
    />
  );
};
