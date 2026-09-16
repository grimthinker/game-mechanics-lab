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
                    marginBottom: '8px',
                  }}
                >
                  <span style={{ fontWeight: 'bold', color: '#3498db' }}>{slot.id}</span>
                  <span style={{ fontSize: '11px', color: '#888' }}>
                    ({partMeta?.name || info.partId})
                  </span>
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

  if (interactionSlotsComp) {
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
        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#3498db' }}>{slot.id}</div>
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
  }

  return null;
};
