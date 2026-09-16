import React from 'react';
import { World } from '../../ecs/World';
import { GameApp } from '../../GameApp';
import { STANDARD_EQUIPMENT_AREA_TYPES, EQUIPMENT_AREA_TYPE_LABELS } from '../../ecs/types';
import { getAnatomyParts, calculateTotalEntityWeight } from '../../ecs/utils/hierarchy';
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

        return (
          <div
            key={`area_${area.id || idx}`}
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
                {!isReadOnly && !isFromPart && (
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
                    title="Удалить слот"
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
              Тип слота:
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
                    <button
                      key={itemId}
                      type="button"
                      className="btn btn-sm"
                      style={{
                        width: '100%',
                        backgroundColor: '#1e3d29',
                        color: '#ecf0f1',
                        textAlign: 'left',
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                      onClick={() => onNavigate(itemId, it?.name || itemId)}
                    >
                      <span>{it ? it.name : itemId}</span>
                      <span style={{ color: '#888' }}>
                        V:{it?.size ?? 0} | {itWeight}kg
                      </span>
                    </button>
                  );
                })
              ) : (
                <span style={{ color: '#777', fontSize: '11px' }}>{t('inspector.slotFree')}</span>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
};
