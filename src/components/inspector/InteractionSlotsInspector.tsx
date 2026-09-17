import React from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { getAggregatedInteractionSlots } from '../../ecs/utils/hierarchy';
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

            return (
              <div
                key={`slot_${info.partId}_${slot.id}`}
                style={{
                  marginBottom: '8px',
                  padding: '10px',
                  backgroundColor: '#181818',
                  borderRadius: '4px',
                  border: '1px solid #333',
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
                    style={{ width: '60px', padding: '2px' }}
                    onChange={(e) => {
                      if (app) {
                        app.updateEntityInteractionSlot(info.partId, {
                          interactDist: Math.max(1, +e.target.value),
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
                    style={{ width: '60px', padding: '2px' }}
                    onChange={(e) => {
                      if (app) {
                        app.updateEntityInteractionSlot(info.partId, {
                          strength: Math.max(1, +e.target.value),
                        });
                        onCommit(t('history.slotConfigure'));
                      }
                    }}
                  />
                </label>
                <div
                  style={{
                    marginTop: '8px',
                    paddingTop: '8px',
                    borderTop: '1px solid #2a2a2a',
                  }}
                >
                  {slotItem ? (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{
                        width: '100%',
                        backgroundColor: '#2c3e50',
                        color: '#ecf0f1',
                      }}
                      onClick={() => onNavigate(slot.itemId!, slotItem.name)}
                    >
                      Настроить: {slotItem.name}
                    </button>
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

  return (
    <div
      key={`slot_${slot.id}`}
      style={{
        marginBottom: '8px',
        padding: '10px',
        backgroundColor: '#181818',
        borderRadius: '4px',
        border: '1px solid #333',
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
          style={{ width: '60px', padding: '2px' }}
          onChange={(e) => {
            if (app) {
              app.updateEntityInteractionSlot(targetId, {
                interactDist: Math.max(1, +e.target.value),
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
          style={{ width: '60px', padding: '2px' }}
          onChange={(e) => {
            if (app) {
              app.updateEntityInteractionSlot(targetId, {
                strength: Math.max(1, +e.target.value),
              });
              onCommit(t('history.slotConfigure'));
            }
          }}
        />
      </label>
      <div
        style={{
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #2a2a2a',
        }}
      >
        {slotItem ? (
          <button
            type="button"
            className="btn btn-sm"
            style={{
              width: '100%',
              backgroundColor: '#2c3e50',
              color: '#ecf0f1',
            }}
            onClick={() => onNavigate(slot.itemId!, slotItem.name)}
          >
            Настроить: {slotItem.name}
          </button>
        ) : (
          <span style={{ color: '#777', fontSize: '12px' }}>{t('common.empty')}</span>
        )}
      </div>
    </div>
  );
};
