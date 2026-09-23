import React, { useRef } from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { getAggregatedInteractionSlots } from '../../ecs/utils/hierarchy';
import { useDragDrop } from '../../dnd/DragDropContext';
import { findItemLocation } from '../../ecs/utils/itemValidation';
import { t } from '../../locales';

export interface InteractionSlotsInspectorProps {
  targetId: string;
  world: World;
  app?: GameApp | null;
  isReadOnly?: boolean;
  onCommit: (desc: string) => void;
  onNavigate: (id: string, label: string) => void;
}

export const InteractionSlotsInspector: React.FC<InteractionSlotsInspectorProps> = ({
  targetId,
  world,
  app,
  isReadOnly,
  onCommit,
  onNavigate,
}) => {
  const { isDragging, startDrag, setHoverTarget, hoverTarget, isValidTarget, isSwap } =
    useDragDrop();
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
  const interactionSlotsComp = world.getComponent(targetId, 'interactionSlots');

  if (currentArchetype === 'creature') {
    const slots = getAggregatedInteractionSlots(world, targetId);
    return (
      <>
        {slots.length > 0 ? (
          slots.map((info) => {
            const slot = info.slot;
            const slotItem = slot.itemId ? world.getComponent(slot.itemId, 'item') : null;
            const partMeta = world.getComponent(info.partId, 'meta');

            const isHoveredTarget =
              isDragging && hoverTarget?.type === 'slot' && hoverTarget.partId === info.partId;
            let bgColor = '#181818';
            let borderColor = '#333';
            if (isHoveredTarget) {
              if (isValidTarget && isSwap) {
                bgColor = '#154360';
                borderColor = '#3498db';
              } else if (isValidTarget) {
                bgColor = '#1e8449';
                borderColor = '#2ecc71';
              } else {
                bgColor = '#641e16';
                borderColor = '#e74c3c';
              }
            }

            return (
              <div
                key={`slot_${info.partId}_${slot.id}`}
                onPointerEnter={() => {
                  if (isDragging && !isReadOnly)
                    setHoverTarget({ type: 'slot', partId: info.partId });
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
                    marginBottom: '8px',
                  }}
                >
                  <input
                    disabled={isReadOnly}
                    type="text"
                    key={`slot_name_${info.partId}_${slot.id}`}
                    defaultValue={slot.name || slot.id}
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
                        app.updateEntityInteractionSlot(info.partId, { name: e.target.value });
                        onCommit(t('history.slotConfigure'));
                      }
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '11px', color: '#888' }}>
                      ({partMeta?.name || info.partId})
                    </span>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          if (slot.itemId !== null) {
                            alert(t('inspector.slotRemoveWarn'));
                            return;
                          }
                          if (app) {
                            app.mutations.removeEntityInteractionSlot(info.partId);
                            onCommit(t('history.slotRemove'));
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
                        title={t('common.delete')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
                <label
                  style={{
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  Дальность:
                  <input
                    type="number"
                    disabled={isReadOnly}
                    key={`slot_dist_${info.partId}_${slot.id}`}
                    defaultValue={slot.interactDist}
                    min={0}
                    step={0.01}
                    style={{ width: '70px', padding: '2px' }}
                    onChange={(e) => {
                      if (app) {
                        app.updateEntityInteractionSlot(info.partId, {
                          interactDist: Math.max(0, +e.target.value),
                        });
                        onCommit(t('history.slotConfigure'));
                      }
                    }}
                  />
                </label>
                <label
                  style={{
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                  }}
                >
                  Сила (кг):
                  <input
                    type="number"
                    disabled={isReadOnly}
                    key={`slot_str_${info.partId}_${slot.id}`}
                    defaultValue={slot.strength}
                    min={0}
                    step={0.01}
                    style={{ width: '70px', padding: '2px' }}
                    onChange={(e) => {
                      if (app) {
                        app.updateEntityInteractionSlot(info.partId, {
                          strength: Math.max(0, +e.target.value),
                        });
                        onCommit(t('history.slotConfigure'));
                      }
                    }}
                  />
                </label>
                <label
                  style={{
                    fontSize: '11px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '4px',
                  }}
                >
                  Анимация (slotKind):
                  <select
                    disabled={isReadOnly}
                    key={`slot_kind_${info.partId}_${slot.id}`}
                    defaultValue={slot.slotKind ?? 'left_hand'}
                    style={{
                      width: '110px',
                      padding: '2px',
                      backgroundColor: '#111',
                      color: '#fff',
                      border: '1px solid #444',
                      borderRadius: '3px',
                    }}
                    onChange={(e) => {
                      if (app) {
                        app.updateEntityInteractionSlot(info.partId, {
                          slotKind: e.target.value,
                        });
                        onCommit(t('history.slotConfigure'));
                      }
                    }}
                  >
                    <option value="left_hand">Левая рука</option>
                    <option value="right_hand">Правая рука</option>
                    <option value="jaws">Пасть (Челюсти)</option>
                  </select>
                </label>
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #2a2a2a',
                  }}
                >
                  {slotItem ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onPointerDown={handlePointerDown}
                        onPointerMove={(e) => handlePointerMove(e, slot.itemId!)}
                        onPointerUp={handlePointerUp}
                        style={{
                          flex: 1,
                          backgroundColor: '#2c3e50',
                          color: '#ecf0f1',
                          cursor: isDragging ? 'grabbing' : 'grab',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (wasDraggingRef.current) {
                            wasDraggingRef.current = false;
                            return;
                          }
                          onNavigate(slot.itemId!, slotItem.name);
                        }}
                      >
                        Настроить: {slotItem.name}
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
                              app.deleteItemFromInteractionSlot(info.partId);
                              onCommit(t('history.deleteObjects'));
                            }
                          }}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  ) : (
                    <span style={{ color: '#777', fontSize: '12px' }}>{t('common.empty')}</span>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ color: '#777', fontSize: '11px', fontStyle: 'italic' }}>
            {t('inspector.noHands')}
          </div>
        )}
      </>
    );
  }

  if (!interactionSlotsComp) {
    return (
      <div style={{ color: '#777', fontSize: '11px', fontStyle: 'italic' }}>
        {t('inspector.noInteractionSlot')}
      </div>
    );
  }

  const slot = interactionSlotsComp;
  const slotItem = slot.itemId ? world.getComponent(slot.itemId, 'item') : null;

  const isHoveredTarget =
    isDragging && hoverTarget?.type === 'slot' && hoverTarget.partId === targetId;
  let bgColor = '#181818';
  let borderColor = '#333';
  if (isHoveredTarget) {
    if (isValidTarget && isSwap) {
      bgColor = '#154360';
      borderColor = '#3498db';
    } else if (isValidTarget) {
      bgColor = '#1e8449';
      borderColor = '#2ecc71';
    } else {
      bgColor = '#641e16';
      borderColor = '#e74c3c';
    }
  }

  return (
    <div
      key={`slot_${slot.id}`}
      onPointerEnter={() => {
        if (isDragging && !isReadOnly) setHoverTarget({ type: 'slot', partId: targetId });
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
          marginBottom: '8px',
        }}
      >
        <input
          disabled={isReadOnly}
          type="text"
          key={`single_slot_name_${targetId}_${slot.id}`}
          defaultValue={slot.name || slot.id}
          style={{
            width: '50%',
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
              app.updateEntityInteractionSlot(targetId, { name: e.target.value });
              onCommit(t('history.slotConfigure'));
            }
          }}
        />
        {!isReadOnly && (
          <button
            type="button"
            onClick={() => {
              if (slot.itemId !== null) {
                alert(t('inspector.slotRemoveWarn'));
                return;
              }
              if (app) {
                app.mutations.removeEntityInteractionSlot(targetId);
                onCommit(t('history.slotRemove'));
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
            title={t('common.delete')}
          >
            ✕
          </button>
        )}
      </div>
      <label
        style={{
          fontSize: '11px',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        Дальность:
        <input
          type="number"
          disabled={isReadOnly}
          key={`single_slot_dist_${targetId}_${slot.id}`}
          defaultValue={slot.interactDist}
          min={0}
          step={0.01}
          style={{ width: '70px', padding: '2px' }}
          onChange={(e) => {
            if (app) {
              app.updateEntityInteractionSlot(targetId, {
                interactDist: Math.max(0, +e.target.value),
              });
              onCommit(t('history.slotConfigure'));
            }
          }}
        />
      </label>
      <label
        style={{
          fontSize: '11px',
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
        }}
      >
        Сила (кг):
        <input
          type="number"
          disabled={isReadOnly}
          key={`single_slot_str_${targetId}_${slot.id}`}
          defaultValue={slot.strength}
          min={0}
          step={0.01}
          style={{ width: '70px', padding: '2px' }}
          onChange={(e) => {
            if (app) {
              app.updateEntityInteractionSlot(targetId, {
                strength: Math.max(0, +e.target.value),
              });
              onCommit(t('history.slotConfigure'));
            }
          }}
        />
      </label>
      <label
        style={{
          fontSize: '11px',
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '4px',
        }}
      >
        Анимация (slotKind):
        <select
          disabled={isReadOnly}
          key={`single_slot_kind_${targetId}_${slot.id}`}
          defaultValue={slot.slotKind ?? 'left_hand'}
          style={{
            width: '110px',
            padding: '2px',
            backgroundColor: '#111',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '3px',
          }}
          onChange={(e) => {
            if (app) {
              app.updateEntityInteractionSlot(targetId, {
                slotKind: e.target.value,
              });
              onCommit(t('history.slotConfigure'));
            }
          }}
        >
          <option value="left_hand">Левая рука</option>
          <option value="right_hand">Правая рука</option>
          <option value="jaws">Пасть (Челюсти)</option>
        </select>
      </label>
      <div
        style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #2a2a2a',
        }}
      >
        {slotItem ? (
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              className="btn btn-sm"
              onPointerDown={handlePointerDown}
              onPointerMove={(e) => handlePointerMove(e, slot.itemId!)}
              onPointerUp={handlePointerUp}
              style={{
                flex: 1,
                backgroundColor: '#2c3e50',
                color: '#ecf0f1',
                cursor: isDragging ? 'grabbing' : 'grab',
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (wasDraggingRef.current) {
                  wasDraggingRef.current = false;
                  return;
                }
                onNavigate(slot.itemId!, slotItem.name);
              }}
            >
              Настроить: {slotItem.name}
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
                    app.deleteItemFromInteractionSlot(targetId);
                    onCommit(t('history.deleteObjects'));
                  }
                }}
              >
                🗑️
              </button>
            )}
          </div>
        ) : (
          <span style={{ color: '#777', fontSize: '12px' }}>{t('common.empty')}</span>
        )}
      </div>
    </div>
  );
};
