import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { GameplayZoneRole } from '../../ecs/components/zone';

export interface GameplayZoneInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
}

export const GameplayZoneInspector: React.FC<GameplayZoneInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
}) => {
  const zone = world.getComponent(targetId, 'gameplayZone');
  const [role, setRole] = useState<GameplayZoneRole>(zone?.role ?? 'generic');
  const [zoneTag, setZoneTag] = useState<string>(zone?.zoneTag ?? '');

  useEffect(() => {
    const comp = world.getComponent(targetId, 'gameplayZone');
    if (comp) {
      setRole(comp.role);
      setZoneTag(comp.zoneTag ?? '');
    }
  }, [targetId, world]);

  if (!zone) return null;

  const handleUpdate = (patch: Partial<typeof zone>) => {
    if (patch.role !== undefined) setRole(patch.role);
    if (patch.zoneTag !== undefined) setZoneTag(patch.zoneTag);

    if (app) {
      app.mutations.updateEntityGameplayZone(targetId, patch);
      onCommit('Изменение параметров логической зоны');
    }
  };

  const occupants = zone.occupantIds || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Роль зоны:</span>
        <select
          disabled={isReadOnly}
          value={role}
          onChange={(e) => handleUpdate({ role: e.target.value as GameplayZoneRole })}
          style={{ width: '150px', padding: '3px' }}
        >
          <option value="generic">Общая (Generic)</option>
          <option value="quest">Квест: Точка назначения</option>
          <option value="ai_area">ИИ: Зона сбора / лагерь</option>
          <option value="throw_target">ИИ: Цель броска</option>
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span>Тег / Идентификатор зоны:</span>
        <input
          disabled={isReadOnly}
          type="text"
          value={zoneTag}
          placeholder="например: quest_point_1"
          onChange={(e) => handleUpdate({ zoneTag: e.target.value })}
          style={{ padding: '4px 6px', fontSize: '12px' }}
        />
      </label>

      <div
        style={{
          marginTop: '6px',
          padding: '8px',
          backgroundColor: '#1b1b1b',
          borderRadius: '4px',
          border: '1px solid #333',
        }}
      >
        <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
          Сущностей внутри: <strong>{occupants.length}</strong>
        </div>
        {occupants.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              maxHeight: '90px',
              overflowY: 'auto',
            }}
          >
            {occupants.map((id) => {
              const name =
                world.getComponent(id, 'meta')?.name || world.getComponent(id, 'item')?.name || id;
              return (
                <div
                  key={id}
                  style={{ fontSize: '10px', color: '#2ecc71', fontFamily: 'monospace' }}
                >
                  • {name}
                </div>
              );
            })}
          </div>
        ) : (
          <span style={{ fontSize: '10px', color: '#666', fontStyle: 'italic' }}>Зона пуста</span>
        )}
      </div>
    </div>
  );
};
