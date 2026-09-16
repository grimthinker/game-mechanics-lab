import React from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { t } from '../../locales';

export interface SocketsInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const SocketsInspector: React.FC<SocketsInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const socketLink = world.getComponent(targetId, 'socketLink');
  if (!socketLink || !socketLink.links) return null;

  return (
    <>
      {Object.entries(socketLink.links).map(([socketId, link]) => {
        const targetMeta = world.getComponent(link.targetEntityId, 'meta');
        const maxStr = link.maxStrength?.base ?? 50;

        return (
          <div
            key={socketId}
            style={{
              marginBottom: '8px',
              padding: '8px',
              backgroundColor: '#181818',
              borderRadius: '4px',
              border: '1px solid #333',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12px',
                fontWeight: 'bold',
                color: '#3498db',
                marginBottom: '4px',
              }}
            >
              <span>Сокет: {socketId}</span>
              <span style={{ color: '#aaa' }}>→ {targetMeta?.name || link.targetEntityId}</span>
            </div>
            <label
              style={{
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              Прочность связи:
              <input
                disabled={isReadOnly}
                type="number"
                defaultValue={Math.round(link.currentStrength)}
                min={-maxStr}
                max={maxStr}
                style={{ width: '60px', padding: '2px' }}
                onChange={(e) => {
                  if (app) {
                    app.updateEntitySocketLinkStrength(targetId, socketId, Number(e.target.value));
                    onCommit(t('history.socketStrengthChange'));
                  }
                }}
              />
            </label>
          </div>
        );
      })}
    </>
  );
};
