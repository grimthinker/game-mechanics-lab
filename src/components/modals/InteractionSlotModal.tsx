import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';

export interface InteractionSlotModalProps {
  isOpen: boolean;
  creatureId: string | null;
  slotId: string | null;
  world: World | null | undefined;
  isReadOnly?: boolean;
  onClose: () => void;
  onBeforeSave?: () => void;
  onInspectItem: (itemId: string) => void;
  onConfirm?: () => void;
}

export const InteractionSlotModal: React.FC<InteractionSlotModalProps> = ({
  isOpen,
  creatureId,
  slotId,
  world,
  isReadOnly,
  onClose,
  onBeforeSave,
  onInspectItem,
  onConfirm,
}) => {
  const [interactDist, setInteractDist] = useState<number>(15);
  const [strength, setStrength] = useState<number>(50);

  useEffect(() => {
    if (!isOpen || !creatureId || !slotId || !world) return;
    const equip = world.getComponent(creatureId, 'equip');
    const slot = equip?.interactionSlots.find((s) => s.id === slotId);
    if (slot) {
      setInteractDist(slot.interactDist);
      setStrength(slot.strength);
    }
  }, [isOpen, creatureId, slotId, world]);

  if (!isOpen || !creatureId || !slotId || !world) return null;

  const equip = world.getComponent(creatureId, 'equip');
  const slot = equip?.interactionSlots.find((s) => s.id === slotId);
  if (!slot) return null;

  const item = slot.itemId ? world.getComponent(slot.itemId, 'item') : null;
  const itemPhys = slot.itemId ? world.getComponent(slot.itemId, 'physicsStats') : null;

  const handleSave = () => {
    if (onBeforeSave) onBeforeSave();
    slot.interactDist = Math.max(1, interactDist);
    slot.strength = Math.max(1, strength);
    if (onConfirm) onConfirm();
    onClose();
  };

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>Ячейка взаимодействия: {slot.id}</h3>
        <p className="modal-subtitle">Существо: {creatureId}</p>

        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Дальность взаимодействия (interactDist, px):
            <input
              disabled={isReadOnly}
              type="number"
              value={interactDist}
              min={1}
              max={500}
              step={1}
              onChange={(e) => setInteractDist(Number(e.target.value))}
            />
          </label>

          <label>
            Сила ячейки (strength):
            <input
              disabled={isReadOnly}
              type="number"
              value={strength}
              min={1}
              max={500}
              step={1}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
          </label>
        </form>

        <div style={{ marginTop: '16px', borderTop: '1px solid #333', paddingTop: '12px' }}>
          <h4 style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '8px' }}>
            Предмет в ячейке:
          </h4>
          {slot.itemId && item ? (
            <div
              onClick={() => onInspectItem(slot.itemId!)}
              style={{
                backgroundColor: '#1e1e1e',
                border: '1px solid #3498db',
                padding: '10px 12px',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                transition: 'background 0.2s',
              }}
              title="Нажмите для редактирования параметров предмета"
            >
              <div>
                <div style={{ fontWeight: 'bold', color: '#fff' }}>{item.name}</div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  Тип: {item.type} | Масса: {itemPhys?.weight.current ?? 1} | Размер: {item.size}
                </div>
              </div>
              <span style={{ color: '#3498db', fontSize: '12px' }}>✏️ Настроить</span>
            </div>
          ) : (
            <div style={{ color: '#777', fontStyle: 'italic', padding: '6px 0', fontSize: '13px' }}>
              Ячейка пуста (нет предмета)
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
