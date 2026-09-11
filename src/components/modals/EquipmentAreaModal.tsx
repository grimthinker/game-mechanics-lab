import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { STANDARD_EQUIPMENT_AREA_TYPES, EQUIPMENT_AREA_TYPE_LABELS } from '../../ecs/types';

export interface EquipmentAreaModalProps {
  isOpen: boolean;
  creatureId: string | null;
  areaId: string | null;
  world: World | null | undefined;
  isReadOnly?: boolean;
  onClose: () => void;
  onBeforeSave?: () => void;
  onInspectItem: (itemId: string) => void;
  onConfirm?: () => void;
}

export const EquipmentAreaModal: React.FC<EquipmentAreaModalProps> = ({
  isOpen,
  creatureId,
  areaId,
  world,
  isReadOnly,
  onClose,
  onBeforeSave,
  onInspectItem,
  onConfirm,
}) => {
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [space, setSpace] = useState<number>(10);

  useEffect(() => {
    if (!isOpen || !creatureId || !areaId || !world) return;
    const equip = world.getComponent(creatureId, 'equip');
    const area = equip?.equipmentAreas.find((a) => a.id === areaId);
    if (area) {
      setName(area.name);
      setType(area.type);
      setSpace(area.space);
    }
  }, [isOpen, creatureId, areaId, world]);

  if (!isOpen || !creatureId || !areaId || !world) return null;

  const equip = world.getComponent(creatureId, 'equip');
  const area = equip?.equipmentAreas.find((a) => a.id === areaId);
  if (!area) return null;

  let usedSpace = 0;
  const itemsList: Array<{ id: string; name: string; size: number; type: string }> = [];

  for (const itemId of area.itemIds) {
    const item = world.getComponent(itemId, 'item');
    if (item) {
      usedSpace += item.size;
      itemsList.push({ id: itemId, name: item.name, size: item.size, type: item.type });
    } else {
      itemsList.push({ id: itemId, name: itemId, size: 0, type: 'unknown' });
    }
  }

  const handleSave = () => {
    if (onBeforeSave) onBeforeSave();
    area.name = name.trim() || area.name;
    area.type = type.trim() || area.type;
    area.space = Math.max(1, space);
    if (onConfirm) onConfirm();
    onClose();
  };

  const isOverloaded = usedSpace > space;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>Область экипировки: {area.name}</h3>
        <p className="modal-subtitle">Существо: {creatureId}</p>

        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Название области:
            <input
              disabled={isReadOnly}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label>
            Тип области:
            <select disabled={isReadOnly} value={type} onChange={(e) => setType(e.target.value)}>
              {STANDARD_EQUIPMENT_AREA_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EQUIPMENT_AREA_TYPE_LABELS[t] || t}
                </option>
              ))}
              {!STANDARD_EQUIPMENT_AREA_TYPES.includes(type as any) && type && (
                <option value={type}>{type}</option>
              )}
            </select>
          </label>

          <label>
            Вмещаемый объём (space):
            <input
              disabled={isReadOnly}
              type="number"
              value={space}
              min={1}
              max={500}
              step={1}
              onChange={(e) => setSpace(Number(e.target.value))}
            />
          </label>
        </form>

        <div style={{ marginTop: '16px', borderTop: '1px solid #333', paddingTop: '12px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
            }}
          >
            <h4 style={{ fontSize: '13px', color: '#bdc3c7', margin: 0 }}>
              Экипированные предметы:
            </h4>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 'bold',
                color: isOverloaded ? '#e74c3c' : '#2ecc71',
              }}
            >
              Занято: {usedSpace} / {space}
            </span>
          </div>

          {itemsList.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '6px',
                maxHeight: '180px',
                overflowY: 'auto',
              }}
            >
              {itemsList.map((itm) => (
                <div
                  key={itm.id}
                  onClick={() => onInspectItem(itm.id)}
                  style={{
                    backgroundColor: '#1e1e1e',
                    border: '1px solid #444',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  title="Нажмите для редактирования параметров предмета"
                >
                  <div>
                    <div style={{ color: '#fff', fontSize: '13px' }}>{itm.name}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>
                      Размер: {itm.size} | Тип: {itm.type}
                    </div>
                  </div>
                  <span style={{ color: '#3498db', fontSize: '12px' }}>✏️ Настроить</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: '#777', fontStyle: 'italic', padding: '6px 0', fontSize: '13px' }}>
              В этой области нет предметов
            </div>
          )}
        </div>

        <div className="modal-actions" style={{ marginTop: '20px' }}>
          <button type="button" className="btn" onClick={onClose}>
            {isReadOnly ? 'Закрыть' : 'Отмена'}
          </button>
          {!isReadOnly && (
            <button type="button" className="btn btn-primary" onClick={handleSave}>
              Сохранить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
