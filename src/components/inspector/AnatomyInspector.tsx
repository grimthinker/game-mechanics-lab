import React from 'react';
import { World } from '../../ecs/World';
import { t } from '../../locales';

export interface AnatomyInspectorProps {
  targetId: string;
  world: World;
  anatomyParts: string[];
  onNavigate: (id: string, label: string) => void;
}

export const AnatomyInspector: React.FC<AnatomyInspectorProps> = ({
  targetId,
  world,
  anatomyParts,
  onNavigate,
}) => {
  if (anatomyParts.length <= 1) return null;

  return (
    <>
      {anatomyParts.map((partId) => {
        const meta = world.getComponent(partId, 'meta');
        const brain = world.getComponent(partId, 'bodyBrain');
        const isRoot = partId === targetId;

        return (
          <div
            key={partId}
            onClick={() => onNavigate(partId, meta?.name || partId)}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderBottom: '1px solid #333',
              cursor: 'pointer',
              backgroundColor: isRoot ? '#1b4332' : 'transparent',
              borderRadius: '4px',
              marginBottom: '4px',
            }}
          >
            <span style={{ color: isRoot ? '#2ecc71' : '#ecf0f1', fontSize: '12px' }}>
              {meta?.name || partId}
            </span>
            {brain && (
              <span style={{ fontSize: '10px', color: '#f1c40f', fontWeight: 'bold' }}>
                [Мозг: {brain.power}]
              </span>
            )}
          </div>
        );
      })}
    </>
  );
};
