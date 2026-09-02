import React, { useState, useEffect } from 'react';
import { ItemData, STANDARD_RADII, HitZoneType, HitZoneConfig } from '../../ecs/types';
import { WeaponFormFields, ArmorFormFields, BagFormFields, WeaponFormValues } from './forms/FormFields';
import { lastAddedWeaponConfigState, DEFAULT_ZONE_PARAMS } from '../../Weapon';

export interface ItemEditModalProps {
  item: ItemData | null;
  isReadOnly?: boolean;
  isBagInventoryEmpty?: boolean;
  onItemClick?: (item: ItemData) => void;
  inventorySlots?: { item: ItemData | null; count: number }[][];
  inventorySize?: { width: number; height: number };
  onClose: () => void;
  onConfirm: (updatedItem: ItemData) => void;
}

export const ItemEditModal: React.FC<ItemEditModalProps> = ({
  item,
  isReadOnly,
  isBagInventoryEmpty = true,
  onItemClick,
  inventorySlots,
  inventorySize,
  onClose,
  onConfirm,
}) => {
  const [draft, setDraft] = useState<ItemData | null>(null);
  const [formValues, setFormValues] = useState<any>({});

  useEffect(() => {
    if (item) {
      setDraft(JSON.parse(JSON.stringify(item)));
      const cfg = item.config as any;
      if (item.type === 'weapon') {
        const zType = (cfg.zone.hitZoneType === 'line' ? 'forward_line' : cfg.zone.hitZoneType) as HitZoneType;
        setFormValues({
          name: item.name,
          weight: cfg.invWeight ?? 1,
          baseDamage: cfg.baseDamage,
          prepTime: cfg.prepTime,
          recoveryTime: cfg.recoveryTime,
          range: cfg.zone.length ?? cfg.zone.range ?? 150,
          radius: cfg.zone.radius ?? 50,
          numLines: cfg.zone.rayCount ?? cfg.zone.numLines ?? cfg.zone.lines ?? 5,
          angle: cfg.zone.angle !== undefined ? Math.round((cfg.zone.angle * 180) / Math.PI) : 30,
          pierceObstacles: !!cfg.zone.pierceObstacles,
          piercePlayers: !!cfg.zone.piercePlayers,
          pierceBots: !!cfg.zone.pierceBots,
          hitZoneType: zType,
        });
      } else if (item.type === 'armor') {
        setFormValues({
          name: item.name,
          defense: cfg.defense,
          flatReduction: cfg.flat_reduction,
          weight: cfg.invWeight ?? 1,
        });
      } else if (item.type === 'bag') {
        setFormValues({
          name: item.name,
          width: cfg.size?.width ?? 6,
          height: cfg.size?.height ?? 4,
          weight: cfg.invWeight ?? 1,
        });
      }
    } else {
      setDraft(null);
    }
  }, [item]);

  if (!item || !draft) return null;

  const handleZoneTypeChange = (newType: HitZoneType) => {
    const currentValues = formValues as WeaponFormValues;

    // Сохраняем текущие специфические параметры
    lastAddedWeaponConfigState.zoneParamsMap[currentValues.hitZoneType] = {
      range: currentValues.range,
      radius: currentValues.radius,
      numLines: currentValues.numLines,
      angle: currentValues.angle,
      pierceObstacles: currentValues.pierceObstacles,
      piercePlayers: currentValues.piercePlayers,
      pierceBots: currentValues.pierceBots,
    };

    // Получаем сохраненные или дефолтные параметры для нового типа
    const nextParams =
      lastAddedWeaponConfigState.zoneParamsMap[newType] || DEFAULT_ZONE_PARAMS[newType];

    setFormValues({
      ...currentValues,
      hitZoneType: newType,
      range: nextParams.range,
      radius: nextParams.radius,
      numLines: nextParams.numLines,
      angle: nextParams.angle,
      pierceObstacles: nextParams.pierceObstacles,
      piercePlayers: nextParams.piercePlayers,
      pierceBots: nextParams.pierceBots,
    });
  };

  const handleConfirm = () => {
    const updated = { ...draft };
    const cfg = updated.config as any;
    cfg.name = formValues.name;
    updated.name = formValues.name;
    cfg.invWeight = formValues.weight;

    if (item.type === 'weapon') {
      cfg.baseDamage = formValues.baseDamage;
      cfg.prepTime = formValues.prepTime;
      cfg.recoveryTime = formValues.recoveryTime;

      const zoneType: HitZoneType = formValues.hitZoneType;
      let newZone: HitZoneConfig;

      if (zoneType === 'radius') {
        newZone = {
          hitZoneType: 'radius',
          radius: formValues.radius,
        };
      } else if (zoneType === 'angle') {
        newZone = {
          hitZoneType: 'angle',
          length: formValues.range,
          angle: (formValues.angle * Math.PI) / 180,
        };
      } else if (zoneType === 'forward_line') {
        newZone = {
          hitZoneType: 'forward_line',
          length: formValues.range,
          pierceObstacles: formValues.pierceObstacles,
          piercePlayers: formValues.piercePlayers,
          pierceBots: formValues.pierceBots,
        };
      } else {
        newZone = {
          hitZoneType: 'shrapnel',
          length: formValues.range,
          angle: (formValues.angle * Math.PI) / 180,
          rayCount: formValues.numLines,
          pierceObstacles: formValues.pierceObstacles,
          piercePlayers: formValues.piercePlayers,
          pierceBots: formValues.pierceBots,
        };
      }

      cfg.zone = newZone;

      // Обновляем глобальное состояние последнего добавленного оружия
      lastAddedWeaponConfigState.config = JSON.parse(JSON.stringify(cfg));
      lastAddedWeaponConfigState.zoneParamsMap[zoneType] = {
        range: formValues.range,
        radius: formValues.radius,
        numLines: formValues.numLines,
        angle: formValues.angle,
        pierceObstacles: formValues.pierceObstacles,
        piercePlayers: formValues.piercePlayers,
        pierceBots: formValues.pierceBots,
      };
    } else if (item.type === 'armor') {
      cfg.defense = formValues.defense;
      cfg.flat_reduction = formValues.flatReduction;
    } else if (item.type === 'bag') {
      cfg.size = { width: formValues.width, height: formValues.height };
    }

    onConfirm(updated);
  };

  const getTypeName = () => {
    if (item.type === 'weapon') return 'Оружие';
    if (item.type === 'armor') return 'Броня';
    if (item.type === 'bag') return 'Сумка';
    return item.type;
  };

  const isSolid = draft.config?.isSolid ?? true;
  const radius = draft.config?.radius ?? 16;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>{isReadOnly ? 'Параметры предмета' : 'Изменить параметры предмета'}</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontWeight: 'bold', marginRight: '8px' }}>Тип предмета:</span>
            <span
              style={{
                backgroundColor: '#2980b9',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#fff',
              }}
            >
              {getTypeName()}
            </span>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: isReadOnly ? 'default' : 'pointer',
              margin: '8px 0',
            }}
          >
            <input
              type="checkbox"
              disabled={isReadOnly}
              checked={isSolid}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  config: { ...draft.config, isSolid: e.target.checked },
                } as any)
              }
            />
            Участвует в коллизии
          </label>

          {isSolid && (
            <label>
              Радиус тела:
              <select
                disabled={isReadOnly}
                value={radius}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    config: { ...draft.config, radius: Number(e.target.value) },
                  } as any)
                }
              >
                {STANDARD_RADII.map((r) => (
                  <option key={r} value={r}>
                    {r} px
                  </option>
                ))}
              </select>
            </label>
          )}

          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #333' }}>
            {item.type === 'weapon' && (
              <WeaponFormFields
                isReadOnly={isReadOnly}
                values={formValues}
                onChange={(v) => setFormValues({ ...formValues, ...v })}
                onZoneTypeChange={handleZoneTypeChange}
              />
            )}
            {item.type === 'armor' && (
              <ArmorFormFields
                isReadOnly={isReadOnly}
                values={formValues}
                onChange={(v) => setFormValues({ ...formValues, ...v })}
              />
            )}
            {item.type === 'bag' && (
              <BagFormFields
                isReadOnly={isReadOnly}
                isBagInventoryEmpty={isBagInventoryEmpty}
                values={formValues}
                onChange={(v) => setFormValues({ ...formValues, ...v })}
              />
            )}
          </div>
        </form>

        {item.type === 'bag' && onItemClick && (
          <div style={{ marginTop: '12px' }}>
            <h4 style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '8px' }}>
              Инвентарь сумки (нажмите на предмет для настройки):
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${inventorySize?.width || formValues.width || 6}, 38px)`,
                gap: '4px',
                justifyContent: 'center',
                backgroundColor: '#111',
                padding: '10px',
                borderRadius: '6px',
                border: '1px solid #333',
                maxHeight: '260px',
                overflowY: 'auto',
              }}
            >
              {(
                inventorySlots ||
                Array.from({ length: formValues.height || 4 }, () =>
                  Array.from({ length: formValues.width || 6 }, () => ({ item: null, count: 0 }))
                )
              ).map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const it = cell.item;
                  return (
                    <div
                      key={`${rIdx}_${cIdx}`}
                      onClick={() => {
                        if (it) onItemClick(it);
                      }}
                      title={it ? `${it.name} (${it.type})` : 'Пустая ячейка'}
                      style={{
                        width: '38px',
                        height: '38px',
                        backgroundColor: it ? '#2980b9' : '#222',
                        border: '1px solid #444',
                        borderRadius: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: it ? 'pointer' : 'default',
                        fontSize: '10px',
                        color: '#fff',
                        textAlign: 'center',
                        padding: '2px',
                        overflow: 'hidden',
                        userSelect: 'none',
                      }}
                    >
                      {it ? it.name.substring(0, 5) : ''}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="btn" onClick={onClose}>
            {isReadOnly ? 'Закрыть' : 'Отмена'}
          </button>
          {!isReadOnly && (
            <button type="button" className="btn btn-primary" onClick={handleConfirm}>
              Применить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};