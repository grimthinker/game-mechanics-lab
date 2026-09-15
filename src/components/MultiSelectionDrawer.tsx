import React from 'react';
import { World } from '../ecs/World';
import { useResizable } from '../hooks/useResizable';
import { t } from '../locales';

export interface MultiSelectionDrawerProps {
  selectedEntityIds: string[];
  selectedEntityId: string | null;
  world: World | null | undefined;
  typeFilters: Record<string, boolean>;
  onToggleFilter: (type: string) => void;
  onSelectEntity: (id: string) => void;
  onDeselectEntity: (id: string) => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
}

const getArchetypeLabels = (): Record<string, { label: string; icon: string }> => ({
  creature: { label: t('selectionDrawer.creatures'), icon: '👤' },
  item: { label: t('selectionDrawer.items'), icon: '📦' },
  obstacle: { label: t('selectionDrawer.obstacles'), icon: '🧱' },
  zone: { label: t('selectionDrawer.zones'), icon: '🌀' },
  marker: { label: t('selectionDrawer.markers'), icon: '📍' },
  bodyPart: { label: t('selectionDrawer.bodyParts'), icon: '🥩' },
});

export const MultiSelectionDrawer: React.FC<MultiSelectionDrawerProps> = ({
  selectedEntityIds,
  selectedEntityId,
  world,
  typeFilters,
  onToggleFilter,
  onSelectEntity,
  onDeselectEntity,
  onClearSelection,
  onDeleteSelected,
}) => {
  // Унифицированный ресайз высоты нижней шторки (вызывается строго до любых условий)
  const {
    size: panelHeight,
    isResizing,
    startResizing,
  } = useResizable({
    storageKey: 'selectionPanelHeight',
    initialSize: 150,
    minSize: 90,
    maxSize: () => Math.max(90, window.innerHeight - 200),
    direction: 'resize-top',
  });

  // Автоматическое скрытие: панель активна только при групповом выделении (2+ сущности)
  if (selectedEntityIds.length <= 1) {
    return null;
  }

  const getEntityDisplayData = (id: string) => {
    if (!world) return { name: id, icon: '❓', archetype: 'unknown' };

    const tag = world.getComponent(id, 'tag');
    const meta = world.getComponent(id, 'meta');
    const item = world.getComponent(id, 'item');
    const health = world.getComponent(id, 'health');

    const labels = getArchetypeLabels();
    const archetype = tag?.archetype ?? meta?.entityType ?? 'creature';
    let icon = labels[archetype]?.icon ?? '❓';

    if (archetype === 'item' && item) {
      if (item.type === 'weapon') icon = '⚔️';
      else if (item.type === 'armor') icon = '🛡️';
      else if (item.type === 'bag') icon = '🎒';
    }

    const name = meta?.name ?? item?.name ?? id;
    const hp = health ? `${Math.round(health.current)}/${Math.round(health.max.current)}` : null;

    return { name, icon, archetype, hp };
  };

  const labels = getArchetypeLabels();

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: `${panelHeight}px`,
        backgroundColor: '#181818',
        borderTop: '2px solid #333',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 40,
        boxShadow: '0 -4px 15px rgba(0,0,0,0.5)',
        userSelect: 'none',
        overflow: 'hidden',
      }}
    >
      {/* Ручка изменения высоты */}
      <div
        onMouseDown={startResizing}
        style={{
          height: '5px',
          width: '100%',
          cursor: 'ns-resize',
          backgroundColor: isResizing ? '#2196f3' : 'transparent',
          transition: 'background-color 0.15s',
        }}
      />

      {/* Верхняя строка управления: Фильтры + Кнопки */}
      <div
        style={{
          padding: '6px 14px',
          backgroundColor: '#202020',
          borderBottom: '1px solid #2e2e2e',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#888',
              textTransform: 'uppercase',
            }}
          >
            {t('selectionDrawer.filterTitle')}
          </span>
          {Object.entries(labels).map(([arch, { label, icon }]) => (
            <label
              key={arch}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                color: typeFilters[arch] !== false ? '#ecf0f1' : '#777',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={typeFilters[arch] !== false}
                onChange={() => onToggleFilter(arch)}
                style={{ cursor: 'pointer' }}
              />
              <span>
                {icon} {label}
              </span>
            </label>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#aaa', marginRight: '6px' }}>
            {t('selectionDrawer.selectedCount')}{' '}
            <strong style={{ color: '#2ecc71' }}>{selectedEntityIds.length}</strong>
          </span>
          {selectedEntityIds.length > 0 && (
            <>
              <button
                className="btn btn-sm"
                onClick={onClearSelection}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  backgroundColor: '#34495e',
                  color: '#fff',
                }}
              >
                {t('selectionDrawer.clearSelection')}
              </button>
              <button
                className="btn btn-sm"
                onClick={onDeleteSelected}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  backgroundColor: '#c0392b',
                  color: '#fff',
                }}
              >
                {t('selectionDrawer.deleteCount', { count: selectedEntityIds.length })}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Сетка сущностей */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '8px 12px',
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: '6px',
        }}
      >
        {selectedEntityIds.length === 0 ? (
          <div
            style={{ color: '#666', fontSize: '12px', padding: '10px 4px', fontStyle: 'italic' }}
          >
            {t('selectionDrawer.emptyHint')}
          </div>
        ) : (
          selectedEntityIds.map((id) => {
            const isActive = id === selectedEntityId;
            const data = getEntityDisplayData(id);

            return (
              <div
                key={id}
                onClick={() => onSelectEntity(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  backgroundColor: isActive ? '#1b4332' : '#252525',
                  border: isActive ? '1px solid #2ecc71' : '1px solid #3a3a3a',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  minWidth: '130px',
                  maxWidth: '190px',
                  height: '32px',
                  boxSizing: 'border-box',
                  transition: 'background-color 0.15s, border-color 0.15s',
                }}
                title={`${data.name} (${id})`}
              >
                <span style={{ fontSize: '14px' }}>{data.icon}</span>
                <div
                  style={{
                    flex: 1,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: isActive ? '#fff' : '#ddd',
                      fontWeight: isActive ? 'bold' : 'normal',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {data.name}
                  </div>
                  {data.hp && <div style={{ fontSize: '9px', color: '#27ae60' }}>{data.hp}</div>}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeselectEntity(id);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '12px',
                    padding: '0 2px',
                  }}
                  title={t('selectionDrawer.excludeTitle')}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
