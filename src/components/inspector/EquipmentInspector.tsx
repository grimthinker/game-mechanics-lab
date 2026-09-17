import React, { useRef } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { STANDARD_EQUIPMENT_AREA_TYPES, EQUIPMENT_AREA_TYPE_LABELS } from '../../ecs/types';
import { getAnatomyParts, calculateTotalEntityWeight } from '../../ecs/utils/hierarchy';
import { useDragDrop } from '../../dnd/DragDropContext';
import { findItemLocation } from '../../ecs/utils/itemValidation';
import { t } from '../../locales';

export interface EquipmentInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
  onNavigate: (id: string, label: string) => void;
}

export const EquipmentInspector: React.FC<EquipmentInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
  onNavigate,
}) => {
  const { isDragging, startDrag, setHoverTarget, hoverTarget, isValidTarget } = useDragDrop();
  const dragCandidateRef = useRef<{ x: number; y: number } | null>(null);
  const wasDraggingRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isReadOnly) return;
    dragCandidateRef.current = { x: e.clientX, y: e.clientY };
    wasDraggingRef.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent, itemId: string) => {
    if (dragCandidateRef.current && !isDragging) {
      const dx = e.clientX - dragCandidateRef.current.x;
      const dy = e.clientY - dragCandidateRef.current.y;
      if (Math.hypot(dx, dy) > 5) {
        const comp = world.getEntity(itemId);
        if (comp && comp.item) {
          const source = findItemLocation(world, itemId);
          if (source) {
            let icon = '📦';
            if (comp.item.type === 'weapon') icon = '⚔️';
            else if (comp.item.type === 'armor') icon = '🛡️';
            else if (comp.item.type === 'bag') icon = '🎒';
            else if (comp.item.type === 'bodyPart') icon = '🥩';

            startDrag(
              {
                id: itemId,
                name: comp.meta?.name ?? comp.item.name,
                icon,
                size: comp.item.size,
                weight: comp.physicsStats?.weight.current ?? 1,
              },
              source,
              e.clientX,
              e.clientY
            );
          }
        }
        dragCandidateRef.current = null;
        wasDraggingRef.current = true;
      }
    }
  };

  const handlePointerUp = () => {
    dragCandidateRef.current = null;
  };

  const currentArchetype = world.getComponent(targetId, 'tag')?.archetype;
  const hasAssembly = world.getComponent(targetId, 'assemblyRoot') !== undefined;
  const equip = world.getComponent(targetId, 'equip');
  const isCreatureOrAssembly = currentArchetype === 'creature' || hasAssembly;

  let displayAreas: { area: any; containerId: string; containerName: string }[] = [];
  if (equip && equip.equipmentAreas) {
    const meta = world.getComponent(targetId, 'meta');
    displayAreas = equip.equipmentAreas.map((area) => ({
      area,
      containerId: targetId,
      containerName: meta?.name || targetId,
    }));
  } else if (isCreatureOrAssembly) {
    const parts = getAnatomyParts(world, targetId);
    for (const pId of parts) {
      const pMeta = world.getComponent(pId, 'meta');
      const pEquip = world.getComponent(pId, 'equip');
      if (pEquip && pEquip.equipmentAreas) {
        for (const area of pEquip.equipmentAreas) {
          displayAreas.push({
            area,
            containerId: pId,
            containerName: pMeta?.name || pId,
          });
        }
      }
    }
  }

  if (displayAreas.length === 0) {
    return (
      <div style={{ color: '#777', fontSize: '11px', fontStyle: 'italic' }}>
        {isCreatureOrAssembly ? t('inspector.noPartEquip') : t('inspector.noEquipAreas')}
      </div>
    );
  }

  return (
    <>
      {displayAreas.map(({ area, containerId, containerName }, idx) => {
        let usedSpace = 0;
        for (const id of area.itemIds) {
          const item = world.getComponent(id, 'item');
          if (item) usedSpace += item.size;
        }
        const isOverloaded = usedSpace > area.space;
        const isFromPart = containerId !== targetId;

        const isHoveredTarget =
          isDragging &&
          hoverTarget?.type === 'area' &&
          hoverTarget.containerId === containerId &&
          hoverTarget.areaId === area.id;
        let bgColor = '#181818';
        let borderColor = '#333';
        if (isHoveredTarget) {
          if (isValidTarget) {
            bgColor = '#1e8449';
            borderColor = '#2ecc71';
          } else {
            bgColor = '#641e16';
            borderColor = '#e74c3c';
          }
        }

        return (
          <div
            key={`area_${area.id || idx}`}
            onPointerEnter={() => {
              if (isDragging && !isReadOnly)
                setHoverTarget({ type: 'area', containerId, areaId: area.id });
            }}
            onPointerLeave={() => {
              if (isDragging && isHoveredTarget) setHoverTarget(null);
            }}
            style={{
              marginBottom: '8px',
              padding: '10px',
              backgroundColor: bgColor,
              borderRadius: '4px',
              border: `1px solid ${borderColor}`,
              transition: 'background-color 0.1s, border-color 0.1s',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
              }}
            >
              <input
                disabled={isReadOnly}
                type="text"
                key={`area_name_${containerId}_${area.id || idx}`}
                defaultValue={area.name}
                style={{
                  width: '45%',
                  padding: '2px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  color: '#2ecc71',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: '1px solid #444',
                }}
                onChange={(e) => {
                  if (app) {
                    app.updateEquipmentArea(containerId, area.id, { name: e.target.value });
                    onCommit(t('history.equipName'));
                  }
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '11px', color: isOverloaded ? '#e74c3c' : '#888' }}>
                  {usedSpace} /{' '}
                  <input
                    disabled={isReadOnly}
                    type="number"
                    key={`area_space_${containerId}_${area.id || idx}`}
                    defaultValue={area.space}
                    style={{
                      width: '36px',
                      padding: '0',
                      background: 'transparent',
                      color: 'inherit',
                      border: 'none',
                      borderBottom: '1px solid #444',
                    }}
                    onChange={(e) => {
                      if (app) {
                        app.updateEquipmentArea(containerId, area.id, {
                          space: Math.max(1, +e.target.value),
                        });
                        onCommit(t('history.equipSpace'));
                      }
                    }}
                  />
                </span>
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      if (area.itemIds.length > 0) {
                        alert(t('inspector.equipRemoveWarn'));
                        return;
                      }
                      if (app) {
                        app.removeEquipmentArea(containerId, area.id);
                        onCommit(t('history.equipRemove'));
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#e74c3c',
                      cursor: 'pointer',
                      fontSize: '12px',
                      padding: '0 2px',
                    }}
                    title="Удалить область"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {isFromPart && (
              <div
                style={{
                  fontSize: '10px',
                  color: '#3498db',
                  marginBottom: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Часть тела: {containerName}</span>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    padding: '1px 5px',
                    fontSize: '9px',
                    backgroundColor: '#2c3e50',
                    color: '#fff',
                  }}
                  onClick={() => onNavigate(containerId, containerName)}
                >
                  Перейти →
                </button>
              </div>
            )}

            <label
              style={{
                fontSize: '11px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              Тип области:
              <input
                disabled={isReadOnly}
                type="text"
                key={`area_type_${containerId}_${area.id || idx}`}
                defaultValue={area.type}
                list="area_types_list"
                style={{ width: '65%', padding: '2px 4px', fontSize: '11px' }}
                onChange={(e) => {
                  if (app) {
                    app.updateEquipmentArea(containerId, area.id, { type: e.target.value });
                    onCommit(t('history.equipType'));
                  }
                }}
              />
              <datalist id="area_types_list">
                {STANDARD_EQUIPMENT_AREA_TYPES.map((typeKey) => (
                  <option key={typeKey} value={typeKey}>
                    {EQUIPMENT_AREA_TYPE_LABELS[typeKey] || typeKey}
                  </option>
                ))}
              </datalist>
            </label>

            <div
              style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #2a2a2a',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {area.itemIds.length > 0 ? (
                area.itemIds.map((itemId: string) => {
                  const it = world.getComponent(itemId, 'item');
                  const itWeight = calculateTotalEntityWeight(world, itemId);
                  return (
                    <div key={itemId} style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onPointerDown={handlePointerDown}
                        onPointerMove={(e) => handlePointerMove(e, itemId)}
                        onPointerUp={handlePointerUp}
                        style={{
                          flex: 1,
                          backgroundColor: '#1e3d29',
                          color: '#ecf0f1',
                          textAlign: 'left',
                          display: 'flex',
                          justifyContent: 'space-between',
                          cursor: isDragging ? 'grabbing' : 'grab',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (wasDraggingRef.current) {
                            wasDraggingRef.current = false;
                            return;
                          }
                          onNavigate(itemId, it?.name || itemId);
                        }}
                      >
                        <span>{it ? it.name : itemId}</span>
                        <span style={{ color: '#888' }}>
                          V:{it?.size ?? 0} | {itWeight}kg
                        </span>
                      </button>
                      {!isReadOnly && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          style={{
                            backgroundColor: '#c0392b',
                            color: '#fff',
                            padding: '0 8px',
                          }}
                          title="Удалить предмет из мира"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (app) {
                              app.deleteItemFromEquipmentArea(containerId, area.id, itemId);
                              onCommit(t('history.deleteObjects'));
                            }
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  );
                })
              ) : (
                <span style={{ color: '#777', fontSize: '11px' }}>{t('inspector.areaFree')}</span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
