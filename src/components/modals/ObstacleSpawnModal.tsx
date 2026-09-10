import React, { useState } from 'react';
import { EntityConfig } from '../../ecs/types';
import {
  deg2Rad,
  createRectanglePoints,
  isConvexPolygon,
  calculateBoundingRadius,
} from '../../utils';

export interface ObstacleSpawnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: EntityConfig) => void;
}

export const ObstacleSpawnModal: React.FC<ObstacleSpawnModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
}) => {
  const [name, setName] = useState<string>('Препятствие');
  const [destructible, setDestructible] = useState<boolean>(false);
  const [hp, setHp] = useState<number>(100);
  const [maxHp, setMaxHp] = useState<number>(100);
  const [width, setWidth] = useState<number>(100);
  const [height, setHeight] = useState<number>(40);
  const [angleDeg, setAngleDeg] = useState<number>(0);

  if (!isOpen) return null;

  const handleConfirm = () => {
    const points = createRectanglePoints(Math.max(10, width), Math.max(10, height));

    if (!isConvexPolygon(points)) {
      alert('Ошибка: созданный полигон не является выпуклым!');
      return;
    }

    const boundingRadius = calculateBoundingRadius(points);

    const config: EntityConfig = {
      tag: { archetype: 'obstacle' },
      meta: {
        name: name.trim() || 'Препятствие',
        entityType: 'obstacle',
        destructible,
      },
      health: {
        hp: destructible ? Math.min(hp, maxHp) : maxHp,
        maxHp: Math.max(1, maxHp),
      },
      transform: {
        x: 0,
        y: 0,
        angle: deg2Rad(angleDeg),
      },
      physics: {
        radius: boundingRadius,
        weight: 1000,
        isSolid: true,
        points,
      },
    };

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
        <h3>Параметры нового препятствия</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Название:
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

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
              checked={destructible}
              onChange={(e) => setDestructible(e.target.checked)}
            />
            Разрушаемое препятствие
          </label>

          {destructible && (
            <>
              <label>
                Макс. здоровье (HP):
                <input
                  type="number"
                  value={maxHp}
                  min={1}
                  max={10000}
                  step={10}
                  onChange={(e) => setMaxHp(Number(e.target.value))}
                />
              </label>
              <label>
                Текущее здоровье (HP):
                <input
                  type="number"
                  value={hp}
                  min={1}
                  max={maxHp}
                  step={10}
                  onChange={(e) => setHp(Number(e.target.value))}
                />
              </label>
            </>
          )}

          <label>
            Ширина (px):
            <input
              type="number"
              value={width}
              min={10}
              max={2000}
              step={10}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </label>

          <label>
            Высота (px):
            <input
              type="number"
              value={height}
              min={10}
              max={2000}
              step={10}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </label>

          <label>
            Угол поворота (°):
            <input
              type="number"
              value={angleDeg}
              min={-360}
              max={360}
              step={15}
              onChange={(e) => setAngleDeg(Number(e.target.value))}
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
