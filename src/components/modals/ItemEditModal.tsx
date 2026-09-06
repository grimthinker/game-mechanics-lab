import React, { useState, useEffect } from 'react';
import { ItemData, STANDARD_RADII, HitZoneType, HitZoneConfig, StandardRadius } from '../../ecs/types';
import { WeaponFormFields, ArmorFormFields, BagFormFields, WeaponFormValues } from './forms/FormFields';
import { DEFAULT_ZONE_PARAMS } from '../../Weapon';
import { weaponModalState } from './weaponModalState';
import { World } from '../../ecs/World';
import { deg2Rad, rad2Deg, Degrees } from '../../utils';

export interface ItemEditValues {
    name: string;
    isSolid: boolean;
    radius: StandardRadius;
    weight: number;
    weapon?: {
      baseDamage: number;
      prepTime: number;
      recoveryTime: number;
      zone: HitZoneConfig;
    };
    armor?: {
      defense: number;
      flatReduction: number;
    };
    bag?: {
      width: number;
      height: number;
    };
  }
  
  export interface ItemEditModalProps {
    itemEntityId: string | null;
    world?: World;
    isReadOnly?: boolean;
    isBagInventoryEmpty?: boolean;
    onItemClick?: (entityId: string) => void;
    inventorySlots?: { itemId: string | null; item: ItemData | null; count: number }[][];
    inventorySize?: { width: number; height: number };
    onClose: () => void;
    onConfirm: (values: ItemEditValues) => void;
  }
  
  export const ItemEditModal: React.FC<ItemEditModalProps> = ({
    itemEntityId,
    world,
    isReadOnly,
    isBagInventoryEmpty = true,
    onItemClick,
    inventorySlots,
    inventorySize,
    onClose,
    onConfirm,
  }) => {
    const [item, setItem] = useState<ItemData | null>(null);
    const [isSolid, setIsSolid] = useState<boolean>(true);
    const [radius, setRadius] = useState<StandardRadius>(16);
    const [formValues, setFormValues] = useState<any>({});
  
    useEffect(() => {
      if (itemEntityId && world) {
        const fetchedItem = world.getComponent(itemEntityId, 'item') ?? null;
        setItem(fetchedItem);
  
        const physStats = world.getComponent(itemEntityId, 'physicsStats');
        const physBody = world.getComponent(itemEntityId, 'physicsBody');
        const wStats = world.getComponent(itemEntityId, 'weaponStats');
        const wZone = world.getComponent(itemEntityId, 'weaponZone');
        const aStats = world.getComponent(itemEntityId, 'armorStats');
        const inv = world.getComponent(itemEntityId, 'inventory');
  
        const currentSolid = physStats?.isSolid.current ?? (physBody ? physBody.mask !== 0 : true);
        const currentRadius = (physStats?.radius.current ?? physBody?.body.r ?? 16) as StandardRadius;
        const currentWeight = physStats?.weight.current ?? 1;
  
        setIsSolid(currentSolid);
        setRadius(currentRadius);
  
        if (fetchedItem) {
          if (fetchedItem.type === 'weapon') {
            const zType = (wZone?.hitZoneType ?? 'forward_line') as HitZoneType;
            setFormValues({
              name: fetchedItem.name,
              weight: currentWeight,
              baseDamage: wStats?.baseDamage.current ?? 20,
              prepTime: wStats?.prepTime.current ?? 0.2,
              recoveryTime: wStats?.recoveryTime.current ?? 0.3,
              length: wZone?.length ?? 150,
              radius: wZone?.radius ?? 50,
              rayCount: wZone?.rayCount ?? 5,
              angle: wZone?.angle !== undefined ? (Math.round(rad2Deg(wZone.angle)) as Degrees) : (30 as Degrees),
              pierceObstacles: !!wZone?.pierceObstacles,
              piercePlayers: !!wZone?.piercePlayers,
              pierceBots: !!wZone?.pierceBots,
              hitZoneType: zType,
            });
          } else if (fetchedItem.type === 'armor') {
            setFormValues({
              name: fetchedItem.name,
              defense: aStats?.defense.current ?? 0,
              flatReduction: aStats?.flatReduction.current ?? 0,
              weight: currentWeight,
            });
          } else if (fetchedItem.type === 'bag') {
            setFormValues({
              name: fetchedItem.name,
              width: inv?.size?.width ?? 6,
              height: inv?.size?.height ?? 4,
              weight: currentWeight,
            });
          }
        }
      } else {
        setItem(null);
      }
    }, [itemEntityId, world]);
  
    if (!item) return null;

  const handleZoneTypeChange = (newType: HitZoneType) => {
    const currentValues = formValues as WeaponFormValues;

    // Сохраняем текущие специфические параметры
    weaponModalState.zoneParamsMap[currentValues.hitZoneType] = {
        length: currentValues.length,
        radius: currentValues.radius,
        rayCount: currentValues.rayCount,
        angle: deg2Rad(currentValues.angle),
        pierceObstacles: currentValues.pierceObstacles,
        piercePlayers: currentValues.piercePlayers,
        pierceBots: currentValues.pierceBots,
      };

    // Получаем сохраненные или дефолтные параметры для нового типа
    const nextParams =
      weaponModalState.zoneParamsMap[newType] || DEFAULT_ZONE_PARAMS[newType];

      setFormValues({
        ...currentValues,
        hitZoneType: newType,
        length: nextParams.length,
        radius: nextParams.radius,
        rayCount: nextParams.rayCount,
        angle: Math.round(rad2Deg(nextParams.angle)) as Degrees,
        pierceObstacles: nextParams.pierceObstacles,
        piercePlayers: nextParams.piercePlayers,
        pierceBots: nextParams.pierceBots,
      });
    };

    const handleConfirm = () => {
        const result: ItemEditValues = {
          name: formValues.name,
          isSolid,
          radius,
          weight: formValues.weight ?? 1,
        };
    
        if (item.type === 'weapon') {
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
              length: formValues.length,
              angle: deg2Rad(formValues.angle),
            };
          } else if (zoneType === 'forward_line') {
            newZone = {
              hitZoneType: 'forward_line',
              length: formValues.length,
              pierceObstacles: formValues.pierceObstacles,
              piercePlayers: formValues.piercePlayers,
              pierceBots: formValues.pierceBots,
            };
          } else {
            newZone = {
              hitZoneType: 'shrapnel',
              length: formValues.length,
              angle: deg2Rad(formValues.angle),
              rayCount: formValues.rayCount,
              pierceObstacles: formValues.pierceObstacles,
              piercePlayers: formValues.piercePlayers,
              pierceBots: formValues.pierceBots,
            };
          }
    
          result.weapon = {
            baseDamage: formValues.baseDamage,
            prepTime: formValues.prepTime,
            recoveryTime: formValues.recoveryTime,
            zone: newZone,
          };
    
          weaponModalState.zoneParamsMap[zoneType] = {
            length: formValues.length,
            radius: formValues.radius,
            rayCount: formValues.rayCount,
            angle: deg2Rad(formValues.angle),
            pierceObstacles: formValues.pierceObstacles,
            piercePlayers: formValues.piercePlayers,
            pierceBots: formValues.pierceBots,
          };
        } else if (item.type === 'armor') {
          result.armor = {
            defense: formValues.defense,
            flatReduction: formValues.flatReduction,
          };
        } else if (item.type === 'bag') {
          result.bag = {
            width: formValues.width,
            height: formValues.height,
          };
        }
    
        onConfirm(result);
      };
    
      const getTypeName = () => {
        const type: string = item.type;
        if (type === 'weapon') return 'Оружие';
        if (type === 'armor') return 'Броня';
        if (type === 'bag') return 'Сумка';
        return type;
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
              onChange={(e) => setIsSolid(e.target.checked)}
            />
            Участвует в коллизии
          </label>

          {isSolid && (
            <label>
              Радиус тела:
              <select
                disabled={isReadOnly}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value) as StandardRadius)}
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
                  Array.from({ length: formValues.width || 6 }, () => ({ itemId: null, item: null, count: 0 }))
                )
              ).map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const it = cell.item;
                  const itemId = (cell as any).itemId;
                  return (
                    <div
                      key={`${rIdx}_${cIdx}`}
                      onClick={() => {
                        if (it && itemId) onItemClick(itemId);
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