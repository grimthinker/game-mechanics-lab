
import React from 'react';
import { InventoryConfig, ItemData } from '../../ecs/types';

export interface BagEditModalProps {
  selectedBagForEdit: InventoryConfig | null;
  isReadOnly?: boolean;
  editBagName: string;
  setEditBagName: (val: string) => void;
  editBagWidth: number;
  setEditBagWidth: (val: number) => void;
  editBagHeight: number;
  setEditBagHeight: (val: number) => void;
  editBagWeight: number;
  setEditBagWeight: (val: number) => void;
  isBagInventoryEmpty: boolean;
  inventorySlots?: { item: ItemData | null; count: number }[][];
  inventorySize?: { width: number; height: number };
  onItemClick: (item: ItemData) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const BagEditModal: React.FC<BagEditModalProps> = ({
  selectedBagForEdit,
  isReadOnly,
  editBagName,
  setEditBagName,
  editBagWidth,
  setEditBagWidth,
  editBagHeight,
  setEditBagHeight,
  editBagWeight,
  setEditBagWeight,
  isBagInventoryEmpty,
  inventorySlots,
  inventorySize,
  onItemClick,
  onClose,
  onConfirm,
}) => {
  if (!selectedBagForEdit) return null;

  const currentSlots =
    inventorySlots ||
    Array.from({ length: editBagHeight }, () =>
      Array.from({ length: editBagWidth }, () => ({ item: null, count: 0 }))
    );

  const gridWidth = inventorySize?.width || editBagWidth;

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>{isReadOnly ? 'Параметры сумки' : 'Изменить параметры сумки'}</h3>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <label>
            Название:
            <input
              disabled={isReadOnly}
              type="text"
              value={editBagName}
              onChange={(e) => setEditBagName(e.target.value)}
            />
          </label>
          <label>
            Ширина инвентаря (ячейки):
            <input
              disabled={!isBagInventoryEmpty || isReadOnly}
              type="number"
              value={editBagWidth}
              min={1}
              max={12}
              onChange={(e) => setEditBagWidth(Number(e.target.value))}
            />
          </label>
          <label>
            Высота инвентаря (ячейки):
            <input
              disabled={!isBagInventoryEmpty || isReadOnly}
              type="number"
              value={editBagHeight}
              min={1}
              max={12}
              onChange={(e) => setEditBagHeight(Number(e.target.value))}
            />
          </label>
          {!isBagInventoryEmpty && !isReadOnly && (
            <p style={{ fontSize: '12px', color: '#e74c3c', margin: '4px 0' }}>
              Размер инвентаря можно изменить только когда сумка пуста
            </p>
          )}
          <label>
            Вес:
            <input
              disabled={isReadOnly}
              type="number"
              value={editBagWeight}
              min={0}
              max={100}
              onChange={(e) => setEditBagWeight(Number(e.target.value))}
            />
          </label>
        </form>

        <div style={{ marginTop: '12px' }}>
          <h4 style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '8px' }}>
            Инвентарь сумки (нажмите на предмет для настройки):
          </h4>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${gridWidth}, 38px)`,
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
            {currentSlots.map((row, rIdx) =>
              row.map((cell, cIdx) => {
                const item = cell.item;
                return (
                  <div
                    key={`${rIdx}_${cIdx}`}
                    onClick={() => {
                      if (item) onItemClick(item);
                    }}
                    title={item ? `${item.name} (${item.type})` : 'Пустая ячейка'}
                    style={{
                      width: '38px',
                      height: '38px',
                      backgroundColor: item ? '#2980b9' : '#222',
                      border: '1px solid #444',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: item ? 'pointer' : 'default',
                      fontSize: '10px',
                      color: '#fff',
                      textAlign: 'center',
                      padding: '2px',
                      overflow: 'hidden',
                      userSelect: 'none',
                    }}
                  >
                    {item ? item.name.substring(0, 5) : ''}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <button type="button" className="btn" onClick={onClose}>
            {isReadOnly ? 'Закрыть' : 'Отмена'}
          </button>
          {!isReadOnly && (
            <button type="button" className="btn btn-primary" onClick={onConfirm}>
              Применить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
