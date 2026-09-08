import React, { useState, useEffect, useRef } from 'react';
import { World } from '../../ecs/World';
import { PhysicsSystem } from '../../ecs/systems/PhysicsSystem';
import { AISystem } from '../../ecs/systems/AISystem';
import {
  HitZoneType,
  HitZoneConfig,
  StandardRadius,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
  isValidStandardRadius,
} from '../../ecs/types';
import {
  MetaInspector,
  PhysicsInspector,
  HealthInspector,
  MovementInspector,
  StealthInspector,
  AIInspector,
} from '../inspector';
import { TriggerZoneInspector } from '../inspector/TriggerZoneInspector';
import {
  WeaponFormFields,
  ArmorFormFields,
  BagFormFields,
  WeaponFormValues,
} from './forms/FormFields';
import { DEFAULT_ZONE_PARAMS, ZoneTypeParams } from '../../Weapon';
import { deg2Rad, rad2Deg, Degrees } from '../../utils';
import { setBaseStat } from '../../ecs/stats/StatEvaluator';
import { killEntity } from '../../ecs/utils/health';

export interface UniversalEditModalProps {
  isOpen: boolean;
  entityId: string | null;
  world: World | null | undefined;
  physics: PhysicsSystem | null | undefined;
  aiSystem: AISystem | null | undefined;
  isReadOnly?: boolean;
  onClose: () => void;
  onConfirm: () => void;
  onInspectItem?: (itemId: string) => void;
}

export const UniversalEditModal: React.FC<UniversalEditModalProps> = ({
  isOpen,
  entityId,
  world,
  physics: _physics,
  aiSystem,
  isReadOnly,
  onClose,
  onConfirm,
  onInspectItem,
}) => {
  const [draftName, setDraftName] = useState('');
  const [draftPhysics, setDraftPhysics] = useState<{
    radius: number;
    weight: number;
    isSolid: boolean;
  }>({
    radius: 16,
    weight: 10,
    isSolid: true,
  });
  const [draftHealth, setDraftHealth] = useState<{ hp: number; maxHp: number } | null>(null);
  const [draftMovement, setDraftMovement] = useState<any | null>(null);
  const [draftStealth, setDraftStealth] = useState<any | null>(null);
  const [draftAI, setDraftAI] = useState<string | null>(null);
  const [draftZone, setDraftZone] = useState<any | null>(null);
  const [draftWeapon, setDraftWeapon] = useState<WeaponFormValues | null>(null);
  const [draftArmor, setDraftArmor] = useState<any | null>(null);
  const [draftBag, setDraftBag] = useState<any | null>(null);

  const zoneParamsMapRef = useRef<Record<HitZoneType, ZoneTypeParams>>({
    angle: { ...DEFAULT_ZONE_PARAMS.angle },
    radius: { ...DEFAULT_ZONE_PARAMS.radius },
    forward_line: { ...DEFAULT_ZONE_PARAMS.forward_line },
    shrapnel: { ...DEFAULT_ZONE_PARAMS.shrapnel },
  });

  useEffect(() => {
    if (!isOpen || !entityId || !world) return;

    const meta = world.getComponent(entityId, 'meta');
    const item = world.getComponent(entityId, 'item');
    setDraftName(meta?.name ?? item?.name ?? entityId);

    const physStats = world.getComponent(entityId, 'physicsStats');
    const physBody = world.getComponent(entityId, 'physicsBody');
    setDraftPhysics({
      radius: physStats?.radius.base ?? physBody?.body.r ?? 16,
      weight: physStats?.weight.base ?? 10,
      isSolid: physStats?.isSolid ?? (physBody ? physBody.mask !== 0 : true),
    });

    const health = world.getComponent(entityId, 'health');
    setDraftHealth(
      health ? { hp: Math.round(health.current), maxHp: Math.round(health.max.base) } : null
    );

    const moveStats = world.getComponent(entityId, 'movementStats');
    setDraftMovement(
      moveStats
        ? {
            maxSpeed: Math.round(moveStats.maxSpeed.base),
            maxTurnSpeed: Math.round(rad2Deg(moveStats.maxTurnSpeed.base)) as Degrees,
            runSpeedMultiplier: Math.round(moveStats.runSpeedMultiplier * 100) / 100,
            crouchSpeedMultiplier: Math.round(moveStats.crouchSpeedMultiplier * 100) / 100,
            walkSpeedMultiplier: Math.round((moveStats.walkSpeedMultiplier ?? 0.5) * 100) / 100,
            runTurnMultiplier: Math.round(moveStats.runTurnMultiplier * 100) / 100,
            crouchTurnMultiplier: Math.round(moveStats.crouchTurnMultiplier * 100) / 100,
            strafeSpeedMultiplier: Math.round((moveStats.strafeSpeedMultiplier ?? 0.8) * 100) / 100,
            backwardSpeedMultiplier:
              Math.round((moveStats.backwardSpeedMultiplier ?? 0.6) * 100) / 100,
            strafeTurnMultiplier: Math.round((moveStats.strafeTurnMultiplier ?? 0.8) * 100) / 100,
            backwardTurnMultiplier:
              Math.round((moveStats.backwardTurnMultiplier ?? 0.6) * 100) / 100,
          }
        : null
    );

    const stealthStats = world.getComponent(entityId, 'stealthStats');
    setDraftStealth(
      stealthStats
        ? {
            stealthPower: Math.round(stealthStats.stealthPower.base),
            crouchStealthMultiplier: Math.round(stealthStats.crouchStealthMultiplier * 100) / 100,
            runStealthMultiplier: Math.round(stealthStats.runStealthMultiplier * 100) / 100,
            walkStealthMultiplier:
              Math.round((stealthStats.walkStealthMultiplier ?? 1.3) * 100) / 100,
            turnInPlaceStealthMultiplier:
              Math.round((stealthStats.turnInPlaceStealthMultiplier ?? 1.5) * 100) / 100,
            immobileStealthMultiplier:
              Math.round((stealthStats.immobileStealthMultiplier ?? 2.0) * 100) / 100,
          }
        : null
    );

    const aiStats = world.getComponent(entityId, 'aiStats');
    setDraftAI(aiStats ? aiStats.behavior.current : null);

    const zTrigger = world.getComponent(entityId, 'zoneTrigger');
    setDraftZone(zTrigger ? { ...zTrigger } : null);

    const wStats = world.getComponent(entityId, 'weaponStats');
    const wZone = world.getComponent(entityId, 'weaponZone');
    if (wStats && wZone) {
      zoneParamsMapRef.current = {
        angle: { ...DEFAULT_ZONE_PARAMS.angle },
        radius: { ...DEFAULT_ZONE_PARAMS.radius },
        forward_line: { ...DEFAULT_ZONE_PARAMS.forward_line },
        shrapnel: { ...DEFAULT_ZONE_PARAMS.shrapnel },
      };
      if (wZone.hitZoneType) {
        zoneParamsMapRef.current[wZone.hitZoneType] = {
          length: wZone.length ?? DEFAULT_ZONE_PARAMS[wZone.hitZoneType].length,
          radius: wZone.radius ?? DEFAULT_ZONE_PARAMS[wZone.hitZoneType].radius,
          angle: wZone.angle ?? DEFAULT_ZONE_PARAMS[wZone.hitZoneType].angle,
          rayCount: wZone.rayCount ?? DEFAULT_ZONE_PARAMS[wZone.hitZoneType].rayCount,
          pierceObstacles:
            wZone.pierceObstacles ?? DEFAULT_ZONE_PARAMS[wZone.hitZoneType].pierceObstacles,
          pierceCreatures:
            wZone.pierceCreatures ?? DEFAULT_ZONE_PARAMS[wZone.hitZoneType].pierceCreatures,
          pierceItems: wZone.pierceItems ?? DEFAULT_ZONE_PARAMS[wZone.hitZoneType].pierceItems,
        };
      }

      setDraftWeapon({
        name: meta?.name ?? item?.name ?? 'Оружие',
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

    const aStats = world.getComponent(entityId, 'armorStats');
    setDraftArmor(
      aStats
        ? {
            name: meta?.name ?? item?.name ?? 'Броня',
            defense: aStats.defense.base,
            flatReduction: aStats.flatReduction.base,
          }
        : null
    );

    const inv = world.getComponent(entityId, 'inventory');
    setDraftBag(
      inv && item?.type === 'bag'
        ? {
            name: meta?.name ?? item.name,
            width: inv.size.width,
            height: inv.size.height,
          }
        : null
    );
  }, [isOpen, entityId, world]);

  if (!isOpen || !entityId || !world) return null;

  const handleZoneTypeChange = (newType: HitZoneType) => {
    if (!draftWeapon) return;
    zoneParamsMapRef.current[draftWeapon.hitZoneType] = {
      length: draftWeapon.length,
      radius: draftWeapon.radius,
      rayCount: draftWeapon.rayCount,
      angle: deg2Rad(draftWeapon.angle),
      pierceObstacles: draftWeapon.pierceObstacles,
      pierceCreatures: draftWeapon.pierceCreatures,
      pierceItems: draftWeapon.pierceItems,
    };

    const nextParams = zoneParamsMapRef.current[newType] || DEFAULT_ZONE_PARAMS[newType];
    setDraftWeapon({
      ...draftWeapon,
      hitZoneType: newType,
      length: nextParams.length,
      radius: nextParams.radius,
      rayCount: nextParams.rayCount,
      angle: Math.round(rad2Deg(nextParams.angle)) as Degrees,
      pierceObstacles: nextParams.pierceObstacles,
      pierceCreatures: nextParams.pierceCreatures,
      pierceItems: nextParams.pierceItems,
    });
  };

  const handleApply = () => {
    const archetype = world.getComponent(entityId, 'tag')?.archetype;

    // 1. Мета
    const meta = world.getComponent(entityId, 'meta');
    if (meta) meta.name = draftName;
    const item = world.getComponent(entityId, 'item');
    if (item) item.name = draftName;

    // 2. Физика
    const physStats = world.getComponent(entityId, 'physicsStats');
    const physBody = world.getComponent(entityId, 'physicsBody');

    if (physStats) {
      const targetWeight = draftPhysics.weight;
      const cleanWeight = Math.round(Math.max(0.1, targetWeight) * 10) / 10;

      let finalRadius = draftPhysics.radius;
      if (archetype === 'creature') {
        finalRadius = isValidStandardRadius(draftPhysics.radius)
          ? draftPhysics.radius
          : (16 as StandardRadius);
      }

      setBaseStat(physStats.radius, finalRadius);
      setBaseStat(physStats.weight, cleanWeight);
      physStats.isSolid = draftPhysics.isSolid;

      if (physBody) {
        physBody.body.r = finalRadius;
        physBody.mask = draftPhysics.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
      }
    }

    // 3. Здоровье
    if (draftHealth) {
      const health = world.getComponent(entityId, 'health');
      if (health) {
        setBaseStat(health.max, Math.max(1, draftHealth.maxHp));
        const targetHp = Math.min(health.max.current, Math.max(0, draftHealth.hp));
        health.current = targetHp;
        if (targetHp <= 0) {
          killEntity(world, entityId);
        } else {
          health.isAlive = true;
          const meta = world.getComponent(entityId, 'meta');
          if (meta && meta.movementMode === 'dead') {
            meta.movementMode = 'immobile';
          }
        }
      }
    }

    // 4. Движение
    if (draftMovement) {
      const moveStats = world.getComponent(entityId, 'movementStats');
      if (moveStats) {
        setBaseStat(moveStats.maxSpeed, Math.max(0, Math.round(draftMovement.maxSpeed)));
        setBaseStat(
          moveStats.maxTurnSpeed as any,
          deg2Rad(Math.max(0, Math.round(draftMovement.maxTurnSpeed)))
        );
        moveStats.runSpeedMultiplier =
          Math.round(Math.max(0.1, draftMovement.runSpeedMultiplier) * 100) / 100;
        moveStats.crouchSpeedMultiplier =
          Math.round(Math.max(0.1, draftMovement.crouchSpeedMultiplier) * 100) / 100;
        moveStats.walkSpeedMultiplier =
          Math.round(Math.max(0.1, draftMovement.walkSpeedMultiplier ?? 0.5) * 100) / 100;
        moveStats.runTurnMultiplier =
          Math.round(Math.max(0.1, draftMovement.runTurnMultiplier) * 100) / 100;
        moveStats.crouchTurnMultiplier =
          Math.round(Math.max(0.1, draftMovement.crouchTurnMultiplier) * 100) / 100;
        moveStats.strafeSpeedMultiplier =
          Math.round(Math.max(0.1, draftMovement.strafeSpeedMultiplier ?? 0.8) * 100) / 100;
        moveStats.backwardSpeedMultiplier =
          Math.round(Math.max(0.1, draftMovement.backwardSpeedMultiplier ?? 0.6) * 100) / 100;
        moveStats.strafeTurnMultiplier =
          Math.round(Math.max(0.1, draftMovement.strafeTurnMultiplier ?? 0.8) * 100) / 100;
        moveStats.backwardTurnMultiplier =
          Math.round(Math.max(0.1, draftMovement.backwardTurnMultiplier ?? 0.6) * 100) / 100;
      }
    }

    // 5. Скрытность
    if (draftStealth) {
      const stealthStats = world.getComponent(entityId, 'stealthStats');
      if (stealthStats) {
        setBaseStat(stealthStats.stealthPower, Math.max(0, Math.round(draftStealth.stealthPower)));
        stealthStats.crouchStealthMultiplier =
          Math.round(Math.max(1, draftStealth.crouchStealthMultiplier) * 100) / 100;
        stealthStats.runStealthMultiplier =
          Math.round(Math.max(0, draftStealth.runStealthMultiplier) * 100) / 100;
        stealthStats.walkStealthMultiplier =
          Math.round(Math.max(0, draftStealth.walkStealthMultiplier ?? 1.3) * 100) / 100;
        stealthStats.turnInPlaceStealthMultiplier =
          Math.round(Math.max(0, draftStealth.turnInPlaceStealthMultiplier ?? 1.5) * 100) / 100;
        stealthStats.immobileStealthMultiplier =
          Math.round(Math.max(0, draftStealth.immobileStealthMultiplier ?? 2.0) * 100) / 100;
      }
    }

    // 6. ИИ
    if (draftAI && aiSystem) {
      const aiStats = world.getComponent(entityId, 'aiStats');
      if (aiStats && aiStats.behavior.current !== draftAI) {
        aiStats.behavior.current = draftAI;
        aiStats.behavior.base = draftAI;
        aiSystem.initBotBrain(world, entityId, draftAI);
      }
    }

    // 7. Триггерная зона
    if (draftZone) {
      world.addComponent(entityId, 'zoneTrigger', { ...draftZone });
      if (physStats) {
        setBaseStat(physStats.radius, draftZone.radius);
      }
      if (physBody) {
        physBody.body.r = draftZone.radius;
      }
    }

    // 8. Оружие
    if (draftWeapon) {
      const wStats = world.getComponent(entityId, 'weaponStats');
      if (wStats) {
        setBaseStat(wStats.baseDamage, draftWeapon.baseDamage);
        setBaseStat(wStats.prepTime, draftWeapon.prepTime);
        setBaseStat(wStats.recoveryTime, draftWeapon.recoveryTime);
      }

      let newZone: HitZoneConfig;
      if (draftWeapon.hitZoneType === 'radius') {
        newZone = {
          hitZoneType: 'radius',
          radius: draftWeapon.radius,
          pierceObstacles: draftWeapon.pierceObstacles,
          pierceCreatures: draftWeapon.pierceCreatures,
          pierceItems: draftWeapon.pierceItems,
        };
      } else if (draftWeapon.hitZoneType === 'angle') {
        newZone = {
          hitZoneType: 'angle',
          length: draftWeapon.length,
          angle: deg2Rad(draftWeapon.angle),
          pierceObstacles: draftWeapon.pierceObstacles,
          pierceCreatures: draftWeapon.pierceCreatures,
          pierceItems: draftWeapon.pierceItems,
        };
      } else if (draftWeapon.hitZoneType === 'forward_line') {
        newZone = {
          hitZoneType: 'forward_line',
          length: draftWeapon.length,
          pierceObstacles: draftWeapon.pierceObstacles,
          pierceCreatures: draftWeapon.pierceCreatures,
          pierceItems: draftWeapon.pierceItems,
        };
      } else {
        newZone = {
          hitZoneType: 'shrapnel',
          length: draftWeapon.length,
          angle: deg2Rad(draftWeapon.angle),
          rayCount: draftWeapon.rayCount,
          pierceObstacles: draftWeapon.pierceObstacles,
          pierceCreatures: draftWeapon.pierceCreatures,
          pierceItems: draftWeapon.pierceItems,
        };
      }
      world.addComponent(entityId, 'weaponZone', newZone);
    }

    // 9. Броня
    if (draftArmor) {
      const aStats = world.getComponent(entityId, 'armorStats');
      if (aStats) {
        setBaseStat(aStats.defense, draftArmor.defense);
        setBaseStat(aStats.flatReduction, draftArmor.flatReduction);
      }
    }

    // 10. Сумка
    if (draftBag) {
      const inv = world.getComponent(entityId, 'inventory');
      if (inv) {
        const isEmpty = inv.slots.every((row) => row.every((c) => !c.itemId));
        if (isEmpty) {
          inv.size = { width: draftBag.width, height: draftBag.height };
          inv.slots = Array.from({ length: draftBag.height }, () =>
            Array.from({ length: draftBag.width }, () => ({ itemId: null, count: 0 }))
          );
        }
      }
    }

    onConfirm();
  };

  const inv = world.getComponent(entityId, 'inventory');
  const isBagEmpty = !inv || inv.slots.every((r) => r.every((c) => !c.itemId));

  const currentArchetype = world.getComponent(entityId, 'tag')?.archetype;
  const showPhysicsInspector = currentArchetype === 'creature' || currentArchetype === 'item';
  const isStandardRadiusOnly = currentArchetype === 'creature';

  return (
    <div
      className="modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal-dialog">
        <h3>{isReadOnly ? 'Просмотр сущности' : 'Редактировать сущность'}</h3>
        <p className="modal-subtitle">ID: {entityId}</p>
        <form className="modal-form" onSubmit={(e) => e.preventDefault()}>
          <MetaInspector name={draftName} onChange={setDraftName} isReadOnly={isReadOnly} />

          {showPhysicsInspector && (
            <PhysicsInspector
              values={draftPhysics}
              onChange={(patch) => setDraftPhysics((prev) => ({ ...prev, ...patch }))}
              isReadOnly={isReadOnly}
              isStandardRadiusOnly={isStandardRadiusOnly}
            />
          )}

          {draftHealth && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              <HealthInspector
                values={draftHealth}
                onChange={(patch) => setDraftHealth((prev: any) => ({ ...prev, ...patch }))}
                isReadOnly={isReadOnly}
              />
            </div>
          )}

          {draftMovement && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              <MovementInspector
                values={draftMovement}
                onChange={(patch) => setDraftMovement((prev: any) => ({ ...prev, ...patch }))}
                isReadOnly={isReadOnly}
              />
            </div>
          )}

          {draftStealth && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              <StealthInspector
                values={draftStealth}
                onChange={(patch) => setDraftStealth((prev: any) => ({ ...prev, ...patch }))}
                isReadOnly={isReadOnly}
              />
            </div>
          )}

          {draftAI && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              <AIInspector behavior={draftAI} onChange={setDraftAI} isReadOnly={isReadOnly} />
            </div>
          )}

          {draftZone && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              <TriggerZoneInspector
                values={draftZone}
                onChange={(patch) => setDraftZone((prev: any) => ({ ...prev, ...patch }))}
                isReadOnly={isReadOnly}
              />
            </div>
          )}

          {draftWeapon && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              <WeaponFormFields
                values={draftWeapon}
                onChange={(patch) =>
                  setDraftWeapon((prev) => (prev ? { ...prev, ...patch } : null))
                }
                onZoneTypeChange={handleZoneTypeChange}
                isReadOnly={isReadOnly}
              />
            </div>
          )}

          {draftArmor && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              <ArmorFormFields
                values={draftArmor}
                onChange={(patch) => setDraftArmor((prev: any) => ({ ...prev, ...patch }))}
                isReadOnly={isReadOnly}
              />
            </div>
          )}

          {draftBag && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              <BagFormFields
                values={draftBag}
                onChange={(patch) => setDraftBag((prev: any) => ({ ...prev, ...patch }))}
                isReadOnly={isReadOnly}
                isBagInventoryEmpty={isBagEmpty}
              />
            </div>
          )}
        </form>

        {inv && onInspectItem && (
          <div style={{ marginTop: '12px' }}>
            <h4 style={{ fontSize: '13px', color: '#bdc3c7', marginBottom: '8px' }}>
              Сетка инвентаря (кликните на предмет для настройки):
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${inv.size.width}, 38px)`,
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
              {inv.slots.map((row, rIdx) =>
                row.map((cell, cIdx) => {
                  const it = cell.itemId ? world.getComponent(cell.itemId, 'item') : null;
                  return (
                    <div
                      key={`${rIdx}_${cIdx}`}
                      onClick={() => {
                        if (cell.itemId) onInspectItem(cell.itemId);
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
                        cursor: cell.itemId ? 'pointer' : 'default',
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
            <button type="button" className="btn btn-primary" onClick={handleApply}>
              Применить
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
