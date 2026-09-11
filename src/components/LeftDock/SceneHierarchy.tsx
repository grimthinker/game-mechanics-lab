import React, { useState, useMemo } from 'react';
import { World } from '../../ecs/World';

interface SceneHierarchyProps {
  world: World | null | undefined;
  selectedEntityId: string | null;
  onSelectEntity: (id: string) => void;
  onFocusEntity: (id: string) => void;
}

interface EntityHierarchyItem {
  id: string;
  name: string;
  hp?: string;
  icon: string;
  badges: Array<{ label: string; color: string }>;
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
    const groups: Record<string, EntityHierarchyItem[]> = {
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

      const badges: Array<{ label: string; color: string }> = [];
      if (comp.aiStats?.behavior.current && comp.aiStats.behavior.current !== 'IdleTree') {
        badges.push({ label: 'AI', color: '#2980b9' });
      }
      if (
        comp.equip &&
        (comp.equip.interactionSlots.some((s) => s.itemId) ||
          comp.equip.equipmentAreas.some((a) => a.itemIds.length > 0))
      ) {
        badges.push({ label: 'ЭКИП', color: '#8e44ad' });
      }
      if (comp.inventory && comp.inventory.slots.some((row) => row.some((cell) => cell.itemId))) {
        badges.push({ label: 'ИНВ', color: '#27ae60' });
      }
      if (comp.zoneTrigger) {
        badges.push({ label: 'ЗОНА', color: '#d35400' });
      }

      const entityData: EntityHierarchyItem = { id, name, hp, icon, badges };

      if (groups[archetype]) {
        groups[archetype].push(entityData);
      } else {
        groups.creature.push(entityData);
      }
    }

    return groups;
  }, [world, search]);

  const totalCount = world ? world.getAllEntities().length : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Строка поиска и общий счетчик */}
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid #2a2a2a',
          display: 'flex',
          gap: '8px',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Поиск сущностей..."
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
        <span style={{ fontSize: '10px', color: '#777', flexShrink: 0 }}>
          Всего: <strong style={{ color: '#aaa' }}>{totalCount}</strong>
        </span>
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
                          {entity.badges &&
                            entity.badges.map((b) => (
                              <span
                                key={b.label}
                                className="entity-badge"
                                style={{ backgroundColor: b.color }}
                              >
                                {b.label}
                              </span>
                            ))}
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
