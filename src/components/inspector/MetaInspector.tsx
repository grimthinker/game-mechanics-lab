import React from 'react';
import { CreatureStance } from '../../ecs/types';

export interface MetaInspectorProps {
  name: string;
  onChange: (name: string) => void;
  isReadOnly?: boolean;
  stance?: CreatureStance;
}

export const MetaInspector: React.FC<MetaInspectorProps> = ({
  name,
  onChange,
  isReadOnly,
  stance,
}) => {
  const getStanceLabel = (s?: CreatureStance) => {
    if (!s) return null;
    if (s === 'standing') return { text: 'Стоя', color: '#2980b9' };
    if (s === 'crouching') return { text: 'Присед', color: '#8e44ad' };
    if (s === 'prone') return { text: 'Лёжа', color: '#795548' };
    return { text: `Переход (${s})`, color: '#d35400' };
  };

  const stanceInfo = getStanceLabel(stance);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label>
        Имя / Название:
        <input
          disabled={isReadOnly}
          type="text"
          value={name}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {stanceInfo && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#888',
          }}
        >
          <span>Текущее положение:</span>
          <span
            style={{
              backgroundColor: stanceInfo.color,
              color: '#fff',
              padding: '2px 8px',
              borderRadius: '4px',
              fontWeight: 'bold',
            }}
          >
            {stanceInfo.text}
          </span>
        </div>
      )}
    </div>
  );
};
