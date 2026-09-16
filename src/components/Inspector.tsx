import React, { useState, useEffect, useRef, useCallback } from 'react';
import { World } from '../ecs/World';
import { PhysicsSystem } from '../ecs/systems/PhysicsSystem';
import { AISystem } from '../ecs/systems/AISystem';
import { GameApp } from '../GameApp';
import {
  MetaInspector,
  PhysicsInspector,
  HealthInspector,
  FunctionalHealthInspector,
  HeartInspector,
  SensesInspector,
  SocketsInspector,
  MovementInspector,
  StealthInspector,
  AIInspector,
  AreaEffectorInspector,
  WeaponInspector,
  ArmorInspector,
  BagInspector,
  GenericItemInspector,
  AnatomyInspector,
  InteractionSlotsInspector,
  EquipmentInspector,
  InventoryInspector,
} from './inspector/index';
import { getAnatomyParts } from '../ecs/utils/hierarchy';
import { EDITOR_CONFIG } from '../config/editorConfig';
import { t } from '../locales';
import { GameMode, THEME_COLORS } from '../config/gameConfig';

interface Breadcrumb {
  id: string;
  label: string;
}

export interface InspectorProps {
  app?: GameApp | null;
  mode: GameMode;
  selectedEntityId: string | null;
  world: World | null | undefined;
  physics?: PhysicsSystem | null | undefined;
  aiSystem?: AISystem | null | undefined;
  onCommitHistory: (description: string) => void;
  onUpdateStats?: () => void;
  handleDeleteEntity: () => void;
}

const contentStyle: React.CSSProperties = {
  padding: '12px',
  backgroundColor: '#222',
  borderTop: '1px solid #1a1a1a',
};

export const Inspector: React.FC<InspectorProps> = ({
  app,
  mode,
  selectedEntityId,
  world,
  onCommitHistory,
  handleDeleteEntity,
}) => {
  const isReadOnly = mode !== GameMode.EDITOR;

  // Хлебные крошки для навигации по вложенным объектам
  const [path, setPath] = useState<Breadcrumb[]>([]);

  useEffect(() => {
    if (selectedEntityId && world) {
      const meta = world.getComponent(selectedEntityId, 'meta');
      const item = world.getComponent(selectedEntityId, 'item');
      setPath([{ id: selectedEntityId, label: meta?.name || item?.name || selectedEntityId }]);
    } else {
      setPath([]);
    }
  }, [selectedEntityId, world]);

  const targetId = path.length > 0 ? path[path.length - 1].id : null;

  const pushPath = (id: string, label: string) => {
    setPath((prev) => {
      if (prev.length > 0 && prev[prev.length - 1].id === id) return prev;
      const existingIndex = prev.findIndex((crumb) => crumb.id === id);
      if (existingIndex !== -1) return prev.slice(0, existingIndex + 1);
      return [...prev, { id, label }];
    });
  };

  const popPath = (index: number) => {
    setPath((prev) => prev.slice(0, index + 1));
  };

  // Состояние свернутых/развернутых секций аккордеона
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    meta: true,
    physics: true,
    health: true,
    functionalHealth: true,
    sockets: false,
    movement: false,
    stealth: false,
    ai: false,
    effector: false,
    weapon: false,
    armor: false,
    bag: false,
    genericItem: false,
    heart: false,
    senses: false,
    anatomy: false,
    slots: false,
    equip: false,
    inventory: false,
  });

  const toggleSection = (key: string) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderSection = (key: string, title: React.ReactNode, content: React.ReactNode) => {
    const isOpen = sectionsOpen[key] ?? true;
    return (
      <div
        style={{
          marginBottom: '8px',
          borderRadius: '6px',
          overflow: isOpen ? 'visible' : 'hidden',
          border: '1px solid #333',
          backgroundColor: '#222',
        }}
      >
        <div
          onClick={() => toggleSection(key)}
          style={{
            padding: '10px 12px',
            backgroundColor: '#2a2a2a',
            color: '#ecf0f1',
            fontWeight: 'bold',
            cursor: 'pointer',
            userSelect: 'none',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '13px',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#333')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#2a2a2a')}
        >
          <span>{title}</span>
          <span
            style={{
              fontSize: '11px',
              color: '#3498db',
              fontWeight: 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span style={{ fontSize: '10px', color: '#aaa' }}>
              {isOpen ? t('common.collapse') : t('common.expand')}
            </span>
            <span
              style={{
                transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.2s',
                display: 'inline-block',
                fontSize: '10px',
              }}
            >
              ▼
            </span>
          </span>
        </div>
        {isOpen && <div style={contentStyle}>{content}</div>}
      </div>
    );
  };

  // Debounce для фиксации снимка в истории отмены (Undo)
  const commitTimerRef = useRef<any>(null);
  const requestCommit = useCallback(
    (desc: string) => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => {
        onCommitHistory(desc);
      }, EDITOR_CONFIG.inspectorDebounceMs);
    },
    [onCommitHistory]
  );

  if (!targetId || !world || !world.getEntity(targetId)) {
    return (
      <div
        style={{
          backgroundColor: THEME_COLORS[mode],
          width: '320px',
          minWidth: '320px',
          maxWidth: '320px',
          height: '100%',
          borderLeft: '1px solid #333',
          padding: '16px',
          color: '#777',
          boxSizing: 'border-box',
        }}
      >
        <p className="selection-hint" style={{ textAlign: 'center', marginTop: '50px' }}>
          {t('inspector.nothingSelected')}
        </p>
      </div>
    );
  }

  const currentArchetype = world.getComponent(targetId, 'tag')?.archetype;
  const hasAssembly = world.getComponent(targetId, 'assemblyRoot') !== undefined;
  const anatomyParts =
    currentArchetype === 'creature' || currentArchetype === 'bodyPart' || hasAssembly
      ? getAnatomyParts(world, targetId)
      : [];

  const equip = world.getComponent(targetId, 'equip');
  const inv = world.getComponent(targetId, 'inventory');
  const isBagEmpty = !inv || inv.slots.every((r) => r.every((c) => !c.itemId));

  const commonProps = {
    targetId,
    world,
    app,
    isReadOnly,
    onCommit: requestCommit,
  };

  return (
    <div
      style={{
        backgroundColor: THEME_COLORS[mode],
        width: '320px',
        minWidth: '320px',
        maxWidth: '320px',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        boxSizing: 'border-box',
        borderLeft: '1px solid #333',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Хлебные крошки */}
      <div
        style={{
          padding: '10px 12px',
          backgroundColor: '#1a1a1a',
          borderBottom: '1px solid #333',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
        }}
      >
        {path.map((crumb, idx) => (
          <React.Fragment key={`${crumb.id}_${idx}`}>
            <span
              style={{
                cursor: idx < path.length - 1 ? 'pointer' : 'default',
                color: idx < path.length - 1 ? '#3498db' : '#ecf0f1',
                fontSize: '12px',
                fontWeight: idx === path.length - 1 ? 'bold' : 'normal',
              }}
              onClick={() => {
                if (idx < path.length - 1) popPath(idx);
              }}
            >
              {crumb.label}
            </span>
            {idx < path.length - 1 && <span style={{ color: '#555', fontSize: '12px' }}>/</span>}
          </React.Fragment>
        ))}
      </div>

      <div
        style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}
      >
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          {/* Мета и Базовые данные */}
          {renderSection('meta', t('inspector.meta'), <MetaInspector {...commonProps} />)}

          {/* Физика */}
          {world.getComponent(targetId, 'physicsStats') &&
            renderSection('physics', t('inspector.physics'), <PhysicsInspector {...commonProps} />)}

          {/* Структурное здоровье (HP) */}
          {world.getComponent(targetId, 'health') &&
            currentArchetype !== 'creature' &&
            !hasAssembly &&
            renderSection('health', t('inspector.health'), <HealthInspector {...commonProps} />)}

          {/* Функциональная прочность (ФП) */}
          {world.getComponent(targetId, 'functionalHealth') &&
            renderSection(
              'functionalHealth',
              t('inspector.functionalHealth'),
              <FunctionalHealthInspector {...commonProps} />
            )}

          {/* Сердце */}
          {world.getComponent(targetId, 'heart') &&
            renderSection('heart', t('inspector.heart'), <HeartInspector {...commonProps} />)}

          {/* Зрение и Слух */}
          {(world.getComponent(targetId, 'vision') || world.getComponent(targetId, 'hearing')) &&
            renderSection('senses', t('inspector.senses'), <SensesInspector {...commonProps} />)}

          {/* Сокеты */}
          {world.getComponent(targetId, 'socketLink') &&
            renderSection('sockets', t('inspector.sockets'), <SocketsInspector {...commonProps} />)}

          {/* Параметры движения */}
          {world.getComponent(targetId, 'movementStats') &&
            renderSection(
              'movement',
              t('inspector.movement'),
              <MovementInspector {...commonProps} />
            )}

          {/* Скрытность */}
          {world.getComponent(targetId, 'stealthStats') &&
            renderSection('stealth', t('inspector.stealth'), <StealthInspector {...commonProps} />)}

          {/* Поведение ИИ */}
          {world.getComponent(targetId, 'aiStats') &&
            renderSection('ai', t('inspector.ai'), <AIInspector {...commonProps} />)}

          {/* Зона-эффектор */}
          {world.getComponent(targetId, 'areaEffector') &&
            renderSection(
              'effector',
              t('inspector.effector'),
              <AreaEffectorInspector {...commonProps} />
            )}

          {/* Оружие */}
          {world.getComponent(targetId, 'weaponStats') &&
            world.getComponent(targetId, 'weaponZone') &&
            renderSection('weapon', t('inspector.weapon'), <WeaponInspector {...commonProps} />)}

          {/* Броня */}
          {(world.getComponent(targetId, 'armorStats') || currentArchetype === 'creature') &&
            renderSection(
              'armor',
              currentArchetype === 'creature' ? t('inspector.ownArmor') : t('inspector.armor'),
              <ArmorInspector {...commonProps} />
            )}

          {/* Сумка / Инвентарь предмета */}
          {world.getComponent(targetId, 'inventory') &&
            world.getComponent(targetId, 'item')?.type === 'bag' &&
            renderSection('bag', t('inspector.bag'), <BagInspector {...commonProps} />)}

          {/* Часть тела как предмет */}
          {world.getComponent(targetId, 'item')?.type === 'bodyPart' &&
            renderSection(
              'genericItem',
              t('inspector.genericItem'),
              <GenericItemInspector {...commonProps} />
            )}

          {/* Анатомия */}
          {anatomyParts.length > 1 &&
            renderSection(
              'anatomy',
              t('inspector.anatomy', { count: anatomyParts.length }),
              <AnatomyInspector
                targetId={targetId}
                world={world}
                anatomyParts={anatomyParts}
                onNavigate={pushPath}
              />
            )}

          {/* Слоты взаимодействия (Руки) */}
          {(currentArchetype === 'creature' || world.getComponent(targetId, 'interactionSlots')) &&
            renderSection(
              'slots',
              currentArchetype === 'creature' ? t('inspector.slots') : t('inspector.singleSlot'),
              <InteractionSlotsInspector {...commonProps} onNavigate={pushPath} />
            )}

          {/* Области экипировки */}
          {renderSection(
            'equip',
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <span>{t('inspector.equip')}</span>
              {!isReadOnly && currentArchetype !== 'creature' && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: '#27ae60',
                    color: '#fff',
                    padding: '2px 6px',
                    fontSize: '10px',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (app) {
                      app.addEquipmentArea(targetId);
                      requestCommit(t('history.equipAdd'));
                    }
                  }}
                >
                  {t('inspector.addSlot')}
                </button>
              )}
            </div>,
            <EquipmentInspector {...commonProps} onNavigate={pushPath} />
          )}

          {/* Инвентарь (Сетки хранения) */}
          {renderSection(
            'inventory',
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                width: '100%',
              }}
            >
              <span>{t('inspector.inventory')}</span>
              {currentArchetype === 'item' && !isReadOnly && (
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{
                    backgroundColor: inv ? '#c0392b' : '#27ae60',
                    color: '#fff',
                    padding: '2px 6px',
                    fontSize: '10px',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (inv) {
                      if (isBagEmpty) {
                        if (app) {
                          app.setEntityInventoryGrid(targetId, false);
                          requestCommit(t('history.gridRemove'));
                        }
                      } else {
                        alert(t('inspector.invRemoveWarn'));
                      }
                    } else {
                      if (app) {
                        app.setEntityInventoryGrid(targetId, true);
                        requestCommit(t('history.gridAdd'));
                      }
                    }
                  }}
                >
                  {inv ? t('inspector.removeGrid') : t('inspector.addGrid')}
                </button>
              )}
            </div>,
            <InventoryInspector targetId={targetId} world={world} onNavigate={pushPath} />
          )}
        </form>

        {/* Кнопка удаления корневой выбранной сущности */}
        {path.length === 1 && !isReadOnly && (
          <div style={{ marginTop: '16px' }}>
            <button
              className="btn"
              style={{ width: '100%', backgroundColor: '#c0392b' }}
              onClick={handleDeleteEntity}
            >
              {t('inspector.deleteObject')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
