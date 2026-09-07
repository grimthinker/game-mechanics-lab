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
  const [distanceAttenuation, setDistanceAttenuation] = useState<boolean>(false);
  const [centerValue, setCenterValue] = useState<number>(150);
  const [boundaryValue, setBoundaryValue] = useState<number>(30);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const config = createZoneConfig(
      effect,
      radius,
      valuePerSec,
      undefined,
      true,
      false,
      true,
      distanceAttenuation,
      centerValue,
      boundaryValue
    );
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
              <option value="repel">Отталкивание (Силовое поле)</option>
              <option value="attract">Притягивание (Воронка / Гравитация)</option>
            </select>
          </label>

          <label>
            Сила эффекта:
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

          {(effect === 'repel' || effect === 'attract') && (
            <>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  margin: '8px 0',
                }}
              >
                <input
                  type="checkbox"
                  checked={distanceAttenuation}
                  onChange={(e) => setDistanceAttenuation(e.target.checked)}
                />
                Зависимость силы от расстояния (Линейная)
              </label>

              {distanceAttenuation && (
                <>
                  <label>
                    Сила в центре:
                    <input
                      type="number"
                      value={centerValue}
                      min={1}
                      max={2000}
                      step={10}
                      onChange={(e) => setCenterValue(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Сила на границе:
                    <input
                      type="number"
                      value={boundaryValue}
                      min={0}
                      max={2000}
                      step={10}
                      onChange={(e) => setBoundaryValue(Number(e.target.value))}
                    />
                  </label>
                </>
              )}
            </>
          )}
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
