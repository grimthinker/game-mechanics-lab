import React, { useState, useEffect, useRef, useCallback } from 'react';
import { World } from '../ecs/World';
import { PhysicsSystem } from '../ecs/systems/PhysicsSystem';
import { AISystem } from '../ecs/systems/AISystem';
import { GameApp } from '../GameApp';
import { GameMode, THEME_COLORS } from '../constants';
import {
  HitZoneType,
  HitZoneConfig,
  StandardRadius,
  isValidStandardRadius,
  STANDARD_EQUIPMENT_AREA_TYPES,
  EQUIPMENT_AREA_TYPE_LABELS,
} from '../ecs/types';
import { AreaEffectorInspector } from './inspector/AreaEffectorInspector';
import {
  WeaponFormFields,
  ArmorFormFields,
  BagFormFields,
  WeaponFormValues,
  CommonItemFormFields,
} from './modals/forms/FormFields';
import { DEFAULT_ZONE_PARAMS, ZoneTypeParams } from '../Weapon';
import { rad2Deg, Degrees, deg2Rad } from '../utils';
import { AIInspector } from './inspector/AIInspector';
import { HealthInspector } from './inspector/HealthInspector';
import { MetaInspector } from './inspector/MetaInspector';
import { MovementInspector } from './inspector/MovementInspector';
import { PhysicsInspector } from './inspector/PhysicsInspector';
import { StealthInspector } from './inspector/StealthInspector';
import {
  calculateTotalEntityWeight,
  getAnatomyParts,
  getAggregatedInteractionSlots,
  getAllEquippedDescendants,
} from '../ecs/utils/hierarchy';
import { EDITOR_CONFIG } from '../config/editorConfig';
import { t } from '../locales';

interface Breadcrumb {
  id: string;
  label: string;
}

export interface InspectorProps {
  app?: GameApp | null;
  mode: GameMode;
  selectedEntityId: string | null;
  world: World | null | undefined;
  physics: PhysicsSystem | null | undefined;
  aiSystem: AISystem | null | undefined;
  onCommitHistory: (description: string) => void;
  onUpdateStats: () => void;
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
  physics: _physics,
  aiSystem: _aiSystem,
  onCommitHistory,
  onUpdateStats,
  handleDeleteEntity,
}) => {
  const isReadOnly = mode !== GameMode.EDITOR;

  // --- Навигация и Хлебные Крошки ---
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
      if (prev.length > 0 && prev[prev.length - 1].id === id) {
        return prev;
      }
      const existingIndex = prev.findIndex((crumb) => crumb.id === id);
      if (existingIndex !== -1) {
        return prev.slice(0, existingIndex + 1);
      }
      return [...prev, { id, label }];
    });
  };

  const popPath = (index: number) => {
    setPath((prev) => prev.slice(0, index + 1));
  };

  // --- Система сворачивания групп (Аккордеон) ---
  const [sectionsOpen, setSectionsOpen] = useState<Record<string, boolean>>({
    meta: true, // Открыто: Базовая информация
    physics: true, // Открыто: Физика и коллизии
    health: true, // Открыто: Здоровье / СП
    functionalHealth: true, // Открыто: ФП
    sockets: false, // Свернуто
    movement: false, // Свернуто: Большое число параметров движения
    stealth: false, // Свернуто: Большое число множителей стелса
    ai: false, // Свернуто
    effector: false, // Свернуто
    weapon: false, // Свернуто
    armor: false, // Свернуто
    bag: false, // Свернуто
    genericItem: false, // Свернуто
    anatomy: false, // Свернуто
    slots: false, // Свернуто
    equip: false, // Свернуто
    inventory: false, // Свернуто
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

  // --- Система Debounce для Истории ---
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

  // --- Состояние Draft (Текущие значения полей) ---
  const [draftName, setDraftName] = useState('');
  const [draftDestructible, setDraftDestructible] = useState(false);
  const [draftPhysics, setDraftPhysics] = useState<any>(null);
  const [draftHealth, setDraftHealth] = useState<any>(null);
  const [draftFunctionalHealth, setDraftFunctionalHealth] = useState<any>(null);
  const [draftMovement, setDraftMovement] = useState<any>(null);
  const [draftStealth, setDraftStealth] = useState<any>(null);
  const [draftAI, setDraftAI] = useState<string | null>(null);
  const [draftZone, setDraftZone] = useState<any>(null);
  const [draftWeapon, setDraftWeapon] = useState<WeaponFormValues | null>(null);
  const [draftArmor, setDraftArmor] = useState<any>(null);
  const [draftBag, setDraftBag] = useState<any>(null);
  const [draftGenericItem, setDraftGenericItem] = useState<any>(null);

  const zoneParamsMapRef = useRef<Record<HitZoneType, ZoneTypeParams>>({
    angle: { ...DEFAULT_ZONE_PARAMS.angle },
    radius: { ...DEFAULT_ZONE_PARAMS.radius },
    forward_line: { ...DEFAULT_ZONE_PARAMS.forward_line },
    shrapnel: { ...DEFAULT_ZONE_PARAMS.shrapnel },
  });

  // Загрузка данных в Draft при смене фокуса
  useEffect(() => {
    if (!targetId || !world) return;

    const meta = world.getComponent(targetId, 'meta');
    const item = world.getComponent(targetId, 'item');
    setDraftName(meta?.name ?? item?.name ?? targetId);
    setDraftDestructible(meta?.destructible ?? false);

    const physStats = world.getComponent(targetId, 'physicsStats');
    if (physStats) {
      setDraftPhysics({
        radius: physStats.radius.base,
        weight: physStats.weight.base,
        isSolid: physStats.isSolid,
      });
    } else {
      setDraftPhysics(null);
    }

    const health = world.getComponent(targetId, 'health');
    setDraftHealth(
      health ? { hp: Math.round(health.current), maxHp: Math.round(health.max.base) } : null
    );

    const functionalHealth = world.getComponent(targetId, 'functionalHealth');
    setDraftFunctionalHealth(
      functionalHealth
        ? { fp: Math.round(functionalHealth.current), maxFp: Math.round(functionalHealth.max.base) }
        : null
    );

    const moveStats = world.getComponent(targetId, 'movementStats');
    setDraftMovement(
      moveStats
        ? {
            maxSpeed: moveStats.maxSpeed.base,
            maxTurnSpeed: rad2Deg(moveStats.maxTurnSpeed.base) as Degrees,
            runSpeedMultiplier: moveStats.runSpeedMultiplier,
            crouchSpeedMultiplier: moveStats.crouchSpeedMultiplier,
            proneSpeedMultiplier: moveStats.proneSpeedMultiplier ?? 0.2,
            walkSpeedMultiplier: moveStats.walkSpeedMultiplier ?? 0.5,
            runTurnMultiplier: moveStats.runTurnMultiplier ?? 0.7,
            crouchTurnMultiplier: moveStats.crouchTurnMultiplier,
            proneTurnMultiplier: moveStats.proneTurnMultiplier ?? 0.3,
            walkTurnMultiplier: moveStats.walkTurnMultiplier ?? 1.1,
            turnInPlaceTurnMultiplier: moveStats.turnInPlaceTurnMultiplier ?? 1.2,
            strafeSpeedMultiplier: moveStats.strafeSpeedMultiplier ?? 0.8,
            backwardSpeedMultiplier: moveStats.backwardSpeedMultiplier ?? 0.6,
            strafeTurnMultiplier: moveStats.strafeTurnMultiplier ?? 0.8,
            backwardTurnMultiplier: moveStats.backwardTurnMultiplier ?? 0.6,
            pickupSpeedMultiplier: moveStats.pickupSpeedMultiplier ?? 0.5,
            pickupTurnMultiplier: moveStats.pickupTurnMultiplier ?? 1.1,
            standToCrouchTime: moveStats.standToCrouchTime?.base ?? 0.1,
            crouchToStandTime: moveStats.crouchToStandTime?.base ?? 0.1,
            standToProneTime: moveStats.standToProneTime?.base ?? 0.5,
            proneToStandTime: moveStats.proneToStandTime?.base ?? 1.0,
            crouchToProneTime: moveStats.crouchToProneTime?.base ?? 0.5,
            proneToCrouchTime: moveStats.proneToCrouchTime?.base ?? 1.0,
          }
        : null
    );

    const stealthStats = world.getComponent(targetId, 'stealthStats');
    setDraftStealth(
      stealthStats
        ? {
            stealthPower: stealthStats.stealthPower.base,
            crouchStealthMultiplier: stealthStats.crouchStealthMultiplier,
            proneStealthMultiplier: stealthStats.proneStealthMultiplier ?? 3.0,
            runStealthMultiplier: stealthStats.runStealthMultiplier,
            walkStealthMultiplier: stealthStats.walkStealthMultiplier ?? 1.3,
            turnInPlaceStealthMultiplier: stealthStats.turnInPlaceStealthMultiplier ?? 1.5,
            immobileStealthMultiplier: stealthStats.immobileStealthMultiplier ?? 2.0,
          }
        : null
    );

    const aiStats = world.getComponent(targetId, 'aiStats');
    setDraftAI(aiStats ? aiStats.behavior.current : null);

    const effector = world.getComponent(targetId, 'areaEffector');
    setDraftZone(effector ? { ...effector } : null);

    const wStats = world.getComponent(targetId, 'weaponStats');
    const wZone = world.getComponent(targetId, 'weaponZone');
    if (wStats && wZone) {
      setDraftWeapon({
        name: meta?.name ?? item?.name ?? 'Оружие',
        size: item?.size ?? 10,
        equipTypes: item?.equipTypes ?? [],
        equippable: item?.equippable ?? false,
        equipTimeMultiplier: item?.equipTimeMultiplier ?? 1.0,
        baseDamage: wStats.baseDamage.base,
        prepTime: wStats.prepTime.base,
        recoveryTime: wStats.recoveryTime.base,
        length: wZone.length ?? 150,
        radius: wZone.radius ?? 50,
        rayCount: wZone.rayCount ?? 5,
        angle:
          wZone.angle !== undefined
            ? (Math.round(rad2Deg(wZone.angle)) as Degrees)
            : (30 as Degrees),
        pierceObstacles: !!wZone.pierceObstacles,
        pierceCreatures: !!wZone.pierceCreatures,
        pierceItems: !!wZone.pierceItems,
        hitZoneType: wZone.hitZoneType,
      });
    } else {
      setDraftWeapon(null);
    }

    const aStats = world.getComponent(targetId, 'armorStats');
    setDraftArmor(
      aStats
        ? {
            name: meta?.name ?? item?.name ?? 'Броня',
            size: item?.size ?? 20,
            equipTypes: item?.equipTypes ?? ['torso'],
            equippable: item?.equippable ?? true,
            equipTimeMultiplier: item?.equipTimeMultiplier ?? 1.0,
            defense: aStats.defense.base,
            flatReduction: aStats.flatReduction.base,
          }
        : null
    );

    const inv = world.getComponent(targetId, 'inventory');
    setDraftBag(
      inv
        ? {
            name: meta?.name ?? item?.name ?? 'Инвентарь',
            size: item?.size ?? 10,
            equipTypes: item?.equipTypes ?? ['torso'],
            equippable: item?.equippable ?? true,
            equipTimeMultiplier: item?.equipTimeMultiplier ?? 1.0,
            width: inv.size.width,
            height: inv.size.height,
          }
        : null
    );

    if (item && item.type === 'bodyPart') {
      setDraftGenericItem({
        name: meta?.name ?? item.name,
        size: item.size,
        equipTypes: item.equipTypes,
        equippable: item.equippable,
        equipTimeMultiplier: item.equipTimeMultiplier,
      });
    } else {
      setDraftGenericItem(null);
    }
  }, [targetId, world]);

  // --- Синхронизация Draft через методы GameApp ---

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !app) return;
    const changed = app.updateEntityMeta(targetId, {
      name: draftName,
      destructible: draftDestructible,
    });
    if (changed) {
      requestCommit(t('history.nameChange'));
      onUpdateStats();
    }
  }, [draftName, draftDestructible]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftPhysics || !app) return;
    const changed = app.updateEntityPhysics(targetId, draftPhysics);
    if (changed) {
      requestCommit(t('history.physicsChange'));
      onUpdateStats();
    }
  }, [draftPhysics]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftHealth || !app) return;
    const changed = app.updateEntityHealth(targetId, draftHealth);
    if (changed) {
      requestCommit(t('history.healthChange'));
      onUpdateStats();
    }
  }, [draftHealth]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftFunctionalHealth || !app) return;
    const changed = app.updateEntityFunctionalHealth(targetId, draftFunctionalHealth);
    if (changed) {
      requestCommit(t('history.fpChange'));
      onUpdateStats();
    }
  }, [draftFunctionalHealth]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftMovement || !app) return;
    const changed = app.updateEntityMovementStats(targetId, draftMovement);
    if (changed) {
      requestCommit(t('history.movementChange'));
      onUpdateStats();
    }
  }, [draftMovement]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftStealth || !app) return;
    const changed = app.updateEntityStealthStats(targetId, draftStealth);
    if (changed) {
      requestCommit(t('history.stealthChange'));
      onUpdateStats();
    }
  }, [draftStealth]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftAI || !app) return;
    const changed = app.updateEntityAIBehavior(targetId, draftAI);
    if (changed) {
      requestCommit(t('history.aiChange'));
      onUpdateStats();
    }
  }, [draftAI]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftZone || !app) return;
    const changed = app.updateEntityAreaEffector(targetId, draftZone);
    if (changed) {
      requestCommit(t('history.effectorChange'));
      onUpdateStats();
    }
  }, [draftZone]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftWeapon || !app) return;
    const changed = app.updateEntityWeapon(targetId, draftWeapon);
    if (changed) {
      requestCommit(t('history.weaponChange'));
      onUpdateStats();
    }
  }, [draftWeapon]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftArmor || !app) return;
    const changed = app.updateEntityArmor(targetId, draftArmor);
    if (changed) {
      requestCommit(t('history.armorChange'));
      onUpdateStats();
    }
  }, [draftArmor]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftGenericItem || !app) return;
    const changed = app.updateEntityGenericItem(targetId, draftGenericItem);
    if (changed) {
      requestCommit(t('history.genericItemChange'));
      onUpdateStats();
    }
  }, [draftGenericItem]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftBag || !app) return;
    const changed = app.updateEntityBag(targetId, draftBag, isBagEmpty);
    if (changed) {
      requestCommit(t('history.bagChange'));
      onUpdateStats();
    }
  }, [draftBag]);

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
  const interactionSlotsComp = world.getComponent(targetId, 'interactionSlots');
  const equip = world.getComponent(targetId, 'equip');
  const inv = world.getComponent(targetId, 'inventory');
  const isBagEmpty = !inv || inv.slots.every((r) => r.every((c) => !c.itemId));
  const isStandardRadiusOnly = currentArchetype === 'creature';

  const hasAssembly = world.getComponent(targetId, 'assemblyRoot') !== undefined;
  const anatomyParts =
    currentArchetype === 'creature' || currentArchetype === 'bodyPart' || hasAssembly
      ? getAnatomyParts(world, targetId)
      : [];

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
          {renderSection(
            'meta',
            t('inspector.meta'),
            <>
              <MetaInspector
                name={draftName}
                onChange={setDraftName}
                isReadOnly={isReadOnly}
                stance={world.getComponent(targetId, 'meta')?.stance}
              />
              {(currentArchetype === 'obstacle' || currentArchetype === 'item') && (
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
                    checked={draftDestructible}
                    onChange={(e) => setDraftDestructible(e.target.checked)}
                  />
                  {t('inspector.destructible')}
                </label>
              )}
            </>
          )}

          {draftPhysics &&
            renderSection(
              'physics',
              t('inspector.physics'),
              <PhysicsInspector
                values={draftPhysics}
                onChange={(p: any) => setDraftPhysics((prev: any) => ({ ...prev, ...p }))}
                isReadOnly={isReadOnly}
                isStandardRadiusOnly={isStandardRadiusOnly}
                totalWeight={calculateTotalEntityWeight(world, targetId)}
              />
            )}

          {draftHealth &&
            currentArchetype !== 'creature' &&
            !hasAssembly &&
            renderSection(
              'health',
              t('inspector.health'),
              <>
                <HealthInspector
                  values={draftHealth}
                  onChange={(p: any) => setDraftHealth((prev: any) => ({ ...prev, ...p }))}
                  isReadOnly={isReadOnly}
                />
                <div
                  style={{
                    marginTop: '8px',
                    height: '10px',
                    backgroundColor: '#111',
                    borderRadius: '5px',
                    overflow: 'hidden',
                    border: '1px solid #333',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, (draftHealth.hp / (draftHealth.maxHp || 1)) * 100))}%`,
                      height: '100%',
                      backgroundColor: '#3498db',
                      transition: 'width 0.2s',
                    }}
                  />
                </div>
              </>
            )}

          {draftFunctionalHealth &&
            renderSection(
              'functionalHealth',
              t('inspector.functionalHealth'),
              <>
                {(() => {
                  const fp = draftFunctionalHealth.fp;
                  const maxFp = draftFunctionalHealth.maxFp;
                  const minFp = -2 * maxFp;
                  const totalRange = maxFp - minFp;
                  const percent = Math.max(0, Math.min(100, ((fp - minFp) / totalRange) * 100));

                  let color = '#2ecc71'; // Зеленый (>0)
                  let statusText = t('inspector.statusFunctional');
                  if (fp <= 0 && fp > -maxFp) {
                    color = '#f39c12'; // Оранжевый/Желтый
                    statusText = t('inspector.statusDisabled');
                  } else if (fp <= -maxFp) {
                    color = '#e74c3c'; // Красный
                    statusText = t('inspector.statusCritical');
                  }

                  return (
                    <>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        Текущая ФП (от {minFp} до {maxFp}):
                        <input
                          disabled={isReadOnly}
                          type="number"
                          value={fp}
                          min={minFp}
                          max={maxFp}
                          onChange={(e) =>
                            setDraftFunctionalHealth((prev: any) => ({
                              ...prev,
                              fp: Number(e.target.value),
                            }))
                          }
                        />
                      </label>
                      <label
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          marginTop: '6px',
                        }}
                      >
                        Макс. ФП:
                        <input
                          disabled={isReadOnly}
                          type="number"
                          value={maxFp}
                          min={1}
                          max={10000}
                          onChange={(e) =>
                            setDraftFunctionalHealth((prev: any) => ({
                              ...prev,
                              maxFp: Number(e.target.value),
                            }))
                          }
                        />
                      </label>

                      <div
                        style={{
                          marginTop: '10px',
                          height: '12px',
                          backgroundColor: '#111',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          border: '1px solid #333',
                          position: 'relative',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            left: `${(maxFp / totalRange) * 100}%`,
                            top: 0,
                            bottom: 0,
                            width: '1px',
                            backgroundColor: '#fff',
                            zIndex: 2,
                          }}
                          title="0 (Порог отключения)"
                        />
                        <div
                          style={{
                            width: `${percent}%`,
                            height: '100%',
                            backgroundColor: color,
                            transition: 'width 0.2s, background-color 0.2s',
                          }}
                        />
                      </div>

                      <div
                        style={{
                          fontSize: '11px',
                          color,
                          marginTop: '6px',
                          fontWeight: 'bold',
                          textAlign: 'center',
                        }}
                      >
                        Статус: {statusText}
                      </div>
                    </>
                  );
                })()}
              </>
            )}

          {world.getComponent(targetId, 'socketLink') &&
            renderSection(
              'sockets',
              t('inspector.sockets'),
              <>
                {Object.entries(world.getComponent(targetId, 'socketLink')!.links).map(
                  ([socketId, link]) => {
                    const targetMeta = world.getComponent(link.targetEntityId, 'meta');
                    const maxStr = link.maxStrength?.base ?? 50;
                    return (
                      <div
                        key={socketId}
                        style={{
                          marginBottom: '8px',
                          padding: '8px',
                          backgroundColor: '#181818',
                          borderRadius: '4px',
                          border: '1px solid #333',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            color: '#3498db',
                            marginBottom: '4px',
                          }}
                        >
                          <span>Сокет: {socketId}</span>
                          <span style={{ color: '#aaa' }}>
                            → {targetMeta?.name || link.targetEntityId}
                          </span>
                        </div>
                        <label
                          style={{
                            fontSize: '11px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          Прочность связи:
                          <input
                            disabled={isReadOnly}
                            type="number"
                            value={Math.round(link.currentStrength)}
                            min={-maxStr}
                            max={maxStr}
                            style={{ width: '60px', padding: '2px' }}
                            onChange={(e) => {
                              if (app) {
                                app.updateEntitySocketLinkStrength(
                                  targetId,
                                  socketId,
                                  Number(e.target.value)
                                );
                                requestCommit(t('history.socketStrengthChange'));
                                onUpdateStats();
                              }
                            }}
                          />
                        </label>
                      </div>
                    );
                  }
                )}
              </>
            )}

          {draftMovement &&
            renderSection(
              'movement',
              t('inspector.movement'),
              <MovementInspector
                values={draftMovement}
                onChange={(p: any) => setDraftMovement((prev: any) => ({ ...prev, ...p }))}
                isReadOnly={isReadOnly}
              />
            )}

          {draftStealth &&
            renderSection(
              'stealth',
              t('inspector.stealth'),
              <StealthInspector
                values={draftStealth}
                onChange={(p: any) => setDraftStealth((prev: any) => ({ ...prev, ...p }))}
                isReadOnly={isReadOnly}
              />
            )}

          {draftAI &&
            renderSection(
              'ai',
              t('inspector.ai'),
              <AIInspector behavior={draftAI} onChange={setDraftAI} isReadOnly={isReadOnly} />
            )}

          {draftZone &&
            renderSection(
              'effector',
              t('inspector.effector'),
              <AreaEffectorInspector
                values={draftZone}
                onChange={(p: any) => setDraftZone((prev: any) => ({ ...prev, ...p }))}
                isReadOnly={isReadOnly}
              />
            )}

          {draftWeapon &&
            renderSection(
              'weapon',
              t('inspector.weapon'),
              <WeaponFormFields
                values={draftWeapon}
                onChange={(p: any) => setDraftWeapon((prev) => (prev ? { ...prev, ...p } : null))}
                onZoneTypeChange={(newType) => {
                  zoneParamsMapRef.current[draftWeapon.hitZoneType] = {
                    length: draftWeapon.length,
                    radius: draftWeapon.radius,
                    rayCount: draftWeapon.rayCount,
                    angle: deg2Rad(draftWeapon.angle),
                    pierceObstacles: draftWeapon.pierceObstacles,
                    pierceCreatures: draftWeapon.pierceCreatures,
                    pierceItems: draftWeapon.pierceItems,
                  };
                  const np = zoneParamsMapRef.current[newType] || DEFAULT_ZONE_PARAMS[newType];
                  setDraftWeapon({
                    ...draftWeapon,
                    hitZoneType: newType,
                    length: np.length,
                    radius: np.radius,
                    rayCount: np.rayCount,
                    angle: Math.round(rad2Deg(np.angle)) as Degrees,
                    pierceObstacles: np.pierceObstacles,
                    pierceCreatures: np.pierceCreatures,
                    pierceItems: np.pierceItems,
                  });
                }}
                isReadOnly={isReadOnly}
              />
            )}

          {draftArmor &&
            renderSection(
              'armor',
              currentArchetype === 'creature' ? t('inspector.ownArmor') : t('inspector.armor'),
              <>
                {currentArchetype !== 'creature' && (
                  <ArmorFormFields
                    values={draftArmor}
                    onChange={(p: any) => setDraftArmor((prev: any) => ({ ...prev, ...p }))}
                    isReadOnly={isReadOnly}
                  />
                )}
                {currentArchetype === 'creature' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label>
                      Защита (defense):{' '}
                      <input
                        disabled={isReadOnly}
                        type="number"
                        value={draftArmor.defense ?? 0}
                        min={0}
                        max={100}
                        onChange={(e) =>
                          setDraftArmor((prev: any) => ({
                            ...prev,
                            defense: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                    <label>
                      Поглощение (flat reduction):{' '}
                      <input
                        disabled={isReadOnly}
                        type="number"
                        value={draftArmor.flatReduction ?? 0}
                        min={0}
                        max={100}
                        onChange={(e) =>
                          setDraftArmor((prev: any) => ({
                            ...prev,
                            flatReduction: Number(e.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                )}
              </>
            )}

          {draftBag &&
            renderSection(
              'bag',
              t('inspector.bag'),
              <BagFormFields
                values={draftBag}
                onChange={(p: any) => setDraftBag((prev: any) => ({ ...prev, ...p }))}
                isReadOnly={isReadOnly}
                isBagInventoryEmpty={isBagEmpty}
              />
            )}

          {draftGenericItem &&
            renderSection(
              'genericItem',
              t('inspector.genericItem'),
              <CommonItemFormFields
                values={draftGenericItem}
                onChange={(p: any) => setDraftGenericItem((prev: any) => ({ ...prev, ...p }))}
                isReadOnly={isReadOnly}
              />
            )}

          {anatomyParts.length > 1 &&
            renderSection(
              'anatomy',
              t('inspector.anatomy', { count: anatomyParts.length }),
              <>
                {anatomyParts.map((partId) => {
                  const meta = world.getComponent(partId, 'meta');
                  const brain = world.getComponent(partId, 'bodyBrain');
                  const isRoot = partId === targetId;
                  return (
                    <div
                      key={partId}
                      onClick={() => pushPath(partId, meta?.name || partId)}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '6px 8px',
                        borderBottom: '1px solid #333',
                        cursor: 'pointer',
                        backgroundColor: isRoot ? '#1b4332' : 'transparent',
                        borderRadius: '4px',
                        marginBottom: '4px',
                      }}
                    >
                      <span style={{ color: isRoot ? '#2ecc71' : '#ecf0f1', fontSize: '12px' }}>
                        {meta?.name || partId}
                      </span>
                      {brain && (
                        <span style={{ fontSize: '10px', color: '#f1c40f', fontWeight: 'bold' }}>
                          [Мозг: {brain.power}]
                        </span>
                      )}
                    </div>
                  );
                })}
              </>
            )}

          {/* Ячейки взаимодействия (Руки) */}
          {currentArchetype === 'creature'
            ? renderSection(
                'slots',
                t('inspector.slots'),
                <>
                  {getAggregatedInteractionSlots(world, targetId).length > 0 ? (
                    getAggregatedInteractionSlots(world, targetId).map((info) => {
                      const slot = info.slot;
                      const slotItem = slot.itemId ? world.getComponent(slot.itemId, 'item') : null;
                      const partMeta = world.getComponent(info.partId, 'meta');
                      return (
                        <div
                          key={`slot_${info.partId}_${slot.id}`}
                          style={{
                            marginBottom: '8px',
                            padding: '10px',
                            backgroundColor: '#181818',
                            borderRadius: '4px',
                            border: '1px solid #333',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginBottom: '8px',
                            }}
                          >
                            <span style={{ fontWeight: 'bold', color: '#3498db' }}>{slot.id}</span>
                            <span style={{ fontSize: '11px', color: '#888' }}>
                              ({partMeta?.name || info.partId})
                            </span>
                          </div>
                          <label
                            style={{
                              fontSize: '11px',
                              display: 'flex',
                              justifyContent: 'space-between',
                            }}
                          >
                            Дальность:
                            <input
                              type="number"
                              disabled={isReadOnly}
                              value={slot.interactDist}
                              style={{ width: '60px', padding: '2px' }}
                              onChange={(e) => {
                                if (app) {
                                  app.updateEntityInteractionSlot(info.partId, {
                                    interactDist: Math.max(1, +e.target.value),
                                  });
                                  requestCommit(t('history.slotConfigure'));
                                  onUpdateStats();
                                }
                              }}
                            />
                          </label>
                          <label
                            style={{
                              fontSize: '11px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              marginTop: '4px',
                            }}
                          >
                            Сила (кг):
                            <input
                              type="number"
                              disabled={isReadOnly}
                              value={slot.strength}
                              style={{ width: '60px', padding: '2px' }}
                              onChange={(e) => {
                                if (app) {
                                  app.updateEntityInteractionSlot(info.partId, {
                                    strength: Math.max(1, +e.target.value),
                                  });
                                  requestCommit(t('history.slotConfigure'));
                                  onUpdateStats();
                                }
                              }}
                            />
                          </label>
                          <div
                            style={{
                              marginTop: '8px',
                              paddingTop: '8px',
                              borderTop: '1px solid #2a2a2a',
                            }}
                          >
                            {slotItem ? (
                              <button
                                type="button"
                                className="btn btn-sm"
                                style={{
                                  width: '100%',
                                  backgroundColor: '#2c3e50',
                                  color: '#ecf0f1',
                                }}
                                onClick={() => pushPath(slot.itemId!, slotItem.name)}
                              >
                                Настроить: {slotItem.name}
                              </button>
                            ) : (
                              <span style={{ color: '#777', fontSize: '12px' }}>
                                {t('common.empty')}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ color: '#777', fontSize: '11px', fontStyle: 'italic' }}>
                      {t('inspector.noHands')}
                    </div>
                  )}
                </>
              )
            : interactionSlotsComp &&
              renderSection(
                'slots',
                t('inspector.singleSlot'),
                <>
                  {(() => {
                    const slot = interactionSlotsComp;
                    const slotItem = slot.itemId ? world.getComponent(slot.itemId, 'item') : null;
                    return (
                      <div
                        key={`slot_${slot.id}`}
                        style={{
                          marginBottom: '8px',
                          padding: '10px',
                          backgroundColor: '#181818',
                          borderRadius: '4px',
                          border: '1px solid #333',
                        }}
                      >
                        <div style={{ fontWeight: 'bold', marginBottom: '8px', color: '#3498db' }}>
                          {slot.id}
                        </div>
                        <label
                          style={{
                            fontSize: '11px',
                            display: 'flex',
                            justifyContent: 'space-between',
                          }}
                        >
                          Дальность:
                          <input
                            type="number"
                            disabled={isReadOnly}
                            value={slot.interactDist}
                            style={{ width: '60px', padding: '2px' }}
                            onChange={(e) => {
                              slot.interactDist = Math.max(1, +e.target.value);
                              requestCommit(t('history.slotConfigure'));
                              onUpdateStats();
                            }}
                          />
                        </label>
                        <label
                          style={{
                            fontSize: '11px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginTop: '4px',
                          }}
                        >
                          Сила (кг):
                          <input
                            type="number"
                            disabled={isReadOnly}
                            value={slot.strength}
                            style={{ width: '60px', padding: '2px' }}
                            onChange={(e) => {
                              slot.strength = Math.max(1, +e.target.value);
                              requestCommit(t('history.slotConfigure'));
                              onUpdateStats();
                            }}
                          />
                        </label>
                        <div
                          style={{
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px solid #2a2a2a',
                          }}
                        >
                          {slotItem ? (
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                width: '100%',
                                backgroundColor: '#2c3e50',
                                color: '#ecf0f1',
                              }}
                              onClick={() => pushPath(slot.itemId!, slotItem.name)}
                            >
                              Настроить: {slotItem.name}
                            </button>
                          ) : (
                            <span style={{ color: '#777', fontSize: '12px' }}>
                              {t('common.empty')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

          {/* Области экипировки (на существах ИЛИ предметах) */}
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
              <span>
                {t('inspector.equip')}{' '}
                {(() => {
                  let count = equip?.equipmentAreas?.length ?? 0;
                  const isCreatureOrAssembly = currentArchetype === 'creature' || hasAssembly;
                  if (isCreatureOrAssembly && !equip) {
                    const parts = getAnatomyParts(world, targetId);
                    count = parts.reduce((acc, pId) => {
                      return acc + (world.getComponent(pId, 'equip')?.equipmentAreas?.length ?? 0);
                    }, 0);
                  }
                  return `(${count})`;
                })()}
              </span>
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
                      onUpdateStats();
                    }
                  }}
                >
                  {t('inspector.addSlot')}
                </button>
              )}
            </div>,
            <>
              {(() => {
                const isCreatureOrAssembly = currentArchetype === 'creature' || hasAssembly;
                let displayAreas: { area: any; containerId: string; containerName: string }[] = [];
                if (equip && equip.equipmentAreas) {
                  displayAreas = equip.equipmentAreas.map((area) => ({
                    area,
                    containerId: targetId,
                    containerName: draftName,
                  }));
                } else if (isCreatureOrAssembly) {
                  const parts = getAnatomyParts(world, targetId);
                  for (const pId of parts) {
                    const pMeta = world.getComponent(pId, 'meta');
                    const pEquip = world.getComponent(pId, 'equip');
                    if (pEquip && pEquip.equipmentAreas) {
                      for (const area of pEquip.equipmentAreas) {
                        displayAreas.push({
                          area,
                          containerId: pId,
                          containerName: pMeta?.name || pId,
                        });
                      }
                    }
                  }
                }

                return displayAreas.length > 0 ? (
                  displayAreas.map(({ area, containerId, containerName }, idx) => {
                    let usedSpace = 0;
                    for (const id of area.itemIds) {
                      const item = world.getComponent(id, 'item');
                      if (item) usedSpace += item.size;
                    }
                    const isOverloaded = usedSpace > area.space;
                    const isFromPart = containerId !== targetId;

                    return (
                      <div
                        key={`area_${area.id || idx}`}
                        style={{
                          marginBottom: '8px',
                          padding: '10px',
                          backgroundColor: '#181818',
                          borderRadius: '4px',
                          border: '1px solid #333',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '6px',
                          }}
                        >
                          <input
                            disabled={isReadOnly}
                            type="text"
                            value={area.name}
                            style={{
                              width: '45%',
                              padding: '2px',
                              fontSize: '12px',
                              fontWeight: 'bold',
                              color: '#2ecc71',
                              backgroundColor: 'transparent',
                              border: 'none',
                              borderBottom: '1px solid #444',
                            }}
                            onChange={(e) => {
                              if (app) {
                                app.updateEquipmentArea(containerId, area.id, {
                                  name: e.target.value,
                                });
                                requestCommit(t('history.equipName'));
                                onUpdateStats();
                              }
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span
                              style={{ fontSize: '11px', color: isOverloaded ? '#e74c3c' : '#888' }}
                            >
                              {usedSpace} /{' '}
                              <input
                                disabled={isReadOnly}
                                type="number"
                                value={area.space}
                                style={{
                                  width: '36px',
                                  padding: '0',
                                  background: 'transparent',
                                  color: 'inherit',
                                  border: 'none',
                                  borderBottom: '1px solid #444',
                                }}
                                onChange={(e) => {
                                  if (app) {
                                    app.updateEquipmentArea(containerId, area.id, {
                                      space: Math.max(1, +e.target.value),
                                    });
                                    requestCommit(t('history.equipSpace'));
                                    onUpdateStats();
                                  }
                                }}
                              />
                            </span>
                            {!isReadOnly && !isFromPart && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (area.itemIds.length > 0) {
                                    alert(t('inspector.equipRemoveWarn'));
                                    return;
                                  }
                                  if (app) {
                                    app.removeEquipmentArea(containerId, area.id);
                                    requestCommit(t('history.equipRemove'));
                                    onUpdateStats();
                                  }
                                }}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: '#e74c3c',
                                  cursor: 'pointer',
                                  fontSize: '12px',
                                  padding: '0 2px',
                                }}
                                title="Удалить слот"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>

                        {isFromPart && (
                          <div
                            style={{
                              fontSize: '10px',
                              color: '#3498db',
                              marginBottom: '6px',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <span>Часть тела: {containerName}</span>
                            <button
                              type="button"
                              className="btn btn-sm"
                              style={{
                                padding: '1px 5px',
                                fontSize: '9px',
                                backgroundColor: '#2c3e50',
                                color: '#fff',
                              }}
                              onClick={() => pushPath(containerId, containerName)}
                            >
                              Перейти →
                            </button>
                          </div>
                        )}

                        <label
                          style={{
                            fontSize: '11px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          Тип слота:
                          <input
                            disabled={isReadOnly}
                            type="text"
                            value={area.type}
                            list="area_types_list"
                            style={{ width: '65%', padding: '2px 4px', fontSize: '11px' }}
                            onChange={(e) => {
                              if (app) {
                                app.updateEquipmentArea(containerId, area.id, {
                                  type: e.target.value,
                                });
                                requestCommit(t('history.equipType'));
                                onUpdateStats();
                              }
                            }}
                          />
                          <datalist id="area_types_list">
                            {STANDARD_EQUIPMENT_AREA_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {EQUIPMENT_AREA_TYPE_LABELS[t] || t}
                              </option>
                            ))}
                          </datalist>
                        </label>

                        <div
                          style={{
                            marginTop: '8px',
                            paddingTop: '8px',
                            borderTop: '1px solid #2a2a2a',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          {area.itemIds.length > 0 ? (
                            area.itemIds.map((itemId: string) => {
                              const it = world.getComponent(itemId, 'item');
                              const itWeight = calculateTotalEntityWeight(world, itemId);
                              return (
                                <button
                                  key={itemId}
                                  type="button"
                                  className="btn btn-sm"
                                  style={{
                                    width: '100%',
                                    backgroundColor: '#1e3d29',
                                    color: '#ecf0f1',
                                    textAlign: 'left',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                  }}
                                  onClick={() => pushPath(itemId, it?.name || itemId)}
                                >
                                  <span>{it ? it.name : itemId}</span>
                                  <span style={{ color: '#888' }}>
                                    V:{it?.size ?? 0} | {itWeight}kg
                                  </span>
                                </button>
                              );
                            })
                          ) : (
                            <span style={{ color: '#777', fontSize: '11px' }}>
                              {t('inspector.slotFree')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div style={{ color: '#777', fontSize: '11px', fontStyle: 'italic' }}>
                    {isCreatureOrAssembly
                      ? t('inspector.noPartEquip')
                      : t('inspector.noEquipAreas')}
                  </div>
                );
              })()}
            </>
          )}

          {/* Инвентарь (Сетка хранения) */}
          {(() => {
            let activeInv = inv;
            let bagName = '';
            if (!activeInv && currentArchetype === 'creature') {
              const equipped = getAllEquippedDescendants(world, targetId);
              for (const eqId of equipped) {
                const eqInv = world.getComponent(eqId, 'inventory');
                if (eqInv) {
                  activeInv = eqInv;
                  bagName = world.getComponent(eqId, 'item')?.name || 'Сумка';
                  break;
                }
              }
            }

            return renderSection(
              'inventory',
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <span>
                  {t('inspector.inventory')} {bagName ? `(${bagName})` : ''}
                </span>
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
                            onUpdateStats();
                          }
                        } else {
                          alert(t('inspector.invRemoveWarn'));
                        }
                      } else {
                        if (app) {
                          app.setEntityInventoryGrid(targetId, true);
                          requestCommit(t('history.gridAdd'));
                          onUpdateStats();
                        }
                      }
                    }}
                  >
                    {inv ? t('inspector.removeGrid') : t('inspector.addGrid')}
                  </button>
                )}
              </div>,
              <>
                {activeInv ? (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${activeInv.size.width}, 36px)`,
                      gap: '4px',
                      justifyContent: 'center',
                      backgroundColor: '#111',
                      padding: '8px',
                      borderRadius: '4px',
                    }}
                  >
                    {activeInv.slots.map((row, rIdx) =>
                      row.map((cell, cIdx) => {
                        const it = cell.itemId ? world.getComponent(cell.itemId, 'item') : null;
                        return (
                          <div
                            key={`${rIdx}_${cIdx}`}
                            onClick={() => {
                              if (cell.itemId) pushPath(cell.itemId, it?.name || 'Предмет');
                            }}
                            title={it ? `${it.name} (${it.type})` : 'Пустая ячейка'}
                            style={{
                              width: '36px',
                              height: '36px',
                              backgroundColor: it ? '#2980b9' : '#222',
                              border: '1px solid #444',
                              borderRadius: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: cell.itemId ? 'pointer' : 'default',
                              fontSize: '10px',
                              color: '#fff',
                              textAlign: 'center',
                              padding: '2px',
                              overflow: 'hidden',
                            }}
                          >
                            {it ? it.name.substring(0, 4) : ''}
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#777', fontSize: '11px', fontStyle: 'italic' }}>
                    {t('inspector.noInventory')}
                  </div>
                )}
              </>
            );
          })()}
        </form>

        {/* Кнопка удаления для корневой сущности инспектора */}
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
