import React, { useState, useEffect } from 'react';
import { ItemData, STANDARD_RADII } from '../../ecs/types';
import { WeaponFormFields, ArmorFormFields, BagFormFields } from './forms/FormFields';

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
        setFormValues({
          name: item.name,
          weight: cfg.invWeight ?? 1,
          baseDamage: cfg.baseDamage,
          prepTime: cfg.prepTime,
          recoveryTime: cfg.recoveryTime,
          range: cfg.zone.length ?? cfg.zone.range ?? 0,
          radius: cfg.zone.radius ?? cfg.zone.offsetDistance ?? 0,
          numLines: cfg.zone.rayCount ?? cfg.zone.numLines ?? cfg.zone.lines ?? 1,
          angle: cfg.zone.angle !== undefined ? Math.round((cfg.zone.angle * 180) / Math.PI) : 0,
          pierceObstacles: !!cfg.zone.pierceObstacles,
          piercePlayers: !!cfg.zone.piercePlayers,
          pierceBots: !!cfg.zone.pierceBots,
          hitZoneType: cfg.zone.hitZoneType,
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

      if (cfg.zone.length !== undefined || cfg.zone.range !== undefined) {
        if (cfg.zone.length !== undefined) cfg.zone.length = formValues.range;
        if (cfg.zone.range !== undefined) cfg.zone.range = formValues.range;
      }
      if (cfg.zone.radius !== undefined) {
        cfg.zone.radius = formValues.radius;
      } else if (cfg.zone.offsetDistance !== undefined && cfg.zone.hitZoneType === 'offset_radius') {
        cfg.zone.radius = formValues.radius;
      }
      if (cfg.zone.rayCount !== undefined) cfg.zone.rayCount = formValues.numLines;
      if (cfg.zone.numLines !== undefined) cfg.zone.numLines = formValues.numLines;
      if (cfg.zone.lines !== undefined) cfg.zone.lines = formValues.numLines;
      if (cfg.zone.angle !== undefined) cfg.zone.angle = (formValues.angle * Math.PI) / 180;

      cfg.zone.pierceObstacles = formValues.pierceObstacles;
      cfg.zone.piercePlayers = formValues.piercePlayers;
      cfg.zone.pierceBots = formValues.pierceBots;
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
    <div className="modal" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>{isReadOnly ? 'Параметры предмета' : 'Изменить параметры предмета'}</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <div style={{ marginBottom: '12px' }}>
            <span style={{ fontWeight: 'bold', marginRight: '8px' }}>Тип предмета:</span>
            <span style={{ backgroundColor: '#2980b9', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#fff' }}>
              {getTypeName()}
            </span>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: isReadOnly ? 'default' : 'pointer', margin: '8px 0' }}>
            <input
              type="checkbox"
              disabled={isReadOnly}
              checked={isSolid}
              onChange={(e) => setDraft({ ...draft, config: { ...draft.config, isSolid: e.target.checked } } as any)}
            />
            Участвует в коллизии
          </label>

          {isSolid && (
            <label>
              Радиус тела:
              <select
                disabled={isReadOnly}
                value={radius}
                onChange={(e) => setDraft({ ...draft, config: { ...draft.config, radius: Number(e.target.value) } } as any)}
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
              <WeaponFormFields isReadOnly={isReadOnly} values={formValues} onChange={(v) => setFormValues({ ...formValues, ...v })} />
            )}
            {item.type === 'armor' && (
              <ArmorFormFields isReadOnly={isReadOnly} values={formValues} onChange={(v) => setFormValues({ ...formValues, ...v })} />
            )}
            {item.type === 'bag' && (
              <BagFormFields isReadOnly={isReadOnly} isBagInventoryEmpty={isBagInventoryEmpty} values={formValues} onChange={(v) => setFormValues({ ...formValues, ...v })} />
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
              {(inventorySlots || Array.from({ length: formValues.height || 4 }, () => Array.from({ length: formValues.width || 6 }, () => ({ item: null, count: 0 })))).map((row, rIdx) =>
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