import React from 'react';
import { World } from '../../ecs/World';
import { findAllInventoriesInHierarchy } from '../../ecs/utils/hierarchy';
import { t } from '../../locales';

export interface InventoryInspectorProps {
  targetId: string;
  world: World;
  onNavigate: (id: string, label: string) => void;
}

export const InventoryInspector: React.FC<InventoryInspectorProps> = ({
  targetId,
  world,
  onNavigate,
}) => {
  const discoveredInventories = findAllInventoriesInHierarchy(world, targetId);

  if (discoveredInventories.length === 0) {
    return (
      <div style={{ color: '#777', fontSize: '11px', fontStyle: 'italic' }}>
        {t('inspector.noInventory')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {discoveredInventories.map((entry, idx) => (
        <div
          key={`${entry.containerId}_${idx}`}
          style={{
            backgroundColor: '#181818',
            border: '1px solid #333',
            borderRadius: '6px',
            padding: '8px 10px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: entry.distance > 0 ? '4px' : '8px',
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#2ecc71' }}>
              📦 {entry.containerName}
            </span>
            {entry.containerId !== targetId && (
              <button
                type="button"
                className="btn btn-sm"
                style={{
                  padding: '1px 5px',
                  fontSize: '9px',
                  backgroundColor: '#2c3e50',
                  color: '#fff',
                }}
                onClick={() => onNavigate(entry.containerId, entry.containerName)}
              >
                Перейти →
              </button>
            )}
          </div>

          {entry.distance > 0 && (
            <div
              style={{
                fontSize: '10px',
                color: '#888',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ color: '#666' }}>Путь:</span>
              {entry.path.map((p, pIdx) => (
                <React.Fragment key={`${p.id}_${pIdx}`}>
                  <span
                    style={{
                      color: pIdx === entry.path.length - 1 ? '#2ecc71' : '#3498db',
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                    onClick={() => onNavigate(p.id, p.name)}
                    title={`Перейти к ${p.name}`}
                  >
                    {p.name}
                  </span>
                  {pIdx < entry.path.length - 1 && <span style={{ color: '#555' }}>→</span>}
                </React.Fragment>
              ))}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${entry.inventory.size.width}, 36px)`,
              gap: '4px',
              justifyContent: 'center',
              backgroundColor: '#111',
              padding: '8px',
              borderRadius: '4px',
            }}
          >
            {entry.inventory.slots.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const it = cell.itemId ? world.getComponent(cell.itemId, 'item') : null;
                return (
                  <div
                    key={`${rIdx}_${cIdx}`}
                    onClick={() => {
                      if (cell.itemId) onNavigate(cell.itemId, it?.name || 'Предмет');
                    }}
                    title={
                      it
                        ? `${it.name} (${it.type})${it.count > 1 ? ` x${it.count}` : ''}`
                        : 'Пустая ячейка'
                    }
                    style={{
                      width: '36px',
                      height: '36px',
                      backgroundColor: it ? '#2980b9' : '#222',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: cell.itemId ? 'pointer' : 'default',
                      fontSize: '9px',
                      color: '#fff',
                      textAlign: 'center',
                      padding: '2px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <span>{it ? it.name.substring(0, 4) : ''}</span>
                    {it && it.count > 1 && (
                      <span
                        style={{
                          fontSize: '8px',
                          color: '#f1c40f',
                          fontWeight: 'bold',
                        }}
                      >
                        x{it.count}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
