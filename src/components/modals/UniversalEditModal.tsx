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
  const [draftDestructible, setDraftDestructible] = useState<boolean>(false);

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
    setDraftDestructible(meta?.destructible ?? false);

    const physStats = world.getComponent(entityId, 'physicsStats');
    const physBody = world.getComponent(entityId, 'physicsBody');
    setDraftPhysics({
      radius:
        physStats?.radius.base ??
        (physBody && 'r' in physBody.body ? (physBody.body as any).r : 16),
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
            maxSpeed: moveStats.maxSpeed.base,
            maxTurnSpeed: rad2Deg(moveStats.maxTurnSpeed.base) as Degrees,
            runSpeedMultiplier: moveStats.runSpeedMultiplier,
            crouchSpeedMultiplier: moveStats.crouchSpeedMultiplier,
            walkSpeedMultiplier: moveStats.walkSpeedMultiplier ?? 0.5,
            runTurnMultiplier: moveStats.runTurnMultiplier,
            crouchTurnMultiplier: moveStats.crouchTurnMultiplier,
            strafeSpeedMultiplier: moveStats.strafeSpeedMultiplier ?? 0.8,
            backwardSpeedMultiplier: moveStats.backwardSpeedMultiplier ?? 0.6,
            strafeTurnMultiplier: moveStats.strafeTurnMultiplier ?? 0.8,
            backwardTurnMultiplier: moveStats.backwardTurnMultiplier ?? 0.6,
            pickupSpeedMultiplier: moveStats.pickupSpeedMultiplier ?? 0.5,
            pickupTurnMultiplier: moveStats.pickupTurnMultiplier ?? 1.1,
          }
        : null
    );

    const stealthStats = world.getComponent(entityId, 'stealthStats');
    setDraftStealth(
      stealthStats
        ? {
            stealthPower: stealthStats.stealthPower.base,
            crouchStealthMultiplier: stealthStats.crouchStealthMultiplier,
            runStealthMultiplier: stealthStats.runStealthMultiplier,
            walkStealthMultiplier: stealthStats.walkStealthMultiplier ?? 1.3,
            turnInPlaceStealthMultiplier: stealthStats.turnInPlaceStealthMultiplier ?? 1.5,
            immobileStealthMultiplier: stealthStats.immobileStealthMultiplier ?? 2.0,
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
        size: item?.size ?? 10,
        equipType: item?.equipType ?? null,
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

    const aStats = world.getComponent(entityId, 'armorStats');
    setDraftArmor(
      aStats
        ? {
            name: meta?.name ?? item?.name ?? 'Броня',
            size: item?.size ?? 20,
            equipType: item?.equipType ?? 'torso',
            equippable: item?.equippable ?? true,
            equipTimeMultiplier: item?.equipTimeMultiplier ?? 1.0,
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
            size: item?.size ?? 10,
            equipType: item?.equipType ?? 'torso',
            equippable: item?.equippable ?? true,
            equipTimeMultiplier: item?.equipTimeMultiplier ?? 1.0,
            width: inv.size.width,
            height: inv.size.height,
          }
        : null
    );
  }, [isOpen, entityId, world]);

  if (!isOpen || !entityId || !world) return null;

  const currentArchetype = world.getComponent(entityId, 'tag')?.archetype;
  const currentItem = world.getComponent(entityId, 'item');

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
    if (meta) {
      meta.name = draftName;
      if (archetype === 'obstacle') {
        meta.destructible = draftDestructible;
      }
    }
    const item = world.getComponent(entityId, 'item');
    if (item) {
      item.name = draftName;
      if (draftWeapon) {
        item.size = draftWeapon.size;
        item.equipType = draftWeapon.equipType;
        item.equippable = draftWeapon.equippable;
        item.equipTimeMultiplier = draftWeapon.equipTimeMultiplier;
      } else if (draftArmor) {
        item.size = draftArmor.size;
        item.equipType = draftArmor.equipType;
        item.equippable = draftArmor.equippable;
        item.equipTimeMultiplier = draftArmor.equipTimeMultiplier;
      } else if (draftBag) {
        item.size = draftBag.size;
        item.equipType = draftBag.equipType;
        item.equippable = draftBag.equippable;
        item.equipTimeMultiplier = draftBag.equipTimeMultiplier;
      }
    }

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
        if ('r' in physBody.body) {
          (physBody.body as any).r = finalRadius;
        }
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
        }
      }
    }

    // 4. Движение
    if (draftMovement) {
      const moveStats = world.getComponent(entityId, 'movementStats');
      if (moveStats) {
        setBaseStat(moveStats.maxSpeed, Math.max(0, draftMovement.maxSpeed));
        setBaseStat(moveStats.maxTurnSpeed, deg2Rad(Math.max(0, draftMovement.maxTurnSpeed)));
        moveStats.runSpeedMultiplier = Math.max(0.1, draftMovement.runSpeedMultiplier);
        moveStats.crouchSpeedMultiplier = Math.max(0.1, draftMovement.crouchSpeedMultiplier);
        moveStats.walkSpeedMultiplier = Math.max(0.1, draftMovement.walkSpeedMultiplier ?? 0.5);
        moveStats.runTurnMultiplier = Math.max(0.1, draftMovement.runTurnMultiplier);
        moveStats.crouchTurnMultiplier = Math.max(0.1, draftMovement.crouchTurnMultiplier);
        moveStats.strafeSpeedMultiplier = Math.max(0.1, draftMovement.strafeSpeedMultiplier ?? 0.8);
        moveStats.backwardSpeedMultiplier = Math.max(
          0.1,
          draftMovement.backwardSpeedMultiplier ?? 0.6
        );
        moveStats.strafeTurnMultiplier = Math.max(0.1, draftMovement.strafeTurnMultiplier ?? 0.8);
        moveStats.backwardTurnMultiplier = Math.max(
          0.1,
          draftMovement.backwardTurnMultiplier ?? 0.6
        );
        moveStats.pickupSpeedMultiplier = Math.max(0.1, draftMovement.pickupSpeedMultiplier ?? 0.5);
        moveStats.pickupTurnMultiplier = Math.max(0.1, draftMovement.pickupTurnMultiplier ?? 1.1);
      }
    }

    // 5. Скрытность
    if (draftStealth) {
      const stealthStats = world.getComponent(entityId, 'stealthStats');
      if (stealthStats) {
        setBaseStat(stealthStats.stealthPower, Math.max(0, draftStealth.stealthPower));
        stealthStats.crouchStealthMultiplier = Math.max(1, draftStealth.crouchStealthMultiplier);
        stealthStats.runStealthMultiplier = Math.max(0, draftStealth.runStealthMultiplier);
        stealthStats.walkStealthMultiplier = Math.max(0, draftStealth.walkStealthMultiplier ?? 1.3);
        stealthStats.turnInPlaceStealthMultiplier = Math.max(
          0,
          draftStealth.turnInPlaceStealthMultiplier ?? 1.5
        );
        stealthStats.immobileStealthMultiplier = Math.max(
          0,
          draftStealth.immobileStealthMultiplier ?? 2.0
        );
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
      if (physBody && 'r' in physBody.body) {
        (physBody.body as any).r = draftZone.radius;
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

          {currentArchetype === 'obstacle' && (
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
              Разрушаемое препятствие
            </label>
          )}

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

          {draftArmor && currentItem && (
            <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #333' }}>
              <ArmorFormFields
                values={draftArmor}
                onChange={(patch) => setDraftArmor((prev: any) => ({ ...prev, ...patch }))}
                isReadOnly={isReadOnly}
              />
            </div>
          )}

          {draftArmor && currentArchetype === 'creature' && (
            <div
              style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #333',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <h4 style={{ margin: '4px 0', fontSize: '13px', color: '#bdc3c7' }}>
                Собственная броня существа
              </h4>
              <label>
                Защита (defense):
                <input
                  disabled={isReadOnly}
                  type="number"
                  value={draftArmor.defense ?? 0}
                  min={0}
                  max={100}
                  onChange={(e) =>
                    setDraftArmor((prev: any) => ({ ...prev, defense: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                Поглощение урона (flat reduction):
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
