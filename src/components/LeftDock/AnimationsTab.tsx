import React, { useState, useMemo, useEffect, useRef } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { getRootOwner } from '../../ecs/utils/hierarchy';
import { BodyStructureType } from '../../ecs/templates';
import { CREATURE_RIG_PROFILES } from '../../rendering/rigProfiles';
import { ProceduralCreatureAssetManager } from '../../rendering/creatures/ProceduralAssetManager';
import { ModelPreviewViewport } from '../ModelPreviewViewport';
import { useResizable } from '../../hooks/useResizable';
import { t } from '../../locales';

interface AnimationsTabProps {
  app?: GameApp | null;
  world: World | null | undefined;
  selectedEntityId: string | null;
}

export const AnimationsTab: React.FC<AnimationsTabProps> = ({ app, world, selectedEntityId }) => {
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

    if (ProceduralCreatureAssetManager.getInstance().hasBuilder(structureType)) {
      const builder = (ProceduralCreatureAssetManager.getInstance() as any).builders?.get(
        structureType
      );
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

  const handleSelectAnimation = (animName: string) => {
    setActiveAnim(animName);
  };

  const handleSpeedChange = (newSpeed: number) => {
    setSpeed(newSpeed);
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
        <ModelPreviewViewport
          app={app}
          world={world}
          creatureId={creatureRootId}
          structureType={animator.rigType}
          animName={activeAnim}
          speed={speed}
        />
      </div>
    </div>
  );
};
