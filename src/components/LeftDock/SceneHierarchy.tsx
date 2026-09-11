import React, { useState, useMemo } from 'react';
import { World } from '../../ecs/World';

interface SceneHierarchyProps {
  world: World | null | undefined;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
  onFocusEntity: (id: string) => void;
}

const ARCHETYPE_CONFIG: Record<string, { label: string; icon: string }> = {
  creature: { label: 'Существа', icon: '👤' },
  item: { label: 'Предметы', icon: '📦' },
  obstacle: { label: 'Препятствия', icon: '🧱' },
  zone: { label: 'Зоны', icon: '🌀' },
  marker: { label: 'Маркеры', icon: '📍' },
};

export const SceneHierarchy: React.FC<SceneHierarchyProps> = ({
  world,
  selectedEntityId,
  onSelectEntity,
  onFocusEntity,
}) => {
  const [search, setSearch] = useState('');

  const groupedEntities = useMemo(() => {
    const groups: Record<string, Array<{ id: string; name: string; hp?: string; icon: string }>> = {
      creature: [],
      item: [],
      obstacle: [],
      zone: [],
      marker: [],
    };

    if (!world) return groups;

    const allEntities = world.getAllEntities();
    const q = search.trim().toLowerCase();

    for (const [id, comp] of allEntities) {
      const tag = comp.tag;
      const meta = comp.meta;
      const item = comp.item;
      const health = comp.health;

      const archetype = tag?.archetype ?? meta?.entityType ?? 'creature';
      const name = meta?.name ?? item?.name ?? id;

      if (q && !name.toLowerCase().includes(q) && !id.toLowerCase().includes(q)) {
        continue;
      }

      let icon = ARCHETYPE_CONFIG[archetype]?.icon ?? '❓';
      if (archetype === 'item' && item) {
        if (item.type === 'weapon') icon = '⚔️';
        else if (item.type === 'armor') icon = '🛡️';
        else if (item.type === 'bag') icon = '🎒';
      }

      const hp = health
        ? `${Math.round(health.current)}/${Math.round(health.max.current)}`
        : undefined;

      if (groups[archetype]) {
        groups[archetype].push({ id, name, hp, icon });
      } else {
        groups.creature.push({ id, name, hp, icon });
      }
    }

    return groups;
  }, [world, search]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Строка поиска */}
      <div style={{ padding: '8px 10px', borderBottom: '1px solid #2a2a2a' }}>
        <input
          type="text"
          placeholder="Поиск сущностей..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: '#111',
            border: '1px solid #333',
            color: '#fff',
            padding: '6px 8px',
            borderRadius: '4px',
            fontSize: '12px',
          }}
        />
      </div>

      {/* Список сущностей */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 6px' }}>
        {Object.entries(ARCHETYPE_CONFIG).map(([archKey, meta]) => {
          const list = groupedEntities[archKey] || [];
          if (list.length === 0 && search) return null;

          return (
            <details key={archKey} open style={{ marginBottom: '8px' }}>
              <summary
                style={{
                  fontSize: '11px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  color: '#888',
                  cursor: 'pointer',
                  padding: '4px 6px',
                  userSelect: 'none',
                }}
              >
                {meta.icon} {meta.label} ({list.length})
              </summary>

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '2px' }}
              >
                {list.length === 0 ? (
                  <div
                    style={{
                      fontSize: '11px',
                      color: '#555',
                      padding: '2px 16px',
                      fontStyle: 'italic',
                    }}
                  >
                    Пусто
                  </div>
                ) : (
                  list.map((entity) => {
                    const isSelected = entity.id === selectedEntityId;
                    return (
                      <div
                        key={entity.id}
                        onClick={() => onSelectEntity(entity.id)}
                        onDoubleClick={() => onFocusEntity(entity.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 8px',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#1b4332' : 'transparent',
                          border: isSelected ? '1px solid #2ecc71' : '1px solid transparent',
                          fontSize: '12px',
                          color: isSelected ? '#fff' : '#ccc',
                          transition: 'background-color 0.15s',
                        }}
                        title={`ID: ${entity.id}\nОдинарный клик — выбрать\nДвойной клик — переместить камеру`}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            overflow: 'hidden',
                          }}
                        >
                          <span style={{ fontSize: '13px' }}>{entity.icon}</span>
                          <span
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {entity.name}
                          </span>
                        </div>
                        {entity.hp && (
                          <span
                            style={{
                              fontSize: '10px',
                              color: '#27ae60',
                              marginLeft: '6px',
                              flexShrink: 0,
                            }}
                          >
                            {entity.hp}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
};
