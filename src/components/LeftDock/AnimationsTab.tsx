import React, { useState, useMemo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { World } from '../../ecs/World';
import { getRootOwner } from '../../ecs/utils/hierarchy';
import { BodyStructureType } from '../../ecs/templates';
import { CREATURE_RIG_PROFILES } from '../../rendering/rigProfiles';
import { ProceduralAssetManager } from '../../rendering/procedural/ProceduralAssetManager';
import { AssetManager } from '../../rendering/AssetManager';
import { ThreeSyncSystem } from '../../ecs/systems/ThreeSyncSystem';
import { computeLocalBox } from '../../rendering/gripCalculators';
import { useResizable } from '../../hooks/useResizable';
import { t } from '../../locales';

interface AnimationsTabProps {
  world: World | null | undefined;
  selectedEntityId: string | null;
}

export const AnimationsTab: React.FC<AnimationsTabProps> = ({ world, selectedEntityId }) => {
  const [search, setSearch] = useState('');
  const [speed, setSpeed] = useState<number>(1.0);
  const [activeAnim, setActiveAnim] = useState<string>('stand_idle');

  // Разделитель высоты между списком анимаций и 3D-окном предпросмотра
  const {
    size: previewHeight,
    isResizing: isResizingPreview,
    startResizing: startResizingPreview,
  } = useResizable({
    storageKey: 'animationPreviewViewportHeight',
    initialSize: typeof window !== 'undefined' ? Math.round(window.innerHeight * 0.6) : 400,
    minSize: 130,
    maxSize: () => Math.max(130, window.innerHeight - 180),
    direction: 'resize-top',
  });

  // Находим целевое существо (со скелетом и аниматором)
  const creatureRootId = useMemo(() => {
    if (!world || !selectedEntityId) return null;
    const root = getRootOwner(world, selectedEntityId) ?? selectedEntityId;
    const anim = world.getComponent(root, 'animator');
    if (anim) return root;
    return world.getComponent(selectedEntityId, 'animator') ? selectedEntityId : null;
  }, [world, selectedEntityId]);

  const animator = creatureRootId && world ? world.getComponent(creatureRootId, 'animator') : null;

  // Извлекаем все доступные анимации для рига существа
  const animationsList = useMemo(() => {
    if (!animator) return [];

    const structureType = animator.rigType as BodyStructureType;
    const animSet = new Set<string>();

    if (ProceduralAssetManager.getInstance().hasBuilder(structureType)) {
      const builder = (ProceduralAssetManager.getInstance() as any).builders?.get(structureType);
      if (builder) {
        const clips: Map<string, any> = builder.createAnimationClips();
        for (const k of clips.keys()) {
          animSet.add(k);
        }
      }
    }

    const profile = CREATURE_RIG_PROFILES[structureType];
    if (profile?.animations) {
      for (const k of Object.keys(profile.animations)) {
        animSet.add(k);
      }
    }

    return Array.from(animSet).sort();
  }, [animator]);

  const filteredAnimations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return animationsList;
    return animationsList.filter((name) => name.toLowerCase().includes(q));
  }, [animationsList, search]);

  // --- Изолированный 3D-вьюпорт предпросмотра модели ---
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const targetOrbitRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.8, 0));
  const orbitParamsRef = useRef({
    yaw: 0.3,
    pitch: 0.15,
    distance: 2.8,
    isDragging: false,
    lastX: 0,
    lastY: 0,
  });

  // Сборка и загрузка модели в изолированную сцену
  useEffect(() => {
    const container = canvasContainerRef.current;
    if (!container || !creatureRootId || !world || !animator) return;

    let isDisposed = false;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#141414');

    const width = container.clientWidth || 300;
    const height = container.clientHeight || 240;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Освещение
    const ambient = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(3, 8, 5);
    scene.add(dir);
    const fillLight = new THREE.DirectionalLight(0x90b0ff, 0.4);
    fillLight.position.set(-4, 3, -3);
    scene.add(fillLight);

    // Круглая метрическая подставка под ногами
    const platformGeo = new THREE.CylinderGeometry(0.8, 0.85, 0.04, 32);
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x242424, roughness: 0.7 });
    const platform = new THREE.Mesh(platformGeo, platformMat);
    platform.position.y = -0.02;
    scene.add(platform);

    const modelGroup = new THREE.Group();
    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    const structureType = animator.rigType as BodyStructureType;
    const rigProfile = CREATURE_RIG_PROFILES[structureType];

    // Асинхронная загрузка рига и прикрепление частей тела
    const assemblePreviewModel = async () => {
      if (!rigProfile?.rigAsset) return;

      try {
        const rig = await AssetManager.getInstance().getClonedModel(rigProfile.rigAsset);
        if (isDisposed || !rig) return;

        rig.scale.set(1, 1, 1);
        rig.rotation.y = Math.PI / 2;
        modelGroup.add(rig);

        const assembly = world.getComponent(creatureRootId, 'assemblyRoot');
        if (assembly?.partIds) {
          for (const partId of assembly.partIds) {
            const visual = world.getComponent(partId, 'visualModel');
            if (visual?.modelId && visual?.rigNodeName) {
              const targetNode = rig.getObjectByName(visual.rigNodeName);
              if (targetNode) {
                const meshClone = await AssetManager.getInstance().getClonedModel(visual.modelId);
                if (isDisposed) return;
                if (meshClone) {
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

        // Выравнивание основания модели на платформу Y = 0
        const box = computeLocalBox(rig);
        const visualCorrectionY = -box.min.y;
        rig.position.set(0, visualCorrectionY, 0);

        const updatedBox = new THREE.Box3().setFromObject(rig);
        const center = new THREE.Vector3();
        updatedBox.getCenter(center);
        targetOrbitRef.current.copy(center);

        const size = new THREE.Vector3();
        updatedBox.getSize(size);
        orbitParamsRef.current.distance = Math.max(1.8, Math.max(size.x, size.y, size.z) * 1.9);

        // Инициализация аниматора превью
        const mixer = new THREE.AnimationMixer(rig);
        mixerRef.current = mixer;

        // Запуск выбранной анимации
        playClip(activeAnim || 'stand_idle', mixer, structureType);
      } catch (err) {
        console.error('[AnimationsTab Preview] Error loading preview model:', err);
      }
    };

    assemblePreviewModel();

    // ResizeObserver для точной подгонки Canvas при перетаскивании сплиттера
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const w = entry.contentRect.width;
        const h = entry.contentRect.height;
        if (w > 0 && h > 0) {
          camera.aspect = w / h;
          camera.updateProjectionMatrix();
          renderer.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    // Управление вращением камеры мышью в превью
    const handlePointerDown = (e: MouseEvent) => {
      orbitParamsRef.current.isDragging = true;
      orbitParamsRef.current.lastX = e.clientX;
      orbitParamsRef.current.lastY = e.clientY;
    };
    const handlePointerMove = (e: MouseEvent) => {
      if (!orbitParamsRef.current.isDragging) return;
      const dx = e.clientX - orbitParamsRef.current.lastX;
      const dy = e.clientY - orbitParamsRef.current.lastY;
      orbitParamsRef.current.yaw -= dx * 0.01; // Инвертировано по горизонтали
      orbitParamsRef.current.pitch = Math.max(
        -0.3,
        Math.min(1.2, orbitParamsRef.current.pitch + dy * 0.01)
      );
      orbitParamsRef.current.lastX = e.clientX;
      orbitParamsRef.current.lastY = e.clientY;
    };
    const handlePointerUp = () => {
      orbitParamsRef.current.isDragging = false;
    };
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitParamsRef.current.distance = Math.max(
        0.8,
        Math.min(6.0, orbitParamsRef.current.distance + e.deltaY * 0.002)
      );
    };

    container.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    // Цикл рендера превью
    let rafId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const dt = Math.min(0.1, (time - lastTime) / 1000);
      lastTime = time;

      if (mixerRef.current) {
        mixerRef.current.update(dt);
      }

      // Обновление положения орбитальной камеры
      const { yaw, pitch, distance } = orbitParamsRef.current;
      const target = targetOrbitRef.current;
      const camX = target.x + distance * Math.cos(pitch) * Math.sin(yaw);
      const camY = target.y + distance * Math.sin(pitch);
      const camZ = target.z + distance * Math.cos(pitch) * Math.cos(yaw);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(target);

      renderer.render(scene, camera);
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      container.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      container.removeEventListener('wheel', handleWheel);

      if (mixerRef.current) {
        mixerRef.current.stopAllAction();
        mixerRef.current = null;
      }
      currentActionRef.current = null;

      if (modelGroupRef.current) {
        ThreeSyncSystem.disposeObject(modelGroupRef.current);
        modelGroupRef.current = null;
      }
      renderer.dispose();
      if (renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, [creatureRootId, world]);

  // Воспроизведение выбранного клипа на модели превью
  const playClip = (
    animName: string,
    mixer = mixerRef.current,
    structureType = animator?.rigType as BodyStructureType
  ) => {
    if (!mixer || !structureType) return;

    let clip: THREE.AnimationClip | null = null;
    if (ProceduralAssetManager.getInstance().hasBuilder(structureType)) {
      clip = ProceduralAssetManager.getInstance().getAnimationClip(structureType, animName);
    }

    const applyToMixer = (c: THREE.AnimationClip) => {
      mixer.stopAllAction();
      const action = mixer.clipAction(c);
      action.reset();
      action.setEffectiveTimeScale(speed);
      action.setLoop(THREE.LoopRepeat, Infinity);
      action.play();
      currentActionRef.current = action;
    };

    if (clip) {
      applyToMixer(clip);
    } else {
      const profile = CREATURE_RIG_PROFILES[structureType];
      const url = profile?.animations?.[animName];
      if (url && !url.startsWith('proc://')) {
        AssetManager.getInstance()
          .loadGLTF(url)
          .then((gltf) => {
            if (gltf.animations?.[0]) {
              applyToMixer(gltf.animations[0]);
            }
          });
      }
    }
  };

  const handleSelectAnimation = (animName: string) => {
    setActiveAnim(animName);
    playClip(animName);
  };

  // Реактивное обновление скорости на активном действии
  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
    if (currentActionRef.current) {
      currentActionRef.current.setEffectiveTimeScale(newSpeed);
    }
  };

  if (!selectedEntityId || !creatureRootId || !animator) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#777', fontSize: '12px' }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🎭</div>
        <div>{selectedEntityId ? t('dock.noAnimations') : t('dock.selectCreaturePrompt')}</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 1. Верхняя панель: поиск и ползунок скорости */}
      <div
        style={{
          padding: '8px 10px',
          backgroundColor: '#1a1a1a',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            type="text"
            placeholder={t('dock.searchAnimationsPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              flex: 1,
              boxSizing: 'border-box',
              backgroundColor: '#111',
              border: '1px solid #333',
              color: '#fff',
              padding: '6px 8px',
              borderRadius: '4px',
              fontSize: '12px',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#aaa',
                cursor: 'pointer',
                fontSize: '14px',
              }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Регулировка скорости через ползунок */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '11px', color: '#888' }}>{t('dock.playbackSpeed')}</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1,
              justifyContent: 'flex-end',
            }}
          >
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.05"
              value={speed}
              onChange={(e) => handleSpeedChange(parseFloat(e.target.value))}
              style={{ width: '100px', accentColor: '#2ecc71', cursor: 'pointer' }}
            />
            <span
              style={{
                fontSize: '11px',
                color: '#2ecc71',
                minWidth: '34px',
                fontWeight: 'bold',
                textAlign: 'right',
              }}
            >
              {speed.toFixed(2)}x
            </span>
          </div>
        </div>
      </div>

      {/* 2. Верхний блок: Список доступных анимаций */}
      <div style={{ flex: 1, minHeight: '80px', overflowY: 'auto', padding: '6px 8px' }}>
        <div
          style={{
            fontSize: '10px',
            color: '#666',
            marginBottom: '6px',
            textTransform: 'uppercase',
          }}
        >
          {t('dock.totalAnimations')} {filteredAnimations.length}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filteredAnimations.map((animName) => {
            const isPlaying = activeAnim === animName;

            let badgeColor = '#555';
            if (animName.startsWith('attack')) badgeColor = '#e74c3c';
            else if (animName.startsWith('pickup')) badgeColor = '#27ae60';
            else if (animName.startsWith('drop_item') || animName.startsWith('throw'))
              badgeColor = '#e67e22';
            else if (
              animName.includes('walk') ||
              animName.includes('jog') ||
              animName.includes('sprint') ||
              animName.includes('crawl')
            )
              badgeColor = '#2980b9';
            else if (animName.includes('idle')) badgeColor = '#8e44ad';
            else if (animName === 'dead' || animName.includes('fall')) badgeColor = '#7f8c8d';

            return (
              <div
                key={animName}
                onClick={() => handleSelectAnimation(animName)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  backgroundColor: isPlaying ? '#1b4332' : '#202020',
                  border: isPlaying ? '1px solid #2ecc71' : '1px solid #2e2e2e',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.12s',
                }}
                onMouseEnter={(e) => {
                  if (!isPlaying) e.currentTarget.style.backgroundColor = '#282828';
                }}
                onMouseLeave={(e) => {
                  if (!isPlaying) e.currentTarget.style.backgroundColor = '#202020';
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}
                >
                  <span style={{ fontSize: '12px' }}>{isPlaying ? '▶' : '🎬'}</span>
                  <span
                    style={{
                      fontSize: '12px',
                      color: isPlaying ? '#2ecc71' : '#ecf0f1',
                      fontWeight: isPlaying ? 'bold' : 'normal',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {animName}
                  </span>
                </div>

                <span
                  style={{
                    backgroundColor: badgeColor,
                    color: '#fff',
                    fontSize: '9px',
                    padding: '2px 5px',
                    borderRadius: '3px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                  }}
                >
                  {animName.includes('left_hand')
                    ? 'LEFT'
                    : animName.includes('right_hand')
                      ? 'RIGHT'
                      : animName.split('_')[0].toUpperCase()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Сплиттер регулировки высоты окна превью */}
      <div
        onMouseDown={startResizingPreview}
        style={{
          height: '5px',
          backgroundColor: isResizingPreview ? '#2196f3' : '#2a2a2a',
          cursor: 'row-resize',
          borderTop: '1px solid #3a3a3a',
          borderBottom: '1px solid #111',
          flexShrink: 0,
          transition: 'background-color 0.15s',
        }}
        title="Потяните для изменения размера окна превью"
      />

      {/* 4. Нижний блок: Изолированное 3D-окно модели существа */}
      <div
        style={{
          height: `${previewHeight}px`,
          position: 'relative',
          backgroundColor: '#141414',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        <div
          ref={canvasContainerRef}
          style={{ width: '100%', height: '100%', cursor: 'grab', position: 'relative' }}
          onMouseDown={(e) => (e.currentTarget.style.cursor = 'grabbing')}
          onMouseUp={(e) => (e.currentTarget.style.cursor = 'grab')}
        />

        {/* Наложение подсказки на окно превью */}
        <div
          style={{
            position: 'absolute',
            bottom: '6px',
            left: '8px',
            fontSize: '9px',
            color: '#666',
            pointerEvents: 'none',
            userSelect: 'none',
            backgroundColor: 'rgba(0,0,0,0.6)',
            padding: '2px 6px',
            borderRadius: '3px',
          }}
        >
          {t('dock.previewControlsHint')}
        </div>
      </div>
    </div>
  );
};
