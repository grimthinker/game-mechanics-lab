import React, { useState } from 'react';
import { EntityConfig, ZoneEffectType } from '../../ecs/types';
import { createZoneConfig } from '../../ecs/archetypes/ZoneArchetype';

export interface ZoneSpawnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: EntityConfig) => void;
}

export const ZoneSpawnModal: React.FC<ZoneSpawnModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [effect, setEffect] = useState<ZoneEffectType>('damage');
  const [radius, setRadius] = useState<number>(70);
  const [valuePerSec, setValuePerSec] = useState<number>(15);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const config = createZoneConfig(effect, radius, valuePerSec);
    onConfirm(config);
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
        <h3>Параметры новой зоны</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Тип эффекта зоны:
            <select value={effect} onChange={(e) => setEffect(e.target.value as ZoneEffectType)}>
              <option value="damage">Урон (Огонь / Лава / Яд)</option>
              <option value="heal">Лечение (Источник жизни)</option>
            </select>
          </label>

          <label>
            Сила эффекта (HP / сек):
            <input
              type="number"
              value={valuePerSec}
              min={1}
              max={500}
              step={1}
              onChange={(e) => setValuePerSec(Number(e.target.value))}
            />
          </label>

          <label>
            Радиус зоны (px):
            <input
              type="number"
              value={radius}
              min={20}
              max={1000}
              step={10}
              onChange={(e) => setRadius(Number(e.target.value))}
            />
          </label>
        </form>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn btn-primary" onClick={handleConfirm}>
            Выбрать место
          </button>
        </div>
      </div>
    </div>
  );
};
