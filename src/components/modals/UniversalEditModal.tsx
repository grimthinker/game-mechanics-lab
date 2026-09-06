import React, { useState, useEffect } from 'react';
import { World } from '../../ecs/World';
import { PhysicsSystem } from '../../ecs/systems/PhysicsSystem';
import { AISystem } from '../../ecs/systems/AISystem';
import {
  HitZoneType,
  HitZoneConfig,
  StandardRadius,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
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
import { DEFAULT_ZONE_PARAMS } from '../../Weapon';
import { weaponModalState } from './weaponModalState';
import { deg2Rad, rad2Deg, Degrees } from '../../utils';

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
  physics,
  aiSystem,
  isReadOnly,
  onClose,
  onConfirm,
  onInspectItem,
}) => {
  const [draftName, setDraftName] = useState('');
  const [draftPhysics, setDraftPhysics] = useState<{ radius: StandardRadius; weight: number; isSolid: boolean }>({
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

  useEffect(() => {
    if (!isOpen || !entityId || !world) return;

    const meta = world.getComponent(entityId, 'meta');
    const item = world.getComponent(entityId, 'item');
    setDraftName(meta?.name ?? item?.name ?? entityId);

    const physStats = world.getComponent(entityId, 'physicsStats');
    const physBody = world.getComponent(entityId, 'physicsBody');
    setDraftPhysics({
      radius: (physStats?.radius.current ?? physBody?.body.r ?? 16) as StandardRadius,
      weight: physStats?.weight.current ?? 10,
      isSolid: physStats?.isSolid.current ?? (physBody ? physBody.mask !== 0 : true),
    });

    const healthStats = world.getComponent(entityId, 'healthStats');
    setDraftHealth(
      healthStats
        ? { hp: Math.round(healthStats.hp.current), maxHp: healthStats.maxHp.current }
        : null
    );

    const moveStats = world.getComponent(entityId, 'movementStats');
    setDraftMovement(
      moveStats
        ? {
            maxSpeed: Math.round(moveStats.maxSpeed.current),
            maxTurnSpeed: Math.round(rad2Deg(moveStats.maxTurnSpeed.current)) as Degrees,
            runSpeedMultiplier: Math.round(moveStats.runSpeedMultiplier.current * 100) / 100,
            crouchSpeedMultiplier: Math.round(moveStats.crouchSpeedMultiplier.current * 100) / 100,
            runTurnMultiplier: Math.round(moveStats.runTurnMultiplier.current * 100) / 100,
            crouchTurnMultiplier: Math.round(moveStats.crouchTurnMultiplier.current * 100) / 100,
          }
        : null
    );

    const stealthStats = world.getComponent(entityId, 'stealthStats');
    setDraftStealth(
      stealthStats
        ? {
            stealthPower: Math.round(stealthStats.stealthPower.current),
            crouchStealthMultiplier: Math.round(stealthStats.crouchStealthMultiplier.current * 100) / 100,
            runStealthMultiplier: Math.round(stealthStats.runStealthMultiplier.current * 100) / 100,
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
      setDraftWeapon({
        name: meta?.name ?? item?.name ?? 'Оружие',
        weight: physStats?.weight.current ?? 1,
        baseDamage: wStats.baseDamage.current,
        prepTime: wStats.prepTime.current,
        recoveryTime: wStats.recoveryTime.current,
        length: wZone.length ?? 150,
        radius: wZone.radius ?? 50,
        rayCount: wZone.rayCount ?? 5,
        angle: wZone.angle !== undefined ? (Math.round(rad2Deg(wZone.angle)) as Degrees) : (30 as Degrees),
        pierceObstacles: !!wZone.pierceObstacles,
        piercePlayers: !!wZone.piercePlayers,
        pierceBots: !!wZone.pierceBots,
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
            weight: physStats?.weight.current ?? 1,
            defense: aStats.defense.current,
            flatReduction: aStats.flatReduction.current,
          }
        : null
    );

    const inv = world.getComponent(entityId, 'inventory');
    setDraftBag(
      inv && item?.type === 'bag'
        ? {
            name: meta?.name ?? item.name,
            weight: physStats?.weight.current ?? 1,
            width: inv.size.width,
            height: inv.size.height,
          }
        : null
    );
  }, [isOpen, entityId, world]);

  if (!isOpen || !entityId || !world) return null;

  const handleZoneTypeChange = (newType: HitZoneType) => {
    if (!draftWeapon) return;
    weaponModalState.zoneParamsMap[draftWeapon.hitZoneType] = {
      length: draftWeapon.length,
      radius: draftWeapon.radius,
      rayCount: draftWeapon.rayCount,
      angle: deg2Rad(draftWeapon.angle),
      pierceObstacles: draftWeapon.pierceObstacles,
      piercePlayers: draftWeapon.piercePlayers,
      pierceBots: draftWeapon.pierceBots,
    };

    const nextParams = weaponModalState.zoneParamsMap[newType] || DEFAULT_ZONE_PARAMS[newType];
    setDraftWeapon({
      ...draftWeapon,
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

  const handleApply = () => {
    // 1. Мета
    const meta = world.getComponent(entityId, 'meta');
    if (meta) meta.name = draftName;
    const item = world.getComponent(entityId, 'item');
    if (item) item.name = draftName;

    // 2. Физика
    const physStats = world.getComponent(entityId, 'physicsStats');
    if (physStats) {
      const cleanWeight = Math.round(Math.max(0.1, draftPhysics.weight) * 10) / 10;
      physStats.radius.current = draftPhysics.radius;
      physStats.radius.base = draftPhysics.radius;
      physStats.weight.current = cleanWeight;
      physStats.weight.base = cleanWeight;
      physStats.isSolid.current = draftPhysics.isSolid;
      physStats.isSolid.base = draftPhysics.isSolid;
    }

    const physBody = world.getComponent(entityId, 'physicsBody');
    if (physBody) {
      physBody.body.r = draftPhysics.radius;
      physBody.mask = draftPhysics.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
      (physBody.body as any).mask = physBody.mask;
    }

    // 3. Здоровье
    if (draftHealth) {
      const healthStats = world.getComponent(entityId, 'healthStats');
      const health = world.getComponent(entityId, 'health');
      if (healthStats) {
        healthStats.maxHp.current = Math.max(1, draftHealth.maxHp);
        healthStats.maxHp.base = Math.max(1, draftHealth.maxHp);
        healthStats.hp.current = Math.min(healthStats.maxHp.current, Math.max(0, draftHealth.hp));
        healthStats.hp.base = healthStats.hp.current;
        if (health) health.isAlive = healthStats.hp.current > 0;
      }
    }

    // 4. Движение
    if (draftMovement) {
        const moveStats = world.getComponent(entityId, 'movementStats');
        if (moveStats) {
          moveStats.maxSpeed.current = Math.max(0, Math.round(draftMovement.maxSpeed));
          moveStats.maxSpeed.base = moveStats.maxSpeed.current;
          moveStats.maxTurnSpeed.current = deg2Rad(Math.max(0, Math.round(draftMovement.maxTurnSpeed)));
          moveStats.maxTurnSpeed.base = moveStats.maxTurnSpeed.current;
          moveStats.runSpeedMultiplier.current = Math.round(Math.max(0.1, draftMovement.runSpeedMultiplier) * 100) / 100;
          moveStats.runSpeedMultiplier.base = moveStats.runSpeedMultiplier.current;
          moveStats.crouchSpeedMultiplier.current = Math.round(Math.max(0.1, draftMovement.crouchSpeedMultiplier) * 100) / 100;
          moveStats.crouchSpeedMultiplier.base = moveStats.crouchSpeedMultiplier.current;
          moveStats.runTurnMultiplier.current = Math.round(Math.max(0.1, draftMovement.runTurnMultiplier) * 100) / 100;
          moveStats.runTurnMultiplier.base = moveStats.runTurnMultiplier.current;
          moveStats.crouchTurnMultiplier.current = Math.round(Math.max(0.1, draftMovement.crouchTurnMultiplier) * 100) / 100;
          moveStats.crouchTurnMultiplier.base = moveStats.crouchTurnMultiplier.current;
        }
      }
  
      // 5. Скрытность
      if (draftStealth) {
        const stealthStats = world.getComponent(entityId, 'stealthStats');
        if (stealthStats) {
          stealthStats.stealthPower.current = Math.max(0, Math.round(draftStealth.stealthPower));
          stealthStats.stealthPower.base = stealthStats.stealthPower.current;
          stealthStats.crouchStealthMultiplier.current = Math.round(Math.max(1, draftStealth.crouchStealthMultiplier) * 100) / 100;
          stealthStats.crouchStealthMultiplier.base = stealthStats.crouchStealthMultiplier.current;
          stealthStats.runStealthMultiplier.current = Math.round(Math.max(0, draftStealth.runStealthMultiplier) * 100) / 100;
          stealthStats.runStealthMultiplier.base = stealthStats.runStealthMultiplier.current;
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
        if (physBody) {
          physBody.body.r = draftZone.radius;
        }
      }
  
      // 8. Оружие
      if (draftWeapon) {
      const wStats = world.getComponent(entityId, 'weaponStats');
      if (wStats) {
        wStats.baseDamage.current = draftWeapon.baseDamage;
        wStats.baseDamage.base = draftWeapon.baseDamage;
        wStats.prepTime.current = draftWeapon.prepTime;
        wStats.prepTime.base = draftWeapon.prepTime;
        wStats.recoveryTime.current = draftWeapon.recoveryTime;
        wStats.recoveryTime.base = draftWeapon.recoveryTime;
      }

      let newZone: HitZoneConfig;
      if (draftWeapon.hitZoneType === 'radius') {
        newZone = { hitZoneType: 'radius', radius: draftWeapon.radius };
      } else if (draftWeapon.hitZoneType === 'angle') {
        newZone = { hitZoneType: 'angle', length: draftWeapon.length, angle: deg2Rad(draftWeapon.angle) };
      } else if (draftWeapon.hitZoneType === 'forward_line') {
        newZone = {
          hitZoneType: 'forward_line',
          length: draftWeapon.length,
          pierceObstacles: draftWeapon.pierceObstacles,
          piercePlayers: draftWeapon.piercePlayers,
          pierceBots: draftWeapon.pierceBots,
        };
      } else {
        newZone = {
          hitZoneType: 'shrapnel',
          length: draftWeapon.length,
          angle: deg2Rad(draftWeapon.angle),
          rayCount: draftWeapon.rayCount,
          pierceObstacles: draftWeapon.pierceObstacles,
          piercePlayers: draftWeapon.piercePlayers,
          pierceBots: draftWeapon.pierceBots,
        };
      }
      world.addComponent(entityId, 'weaponZone', newZone);
    }

    // 8. Броня
    if (draftArmor) {
      const aStats = world.getComponent(entityId, 'armorStats');
      if (aStats) {
        aStats.defense.current = draftArmor.defense;
        aStats.defense.base = draftArmor.defense;
        aStats.flatReduction.current = draftArmor.flatReduction;
        aStats.flatReduction.base = draftArmor.flatReduction;
      }
    }

    // 9. Сумка
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

          <PhysicsInspector
            values={draftPhysics}
            onChange={(patch) => setDraftPhysics((prev) => ({ ...prev, ...patch }))}
            isReadOnly={isReadOnly}
          />

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
                onChange={(patch) => setDraftWeapon((prev) => (prev ? { ...prev, ...patch } : null))}
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