import React from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { TargetModelViewport } from './TargetModelViewport';
import { RETRO_PANEL_STYLE, RETRO_HEADER_STYLE, RETRO_BUTTON_STYLE } from './RetroStyles';
import { t } from '../../locales';

export interface BlockTargetPanelProps {
  app?: GameApp | null;
  world: World | null | undefined;
  targetId: string;
  onOpenInspect: (targetId: string) => void;
}

export const BlockTargetPanel: React.FC<BlockTargetPanelProps> = ({
  app,
  world,
  targetId,
  onOpenInspect,
}) => {
  if (!world || !world.hasEntity(targetId)) return null;

  const playerId = app ? app.getPlayerEntityId() : null;
  const tag = world.getComponent(targetId, 'tag');
  const meta = world.getComponent(targetId, 'meta');
  const item = world.getComponent(targetId, 'item');
  const interactable = world.getComponent(targetId, 'interactable');

  const archetype = tag?.archetype ?? meta?.entityType;
  const isCreature = archetype === 'creature';
  const isItem = archetype === 'item' || !!item;

  const targetName = meta?.name ?? item?.name ?? targetId;

  const handleTake = () => {
    if (app && playerId) {
      app.updateEntityBlackboard(playerId, 'requestedPickupId', targetId);
    }
  };

  const handleDeselect = () => {
    if (app) {
      app.selection.selectGameTarget(null);
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 250,
        right: 16,
        width: 224,
        ...RETRO_PANEL_STYLE,
        padding: '6px',
        zIndex: 85,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {/* Шапка с именем цели */}
      <div style={RETRO_HEADER_STYLE}>
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '180px',
          }}
          title={targetName}
        >
          {targetName}
        </span>
        <button
          type="button"
          onClick={handleDeselect}
          style={{
            background: 'none',
            border: 'none',
            color: '#fff',
            cursor: 'pointer',
            fontSize: '12px',
            padding: '0 4px',
            fontFamily: 'inherit',
          }}
          title={t('interaction.deselect')}
        >
          ✕
        </button>
      </div>

      {/* 3D-окно модели цели */}
      <div
        style={{
          width: '100%',
          height: '140px',
          border: '2px solid #222',
          borderRadius: '2px',
          overflow: 'hidden',
          backgroundColor: '#141414',
        }}
      >
        <TargetModelViewport app={app} world={world} targetId={targetId} playerId={playerId} />
      </div>

      {/* Кнопки действий цели */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <button type="button" style={RETRO_BUTTON_STYLE} onClick={() => onOpenInspect(targetId)}>
          🔍 {t('interaction.inspect')}
        </button>

        {isItem && (
          <button type="button" style={RETRO_BUTTON_STYLE} onClick={handleTake}>
            ✋ {t('interaction.take')}
          </button>
        )}

        {isCreature && (
          <button
            type="button"
            style={{ ...RETRO_BUTTON_STYLE, opacity: 0.7 }}
            onClick={() => alert('Команда «Следовать» (заглушка)')}
          >
            🚶 {t('interaction.follow')}
          </button>
        )}

        {(isCreature || isItem) && (
          <button
            type="button"
            style={{ ...RETRO_BUTTON_STYLE, opacity: 0.7 }}
            onClick={() => alert('Команда «Толкнуть» (заглушка)')}
          >
            💨 {t('interaction.push')}
          </button>
        )}

        <button
          type="button"
          style={{ ...RETRO_BUTTON_STYLE, color: '#7a0000' }}
          onClick={handleDeselect}
        >
          ✕ {t('interaction.deselect')}
        </button>
      </div>
    </div>
  );
};
