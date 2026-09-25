import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { World } from '../../ecs/World';
import {
  getAggregatedInteractionSlots,
  getAnatomyParts,
  calculateTotalEntityWeight,
  AggregatedSlot,
} from '../../ecs/utils/hierarchy';
import { EquipmentArea, EQUIPMENT_AREA_TYPE_LABELS } from '../../ecs/types';
import { EventBus } from '../../core/EventBus';
import { GameApp } from '../../GameApp';

export interface RetroSlotsHUDProps {
  app?: GameApp | null;
  world: World | null | undefined;
  selectedEntityId: string | null;
}

// Векторная пиксельная перчатка в стиле референса (увеличенный масштаб)
const PixelHandIcon: React.FC<{ color?: string }> = ({ color = '#b0b0b0' }) => (
  <svg
    viewBox="0 0 24 24"
    width="32"
    height="32"
    style={{ imageRendering: 'pixelated', display: 'block' }}
  >
    <path
      fill={color}
      d="M7 11V8h2V5h2V2h2v10h1V4h2v8h1V7h2v9h-1v2h-1v2h-2v2H9v-2H7v-2H5v-4h2v-3h2v3H7v-2z"
    />
    <path
      fill="#ffffff"
      opacity="0.3"
      d="M8 11V9h2V6h2V3h1v9h2V5h1v7h2V8h1v8h-1v2h-1v2h-2v2h-3v-2H8v-2H6v-2h2v-3z"
    />
  </svg>
);

// Иконки для типов экипировочных зон по умолчанию
const ZONE_ICONS: Record<string, string> = {
  head: '🪖',
  neck: '🧣',
  torso: '🦺',
  hands: '🧤',
  legs: '👖',
  feet: '👢',
  waist: '🥋',
  belt_slot: '🗡️',
  sheath: '⚔️',
  holster: '🔫',
  sling: '🎒',
  pouch: '👝',
};

// Стили ретро-фасок (Укрупненный масштаб)
const RETRO_FRAME_STYLE: React.CSSProperties = {
  backgroundColor: '#dcdcdc',
  border: '3px solid #222',
  boxShadow: 'inset 2px 2px 0 #fff, inset -2px -2px 0 #777, 0 6px 20px rgba(0,0,0,0.7)',
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  userSelect: 'none',
  fontFamily: 'monospace',
};

const RETRO_SLOT_SUNKEN: React.CSSProperties = {
  width: '54px',
  height: '54px',
  backgroundColor: '#bfbfbf',
  borderTop: '3px solid #4a4a4a',
  borderLeft: '3px solid #4a4a4a',
  borderRight: '2px solid #ffffff',
  borderBottom: '2px solid #ffffff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  position: 'relative',
  boxSizing: 'border-box',
  cursor: 'pointer',
};

export const RetroSlotsHUD: React.FC<RetroSlotsHUDProps> = ({ app, world, selectedEntityId }) => {
  const [scrollIndex, setScrollIndex] = useState(0);
  const [hoveredAreaKey, setHoveredAreaKey] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    globalSlotIndex: number;
    itemName: string;
  } | null>(null);
  const slotDomRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Реактивное обновление при изменениях в мире ECS и инвентаре
  useEffect(() => {
    const unsubWorld = EventBus.on('world:updated', () => setRevision((r) => r + 1));
    const unsubInv = EventBus.on('inventory:updated', () => setRevision((r) => r + 1));
    return () => {
      unsubWorld();
      unsubInv();
    };
  }, []);

  // Определение целевого существа (выбранное существо или подконтрольный игрок)
  const targetCreatureId = useMemo(() => {
    if (!world) return null;

    if (selectedEntityId && world.hasEntity(selectedEntityId)) {
      const tag = world.getComponent(selectedEntityId, 'tag');
      const assembly = world.getComponent(selectedEntityId, 'assemblyRoot');
      const socketDef = world.getComponent(selectedEntityId, 'socketDef');
      if (tag?.archetype === 'creature' || !!assembly || !!socketDef) {
        return selectedEntityId;
      }
    }

    return app ? app.getPlayerEntityId() : null;
  }, [world, selectedEntityId, revision, app]);

  // Запрос слотов взаимодействия (руки)
  const slots: AggregatedSlot[] = useMemo(() => {
    if (!world || !targetCreatureId) return [];
    return getAggregatedInteractionSlots(world, targetCreatureId);
  }, [world, targetCreatureId, revision]);

  // Запрос зон экипировки со всех частей существа
  const equipAreas: Array<{ area: EquipmentArea; containerId: string; containerName: string }> =
    useMemo(() => {
      if (!world || !targetCreatureId) return [];
      const result: Array<{ area: EquipmentArea; containerId: string; containerName: string }> = [];
      const parts = getAnatomyParts(world, targetCreatureId);

      for (const pId of parts) {
        const pEquip = world.getComponent(pId, 'equip');
        const pMeta = world.getComponent(pId, 'meta');
        if (pEquip && pEquip.equipmentAreas) {
          for (const area of pEquip.equipmentAreas) {
            result.push({
              area,
              containerId: pId,
              containerName: pMeta?.name || pId,
            });
          }
        }
      }
      return result;
    }, [world, targetCreatureId, revision]);

  const targetName = useMemo(() => {
    if (!world || !targetCreatureId) return '';
    return world.getComponent(targetCreatureId, 'meta')?.name || 'Существо';
  }, [world, targetCreatureId, revision]);

  // Сброс индекса скролла при смене существа
  useEffect(() => {
    setScrollIndex(0);
  }, [targetCreatureId]);

  if (!world || !targetCreatureId || (slots.length === 0 && equipAreas.length === 0)) {
    return null;
  }

  // Окно пагинации слотов (ровно 5 ячеек)
  const VISIBLE_COUNT = 5;
  const maxScroll = Math.max(0, slots.length - VISIBLE_COUNT);
  const visibleSlots = slots.slice(scrollIndex, scrollIndex + VISIBLE_COUNT);

  const handleDrop = (globalSlotIndex: number) => {
    if (app && targetCreatureId) {
      const brain =
        app.world.getComponent(targetCreatureId, 'brain') ||
        (app.world.getComponent(targetCreatureId, 'assemblyRoot') ? true : false);
      if (brain) {
        app.updateEntityBlackboard(targetCreatureId, 'requestedDropSlot', globalSlotIndex);
      } else {
        app.world.addComponent(targetCreatureId, 'dropItemIntent', {
          slotIndex: globalSlotIndex,
        });
      }
    }
    setContextMenu(null);
  };

  const handleThrow = (globalSlotIndex: number) => {
    if (app && targetCreatureId) {
      const aggSlots = getAggregatedInteractionSlots(app.world, targetCreatureId);
      const slotInfo = aggSlots[globalSlotIndex];
      if (slotInfo && slotInfo.slot.itemId) {
        app.throwTargeting = {
          slotIndex: globalSlotIndex,
          partId: slotInfo.partId,
          itemId: slotInfo.slot.itemId,
        };
      }
    }
    setContextMenu(null);
  };

  // Обработка горячих клавиш: 1..5 для слотов, а при открытом меню Q/R/T/Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      if (contextMenu) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setContextMenu(null);
          return;
        }
        if (e.code === 'KeyQ' || e.key.toLowerCase() === 'q') {
          e.preventDefault();
          handleThrow(contextMenu.globalSlotIndex);
          return;
        }
        if (e.code === 'KeyR' || e.key.toLowerCase() === 'r') {
          e.preventDefault();
          handleDrop(contextMenu.globalSlotIndex);
          return;
        }
        if (e.code === 'KeyT' || e.key.toLowerCase() === 't') {
          e.preventDefault();
          // Описание: сейчас не активно, ничего не делает
          return;
        }
      }
      const num = parseInt(e.key, 10);
      if (!isNaN(num) && num >= 1 && num <= 5 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const slotIdx = num - 1;
        if (slotIdx >= 0 && slotIdx < visibleSlots.length) {
          const info = visibleSlots[slotIdx];
          const item = info.slot.itemId ? world?.getComponent(info.slot.itemId, 'item') : null;
          if (item) {
            e.preventDefault();
            if (contextMenu && contextMenu.globalSlotIndex === info.globalSlotIndex) {
              setContextMenu(null);
              return;
            }
            const el = slotDomRefs.current[slotIdx];
            let x = window.innerWidth / 2;
            let y = window.innerHeight - 100;
            if (el) {
              const rect = el.getBoundingClientRect();
              x = rect.left + rect.width / 2;
              y = rect.top;
            }
            setContextMenu({
              x,
              y,
              globalSlotIndex: info.globalSlotIndex,
              itemName: item.name,
            });
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [contextMenu, visibleSlots, world, app, targetCreatureId]);

  // Заглушки пустых слотов, если у моба меньше 5 рук
  const placeholderCount = Math.max(0, VISIBLE_COUNT - visibleSlots.length);
  const placeholders = Array.from({ length: placeholderCount });

  const handleSlotsWheel = (e: React.WheelEvent) => {
    if (slots.length <= VISIBLE_COUNT) return;
    if (e.deltaY > 0) {
      setScrollIndex((prev) => Math.min(maxScroll, prev + 1));
    } else {
      setScrollIndex((prev) => Math.max(0, prev - 1));
    }
  };

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 58,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 95,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {/* 1. Блок зон экипировки (Горизонтальный ряд) */}
      {equipAreas.length > 0 && (
        <div style={RETRO_FRAME_STYLE}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 'bold',
              color: '#333',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '0 4px',
            }}
          >
            <span>ЭКИПИРОВКА: {targetName.toUpperCase()}</span>
          </div>

          <div style={{ display: 'flex', gap: '8px', position: 'relative' }}>
            {equipAreas.map(({ area, containerId, containerName }, idx) => {
              const areaKey = `${containerId}_${area.id}_${idx}`;
              const isHovered = hoveredAreaKey === areaKey;
              const hasItems = area.itemIds.length > 0;
              const zoneIcon = ZONE_ICONS[area.type] || '🛡️';

              let usedSpace = 0;
              for (const itId of area.itemIds) {
                const it = world.getComponent(itId, 'item');
                if (it) usedSpace += it.size;
              }

              return (
                <div
                  key={areaKey}
                  onMouseEnter={() => setHoveredAreaKey(areaKey)}
                  onMouseLeave={() => setHoveredAreaKey(null)}
                  style={{ position: 'relative' }}
                >
                  {/* Ячейка зоны */}
                  <div
                    style={{
                      ...RETRO_SLOT_SUNKEN,
                      backgroundColor: isHovered ? '#cfcfcf' : hasItems ? '#b0c4de' : '#bfbfbf',
                    }}
                    title={`${area.name} (${EQUIPMENT_AREA_TYPE_LABELS[area.type] || area.type})`}
                  >
                    <span style={{ fontSize: '24px' }}>{zoneIcon}</span>
                    {hasItems && (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          right: 3,
                          fontSize: '10px',
                          fontWeight: 'bold',
                          color: '#111',
                          backgroundColor: 'rgba(255,255,255,0.85)',
                          padding: '0 4px',
                          borderRadius: '2px',
                        }}
                      >
                        {area.itemIds.length}
                      </span>
                    )}
                  </div>

                  {/* Всплывающий вертикальный список надетых предметов при наведении */}
                  {isHovered && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '100%',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        marginBottom: '8px',
                        ...RETRO_FRAME_STYLE,
                        minWidth: '200px',
                        maxWidth: '280px',
                        zIndex: 110,
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11px',
                          fontWeight: 'bold',
                          color: '#222',
                          borderBottom: '2px solid #888',
                          paddingBottom: '4px',
                        }}
                      >
                        {area.name} [{usedSpace}/{area.space}]
                      </div>

                      {/* Вертикальный скролл предметов */}
                      <div
                        style={{
                          maxHeight: '160px',
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          paddingTop: '4px',
                        }}
                      >
                        {hasItems ? (
                          area.itemIds.map((itemId) => {
                            const it = world.getComponent(itemId, 'item');
                            const itWeight = calculateTotalEntityWeight(world, itemId);
                            return (
                              <div
                                key={itemId}
                                style={{
                                  backgroundColor: '#efefef',
                                  border: '1px solid #777',
                                  padding: '5px 8px',
                                  fontSize: '11px',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  color: '#111',
                                }}
                              >
                                <span
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontWeight: 'bold',
                                  }}
                                >
                                  {it?.name || itemId}
                                </span>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#666',
                                    flexShrink: 0,
                                    marginLeft: '6px',
                                  }}
                                >
                                  {itWeight}kg
                                </span>
                              </div>
                            );
                          })
                        ) : (
                          <div
                            style={{
                              fontSize: '11px',
                              color: '#777',
                              fontStyle: 'italic',
                              padding: '4px 0',
                            }}
                          >
                            [Пусто]
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Блок слотов взаимодействия (Руки) */}
      <div style={RETRO_FRAME_STYLE}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onWheel={handleSlotsWheel}
        >
          {/* Кнопка прокрутки влево */}
          {slots.length > VISIBLE_COUNT && (
            <button
              onClick={() => setScrollIndex((p) => Math.max(0, p - 1))}
              disabled={scrollIndex === 0}
              style={{
                width: '20px',
                height: '54px',
                backgroundColor: '#dcdcdc',
                border: '2px solid #555',
                cursor: scrollIndex === 0 ? 'default' : 'pointer',
                opacity: scrollIndex === 0 ? 0.3 : 1,
                fontSize: '12px',
                fontWeight: 'bold',
                padding: 0,
              }}
            >
              ◀
            </button>
          )}

          {/* Видимые слоты (до 5 штук) */}
          {visibleSlots.map((info, idx) => {
            const slot = info.slot;
            const item = slot.itemId ? world.getComponent(slot.itemId, 'item') : null;
            const isBroken = info.isBroken;

            return (
              <div
                key={`slot_${info.partId}_${slot.id}`}
                ref={(el) => {
                  slotDomRefs.current[idx] = el;
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (item) {
                    setContextMenu({
                      x: e.clientX,
                      y: e.clientY,
                      globalSlotIndex: info.globalSlotIndex,
                      itemName: item.name,
                    });
                  }
                }}
                style={{
                  ...RETRO_SLOT_SUNKEN,
                  backgroundColor: isBroken ? '#a94442' : item ? '#d4edda' : '#bfbfbf',
                }}
                title={`${slot.name || 'Слот'} (${isBroken ? 'Травмировано' : item ? item.name : 'Пусто'})`}
              >
                {/* Номер горячей клавиши слота [1..5] */}
                <span
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: 3,
                    fontSize: '9px',
                    fontWeight: 'bold',
                    color: '#444',
                    backgroundColor: 'rgba(255,255,255,0.7)',
                    padding: '0 3px',
                    borderRadius: '2px',
                    lineHeight: '11px',
                  }}
                >
                  {idx + 1}
                </span>

                {item ? (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '100%',
                      height: '100%',
                      padding: '2px',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ fontSize: '22px' }}>
                      {item.type === 'weapon' ? '⚔️' : item.type === 'armor' ? '🛡️' : '📦'}
                    </span>
                    <span
                      style={{
                        fontSize: '9px',
                        color: '#111',
                        fontWeight: 'bold',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap',
                        textOverflow: 'ellipsis',
                        maxWidth: '48px',
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                ) : (
                  <PixelHandIcon color={isBroken ? '#6b1d1d' : '#888888'} />
                )}

                {/* Индикатор травмы руки */}
                {isBroken && (
                  <span
                    style={{
                      position: 'absolute',
                      top: 1,
                      right: 3,
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 'bold',
                    }}
                  >
                    ✕
                  </span>
                )}
              </div>
            );
          })}

          {/* Заглушки, если слотов меньше 5 */}
          {placeholders.map((_, idx) => (
            <div
              key={`ph_${idx}`}
              style={{
                width: '54px',
                height: '54px',
                backgroundColor: '#d0d0d0',
                opacity: 0.45,
                border: '1px solid #aaa',
                boxSizing: 'border-box',
              }}
            />
          ))}

          {/* Кнопка прокрутки вправо */}
          {slots.length > VISIBLE_COUNT && (
            <button
              onClick={() => setScrollIndex((p) => Math.min(maxScroll, p + 1))}
              disabled={scrollIndex >= maxScroll}
              style={{
                width: '20px',
                height: '54px',
                backgroundColor: '#dcdcdc',
                border: '2px solid #555',
                cursor: scrollIndex >= maxScroll ? 'default' : 'pointer',
                opacity: scrollIndex >= maxScroll ? 0.3 : 1,
                fontSize: '12px',
                fontWeight: 'bold',
                padding: 0,
              }}
            >
              ▶
            </button>
          )}
        </div>
      </div>

      {/* Контекстное меню слота предмета (ПКМ через React Portal) */}
      {contextMenu &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 99998,
              backgroundColor: 'transparent',
            }}
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu(null);
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
              }}
              style={{
                position: 'fixed',
                left: Math.min(window.innerWidth - 130, Math.max(10, contextMenu.x)),
                top: Math.max(10, contextMenu.y - 85),
                ...RETRO_FRAME_STYLE,
                padding: '4px',
                minWidth: '120px',
                zIndex: 99999,
              }}
            >
              <div
                style={{
                  fontSize: '10px',
                  fontWeight: 'bold',
                  color: '#333',
                  borderBottom: '1px solid #999',
                  padding: '2px 4px 4px 4px',
                  marginBottom: '4px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {contextMenu.itemName}
              </div>

              <button
                type="button"
                onClick={() => handleDrop(contextMenu.globalSlotIndex)}
                style={{
                  backgroundColor: '#dcdcdc',
                  border: '1px solid #777',
                  padding: '4px 6px',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: '#111',
                  width: '100%',
                  boxSizing: 'border-box',
                  marginBottom: '2px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#cfcfcf')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dcdcdc')}
              >
                Выбросить под ноги [R]
              </button>

              <button
                type="button"
                onClick={() => handleThrow(contextMenu.globalSlotIndex)}
                style={{
                  backgroundColor: '#dcdcdc',
                  border: '1px solid #777',
                  padding: '4px 6px',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  color: '#c0392b',
                  width: '100%',
                  boxSizing: 'border-box',
                  marginBottom: '2px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#cfcfcf')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#dcdcdc')}
              >
                Кинуть (Прицел) [Q]
              </button>

              <button
                type="button"
                disabled
                style={{
                  backgroundColor: '#e0e0e0',
                  border: '1px solid #bbb',
                  padding: '4px 6px',
                  fontSize: '11px',
                  textAlign: 'left',
                  cursor: 'not-allowed',
                  color: '#999',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                Описание [T]
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
