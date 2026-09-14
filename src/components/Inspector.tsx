import React, { useState, useEffect, useRef, useCallback } from 'react';
import { World } from '../ecs/World';
import { PhysicsSystem } from '../ecs/systems/PhysicsSystem';
import { AISystem } from '../ecs/systems/AISystem';
import { GameMode, THEME_COLORS } from '../constants';
import { setBaseStat } from '../ecs/stats/StatEvaluator';
import { killEntity } from '../ecs/utils/health';
import {
  HitZoneType,
  HitZoneConfig,
  StandardRadius,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
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
import { deg2Rad, rad2Deg, Degrees } from '../utils';
import { AIInspector } from './inspector/AIInspector';
import { HealthInspector } from './inspector/HealthInspector';
import { MetaInspector } from './inspector/MetaInspector';
import { MovementInspector } from './inspector/MovementInspector';
import { PhysicsInspector } from './inspector/PhysicsInspector';
import { StealthInspector } from './inspector/StealthInspector';
import { calculateTotalEntityWeight, getAnatomyParts } from '../ecs/utils/hierarchy';

interface Breadcrumb {
  id: string;
  label: string;
}

export interface InspectorProps {
  mode: GameMode;
  selectedEntityId: string | null;
  world: World | null | undefined;
  physics: PhysicsSystem | null | undefined;
  aiSystem: AISystem | null | undefined;
  onCommitHistory: (description: string) => void;
  onUpdateStats: () => void;
  handleDeleteEntity: () => void;
}

const summaryStyle: React.CSSProperties = {
  padding: '10px 12px',
  backgroundColor: '#2a2a2a',
  color: '#ecf0f1',
  fontWeight: 'bold',
  cursor: 'pointer',
  userSelect: 'none',
  borderBottom: '1px solid #1a1a1a',
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: '13px',
};

const contentStyle: React.CSSProperties = {
  padding: '12px',
  backgroundColor: '#222',
  borderBottom: '1px solid #111',
};

export const Inspector: React.FC<InspectorProps> = ({
  mode,
  selectedEntityId,
  world,
  physics: _physics,
  aiSystem,
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
      // Если кликнули по уже открытой сущности — ничего не делаем
      if (prev.length > 0 && prev[prev.length - 1].id === id) {
        return prev;
      }
      // Если сущность уже есть в цепочке навигации — возвращаемся к ней (срезаем путь)
      const existingIndex = prev.findIndex((crumb) => crumb.id === id);
      if (existingIndex !== -1) {
        return prev.slice(0, existingIndex + 1);
      }
      // Иначе добавляем новый шаг в историю
      return [...prev, { id, label }];
    });
  };

  const popPath = (index: number) => {
    setPath((prev) => prev.slice(0, index + 1));
  };

  // --- Система Debounce для Истории ---
  const commitTimerRef = useRef<any>(null);
  const requestCommit = useCallback(
    (desc: string) => {
      if (commitTimerRef.current) clearTimeout(commitTimerRef.current);
      commitTimerRef.current = setTimeout(() => {
        onCommitHistory(desc);
      }, 400);
    },
    [onCommitHistory]
  );

  // --- Состояние Draft (Текущие значения полей) ---
  const [draftName, setDraftName] = useState('');
  const [draftDestructible, setDraftDestructible] = useState(false);
  const [draftPhysics, setDraftPhysics] = useState<any>(null);
  const [draftHealth, setDraftHealth] = useState<any>(null);
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
            runTurnMultiplier: moveStats.runTurnMultiplier,
            crouchTurnMultiplier: moveStats.crouchTurnMultiplier,
            proneTurnMultiplier: moveStats.proneTurnMultiplier ?? 0.3,
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

  // --- Автоматическая синхронизация Draft -> ECS ---

  useEffect(() => {
    if (!targetId || !world || isReadOnly) return;
    let changed = false;
    const meta = world.getComponent(targetId, 'meta');
    const item = world.getComponent(targetId, 'item');
    if (meta && meta.name !== draftName) {
      meta.name = draftName;
      changed = true;
    }
    if (item && item.name !== draftName) {
      item.name = draftName;
      changed = true;
    }
    if (meta && meta.destructible !== draftDestructible) {
      meta.destructible = draftDestructible;
      changed = true;
    }
    if (changed) {
      requestCommit('Изменение имени');
      onUpdateStats();
    }
  }, [draftName, draftDestructible]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftPhysics) return;
    let changed = false;
    const physStats = world.getComponent(targetId, 'physicsStats');
    const physBody = world.getComponent(targetId, 'physicsBody');
    if (physStats) {
      if (physStats.radius.base !== draftPhysics.radius) {
        setBaseStat(physStats.radius, draftPhysics.radius);
        if (physBody && 'r' in physBody.body) (physBody.body as any).r = draftPhysics.radius;
        changed = true;
      }
      if (physStats.weight.base !== draftPhysics.weight) {
        setBaseStat(physStats.weight, draftPhysics.weight);
        changed = true;
      }
      if (physStats.isSolid !== draftPhysics.isSolid) {
        physStats.isSolid = draftPhysics.isSolid;
        if (physBody)
          physBody.mask = draftPhysics.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
        changed = true;
      }
    }
    if (changed) {
      requestCommit('Изменение физики');
      onUpdateStats();
    }
  }, [draftPhysics]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftHealth) return;
    let changed = false;
    const health = world.getComponent(targetId, 'health');
    if (health) {
      if (health.max.base !== draftHealth.maxHp) {
        setBaseStat(health.max, Math.max(1, draftHealth.maxHp));
        changed = true;
      }
      if (health.current !== draftHealth.hp) {
        health.current = Math.min(health.max.current, Math.max(0, draftHealth.hp));
        if (health.current <= 0) killEntity(world, targetId);
        else health.isAlive = true;
        changed = true;
      }
    }
    if (changed) {
      requestCommit('Изменение здоровья');
      onUpdateStats();
    }
  }, [draftHealth]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftMovement) return;
    let changed = false;
    const ms = world.getComponent(targetId, 'movementStats');
    if (ms) {
      const draftTurn = deg2Rad(draftMovement.maxTurnSpeed);
      if (ms.maxSpeed.base !== draftMovement.maxSpeed) {
        setBaseStat(ms.maxSpeed, draftMovement.maxSpeed);
        changed = true;
      }
      if (ms.maxTurnSpeed.base !== draftTurn) {
        setBaseStat(ms.maxTurnSpeed, draftTurn);
        changed = true;
      }
      if (ms.runSpeedMultiplier !== draftMovement.runSpeedMultiplier) {
        ms.runSpeedMultiplier = draftMovement.runSpeedMultiplier;
        changed = true;
      }
      if (ms.crouchSpeedMultiplier !== draftMovement.crouchSpeedMultiplier) {
        ms.crouchSpeedMultiplier = draftMovement.crouchSpeedMultiplier;
        changed = true;
      }
      if (ms.proneSpeedMultiplier !== draftMovement.proneSpeedMultiplier) {
        ms.proneSpeedMultiplier = draftMovement.proneSpeedMultiplier;
        changed = true;
      }
      if (ms.walkSpeedMultiplier !== draftMovement.walkSpeedMultiplier) {
        ms.walkSpeedMultiplier = draftMovement.walkSpeedMultiplier;
        changed = true;
      }
      if (ms.runTurnMultiplier !== draftMovement.runTurnMultiplier) {
        ms.runTurnMultiplier = draftMovement.runTurnMultiplier;
        changed = true;
      }
      if (ms.crouchTurnMultiplier !== draftMovement.crouchTurnMultiplier) {
        ms.crouchTurnMultiplier = draftMovement.crouchTurnMultiplier;
        changed = true;
      }
      if (ms.proneTurnMultiplier !== draftMovement.proneTurnMultiplier) {
        ms.proneTurnMultiplier = draftMovement.proneTurnMultiplier;
        changed = true;
      }
      if (ms.standToCrouchTime && ms.standToCrouchTime.base !== draftMovement.standToCrouchTime) {
        setBaseStat(ms.standToCrouchTime, draftMovement.standToCrouchTime);
        changed = true;
      }
      if (ms.crouchToStandTime && ms.crouchToStandTime.base !== draftMovement.crouchToStandTime) {
        setBaseStat(ms.crouchToStandTime, draftMovement.crouchToStandTime);
        changed = true;
      }
      if (ms.standToProneTime && ms.standToProneTime.base !== draftMovement.standToProneTime) {
        setBaseStat(ms.standToProneTime, draftMovement.standToProneTime);
        changed = true;
      }
      if (ms.proneToStandTime && ms.proneToStandTime.base !== draftMovement.proneToStandTime) {
        setBaseStat(ms.proneToStandTime, draftMovement.proneToStandTime);
        changed = true;
      }
      if (ms.crouchToProneTime && ms.crouchToProneTime.base !== draftMovement.crouchToProneTime) {
        setBaseStat(ms.crouchToProneTime, draftMovement.crouchToProneTime);
        changed = true;
      }
      if (ms.proneToCrouchTime && ms.proneToCrouchTime.base !== draftMovement.proneToCrouchTime) {
        setBaseStat(ms.proneToCrouchTime, draftMovement.proneToCrouchTime);
        changed = true;
      }
      if (ms.strafeSpeedMultiplier !== draftMovement.strafeSpeedMultiplier) {
        ms.strafeSpeedMultiplier = draftMovement.strafeSpeedMultiplier;
        changed = true;
      }
      if (ms.backwardSpeedMultiplier !== draftMovement.backwardSpeedMultiplier) {
        ms.backwardSpeedMultiplier = draftMovement.backwardSpeedMultiplier;
        changed = true;
      }
      if (ms.strafeTurnMultiplier !== draftMovement.strafeTurnMultiplier) {
        ms.strafeTurnMultiplier = draftMovement.strafeTurnMultiplier;
        changed = true;
      }
      if (ms.backwardTurnMultiplier !== draftMovement.backwardTurnMultiplier) {
        ms.backwardTurnMultiplier = draftMovement.backwardTurnMultiplier;
        changed = true;
      }
      if (ms.pickupSpeedMultiplier !== draftMovement.pickupSpeedMultiplier) {
        ms.pickupSpeedMultiplier = draftMovement.pickupSpeedMultiplier;
        changed = true;
      }
      if (ms.pickupTurnMultiplier !== draftMovement.pickupTurnMultiplier) {
        ms.pickupTurnMultiplier = draftMovement.pickupTurnMultiplier;
        changed = true;
      }
    }
    if (changed) {
      requestCommit('Изменение параметров движения');
      onUpdateStats();
    }
  }, [draftMovement]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftStealth) return;
    let changed = false;
    const st = world.getComponent(targetId, 'stealthStats');
    if (st) {
      if (st.stealthPower.base !== draftStealth.stealthPower) {
        setBaseStat(st.stealthPower, draftStealth.stealthPower);
        changed = true;
      }
      if (st.crouchStealthMultiplier !== draftStealth.crouchStealthMultiplier) {
        st.crouchStealthMultiplier = draftStealth.crouchStealthMultiplier;
        changed = true;
      }
      if (st.proneStealthMultiplier !== draftStealth.proneStealthMultiplier) {
        st.proneStealthMultiplier = draftStealth.proneStealthMultiplier;
        changed = true;
      }
      if (st.runStealthMultiplier !== draftStealth.runStealthMultiplier) {
        st.runStealthMultiplier = draftStealth.runStealthMultiplier;
        changed = true;
      }
      if (st.walkStealthMultiplier !== draftStealth.walkStealthMultiplier) {
        st.walkStealthMultiplier = draftStealth.walkStealthMultiplier;
        changed = true;
      }
      if (st.turnInPlaceStealthMultiplier !== draftStealth.turnInPlaceStealthMultiplier) {
        st.turnInPlaceStealthMultiplier = draftStealth.turnInPlaceStealthMultiplier;
        changed = true;
      }
      if (st.immobileStealthMultiplier !== draftStealth.immobileStealthMultiplier) {
        st.immobileStealthMultiplier = draftStealth.immobileStealthMultiplier;
        changed = true;
      }
    }
    if (changed) {
      requestCommit('Изменение скрытности');
      onUpdateStats();
    }
  }, [draftStealth]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftAI || !aiSystem) return;
    const aiStats = world.getComponent(targetId, 'aiStats');
    if (aiStats && aiStats.behavior.current !== draftAI) {
      aiStats.behavior.current = draftAI;
      aiStats.behavior.base = draftAI;
      aiSystem.initBotBrain(world, targetId, draftAI);
      requestCommit('Изменение поведения AI');
      onUpdateStats();
    }
  }, [draftAI]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftZone) return;
    let changed = false;
    const effector = world.getComponent(targetId, 'areaEffector');
    const physStats = world.getComponent(targetId, 'physicsStats');
    const physBody = world.getComponent(targetId, 'physicsBody');
    if (effector) {
      Object.assign(effector, draftZone);
      if (physStats && physStats.radius.base !== draftZone.radius) {
        setBaseStat(physStats.radius, draftZone.radius);
      }
      if (physBody && 'r' in physBody.body) {
        (physBody.body as any).r = draftZone.radius;
      }
      changed = true;
    }
    if (changed) {
      requestCommit('Настройка зоны эффектора');
      onUpdateStats();
    }
  }, [draftZone]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftWeapon) return;
    let changed = false;
    const item = world.getComponent(targetId, 'item');
    const wStats = world.getComponent(targetId, 'weaponStats');
    const wZone = world.getComponent(targetId, 'weaponZone');

    if (item && item.type === 'weapon') {
      if (item.size !== draftWeapon.size) {
        item.size = draftWeapon.size;
        changed = true;
      }
      if (JSON.stringify(item.equipTypes) !== JSON.stringify(draftWeapon.equipTypes)) {
        item.equipTypes = draftWeapon.equipTypes ? [...draftWeapon.equipTypes] : [];
        changed = true;
      }
      if (item.equippable !== draftWeapon.equippable) {
        item.equippable = draftWeapon.equippable;
        changed = true;
      }
      if (item.equipTimeMultiplier !== draftWeapon.equipTimeMultiplier) {
        item.equipTimeMultiplier = draftWeapon.equipTimeMultiplier;
        changed = true;
      }
    }

    if (wStats) {
      if (wStats.baseDamage.base !== draftWeapon.baseDamage) {
        setBaseStat(wStats.baseDamage, draftWeapon.baseDamage);
        changed = true;
      }
      if (wStats.prepTime.base !== draftWeapon.prepTime) {
        setBaseStat(wStats.prepTime, draftWeapon.prepTime);
        changed = true;
      }
      if (wStats.recoveryTime.base !== draftWeapon.recoveryTime) {
        setBaseStat(wStats.recoveryTime, draftWeapon.recoveryTime);
        changed = true;
      }
    }

    if (wZone) {
      wZone.hitZoneType = draftWeapon.hitZoneType;
      wZone.radius = draftWeapon.radius;
      wZone.length = draftWeapon.length;
      wZone.angle = deg2Rad(draftWeapon.angle);
      wZone.rayCount = draftWeapon.rayCount;
      wZone.pierceObstacles = draftWeapon.pierceObstacles;
      wZone.pierceCreatures = draftWeapon.pierceCreatures;
      wZone.pierceItems = draftWeapon.pierceItems;
      changed = true;
    }

    if (changed) {
      requestCommit('Изменение параметров оружия');
      onUpdateStats();
    }
  }, [draftWeapon]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftArmor) return;
    let changed = false;
    const item = world.getComponent(targetId, 'item');
    const aStats = world.getComponent(targetId, 'armorStats');
    const meta = world.getComponent(targetId, 'meta');

    if (item && item.type === 'armor') {
      if (item.size !== draftArmor.size) {
        item.size = draftArmor.size;
        changed = true;
      }
      if (JSON.stringify(item.equipTypes) !== JSON.stringify(draftArmor.equipTypes)) {
        item.equipTypes = draftArmor.equipTypes ? [...draftArmor.equipTypes] : [];
        changed = true;
      }
      if (item.equippable !== draftArmor.equippable) {
        item.equippable = draftArmor.equippable;
        changed = true;
      }
      if (item.equipTimeMultiplier !== draftArmor.equipTimeMultiplier) {
        item.equipTimeMultiplier = draftArmor.equipTimeMultiplier;
        changed = true;
      }
    }

    if (aStats) {
      if (aStats.defense.base !== draftArmor.defense) {
        setBaseStat(aStats.defense, draftArmor.defense);
        changed = true;
      }
      if (aStats.flatReduction.base !== draftArmor.flatReduction) {
        setBaseStat(aStats.flatReduction, draftArmor.flatReduction);
        changed = true;
      }
    } else if (meta?.entityType === 'creature') {
      let selfArmor = world.getComponent(targetId, 'armorStats');
      if (!selfArmor) {
        world.addComponent(targetId, 'armorStats', {
          defense: { base: 0, current: 0 },
          flatReduction: { base: 0, current: 0 },
        });
        selfArmor = world.getComponent(targetId, 'armorStats');
      }
      if (selfArmor) {
        if (selfArmor.defense.base !== draftArmor.defense) {
          setBaseStat(selfArmor.defense, draftArmor.defense);
          changed = true;
        }
        if (selfArmor.flatReduction.base !== draftArmor.flatReduction) {
          setBaseStat(selfArmor.flatReduction, draftArmor.flatReduction);
          changed = true;
        }
      }
    }
    if (changed) {
      requestCommit('Изменение параметров брони');
      onUpdateStats();
    }
  }, [draftArmor]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftGenericItem) return;
    let changed = false;
    const item = world.getComponent(targetId, 'item');
    if (item && item.type === 'bodyPart') {
      if (item.size !== draftGenericItem.size) {
        item.size = draftGenericItem.size;
        changed = true;
      }
      if (JSON.stringify(item.equipTypes) !== JSON.stringify(draftGenericItem.equipTypes)) {
        item.equipTypes = [...draftGenericItem.equipTypes];
        changed = true;
      }
      if (item.equippable !== draftGenericItem.equippable) {
        item.equippable = draftGenericItem.equippable;
        changed = true;
      }
      if (item.equipTimeMultiplier !== draftGenericItem.equipTimeMultiplier) {
        item.equipTimeMultiplier = draftGenericItem.equipTimeMultiplier;
        changed = true;
      }
    }
    if (changed) {
      requestCommit('Изменение параметров предмета');
      onUpdateStats();
    }
  }, [draftGenericItem]);

  useEffect(() => {
    if (!targetId || !world || isReadOnly || !draftBag) return;
    let changed = false;
    const item = world.getComponent(targetId, 'item');
    const inv = world.getComponent(targetId, 'inventory');

    if (item) {
      if (item.size !== draftBag.size) {
        item.size = draftBag.size;
        changed = true;
      }
      if (JSON.stringify(item.equipTypes) !== JSON.stringify(draftBag.equipTypes)) {
        item.equipTypes = draftBag.equipTypes ? [...draftBag.equipTypes] : [];
        changed = true;
      }
      if (item.equippable !== draftBag.equippable) {
        item.equippable = draftBag.equippable;
        changed = true;
      }
      if (item.equipTimeMultiplier !== draftBag.equipTimeMultiplier) {
        item.equipTimeMultiplier = draftBag.equipTimeMultiplier;
        changed = true;
      }
    }

    if (inv && isBagEmpty) {
      if (inv.size.width !== draftBag.width || inv.size.height !== draftBag.height) {
        inv.size = { width: draftBag.width, height: draftBag.height };
        inv.slots = Array.from({ length: draftBag.height }, () =>
          Array.from({ length: draftBag.width }, () => ({ itemId: null, count: 0 }))
        );
        changed = true;
      }
    }

    if (changed) {
      requestCommit('Изменение параметров инвентаря');
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
          Ничего не выбрано
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
          <details open>
            <summary style={summaryStyle}>Имя и Трансформация</summary>
            <div style={contentStyle}>
              <MetaInspector
                name={draftName}
                onChange={setDraftName}
                isReadOnly={isReadOnly}
                stance={world.getComponent(targetId, 'meta')?.stance}
              />
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
            </div>
          </details>

          {draftPhysics && (
            <details open>
              <summary style={summaryStyle}>Физика</summary>
              <div style={contentStyle}>
                <PhysicsInspector
                  values={draftPhysics}
                  onChange={(p: any) => setDraftPhysics((prev: any) => ({ ...prev, ...p }))}
                  isReadOnly={isReadOnly}
                  isStandardRadiusOnly={isStandardRadiusOnly}
                  totalWeight={calculateTotalEntityWeight(world, targetId)}
                />
              </div>
            </details>
          )}

          {draftHealth && (
            <details open>
              <summary style={summaryStyle}>Здоровье</summary>
              <div style={contentStyle}>
                <HealthInspector
                  values={draftHealth}
                  onChange={(p: any) => setDraftHealth((prev: any) => ({ ...prev, ...p }))}
                  isReadOnly={isReadOnly}
                />
              </div>
            </details>
          )}

          {draftMovement && (
            <details open>
              <summary style={summaryStyle}>Движение</summary>
              <div style={contentStyle}>
                <MovementInspector
                  values={draftMovement}
                  onChange={(p: any) => setDraftMovement((prev: any) => ({ ...prev, ...p }))}
                  isReadOnly={isReadOnly}
                />
              </div>
            </details>
          )}

          {draftStealth && (
            <details open>
              <summary style={summaryStyle}>Скрытность</summary>
              <div style={contentStyle}>
                <StealthInspector
                  values={draftStealth}
                  onChange={(p: any) => setDraftStealth((prev: any) => ({ ...prev, ...p }))}
                  isReadOnly={isReadOnly}
                />
              </div>
            </details>
          )}

          {draftAI && (
            <details open>
              <summary style={summaryStyle}>Поведение (ИИ)</summary>
              <div style={contentStyle}>
                <AIInspector behavior={draftAI} onChange={setDraftAI} isReadOnly={isReadOnly} />
              </div>
            </details>
          )}

          {draftZone && (
            <details open>
              <summary style={summaryStyle}>Свойства зоны (Area Effector)</summary>
              <div style={contentStyle}>
                <AreaEffectorInspector
                  values={draftZone}
                  onChange={(p: any) => setDraftZone((prev: any) => ({ ...prev, ...p }))}
                  isReadOnly={isReadOnly}
                />
              </div>
            </details>
          )}

          {draftWeapon && (
            <details open>
              <summary style={summaryStyle}>Оружие и зона атаки</summary>
              <div style={contentStyle}>
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
              </div>
            </details>
          )}

          {draftArmor && (
            <details open>
              <summary style={summaryStyle}>
                {currentArchetype === 'creature' ? 'Собственная броня' : 'Параметры брони'}
              </summary>
              <div style={contentStyle}>
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
              </div>
            </details>
          )}

          {draftBag && (
            <details open>
              <summary style={summaryStyle}>Сумка / Инвентарь</summary>
              <div style={contentStyle}>
                <BagFormFields
                  values={draftBag}
                  onChange={(p: any) => setDraftBag((prev: any) => ({ ...prev, ...p }))}
                  isReadOnly={isReadOnly}
                  isBagInventoryEmpty={isBagEmpty}
                />
              </div>
            </details>
          )}

          {draftGenericItem && (
            <details open>
              <summary style={summaryStyle}>Параметры части тела (как предмета)</summary>
              <div style={contentStyle}>
                <CommonItemFormFields
                  values={draftGenericItem}
                  onChange={(p: any) => setDraftGenericItem((prev: any) => ({ ...prev, ...p }))}
                  isReadOnly={isReadOnly}
                />
              </div>
            </details>
          )}

          {anatomyParts.length > 1 && (
            <details open>
              <summary style={summaryStyle}>Анатомия ({anatomyParts.length} частей)</summary>
              <div style={contentStyle}>
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
              </div>
            </details>
          )}

          {/* Ячейки взаимодействия (только для существ) */}
          {interactionSlotsComp && interactionSlotsComp.slots.length > 0 && (
            <details open>
              <summary style={summaryStyle}>Ячейки взаимодействия (Руки)</summary>
              <div style={contentStyle}>
                {interactionSlotsComp.slots.map((slot) => {
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
                            requestCommit('Настройка ячейки');
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
                            requestCommit('Настройка ячейки');
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
                            style={{ width: '100%', backgroundColor: '#2c3e50', color: '#ecf0f1' }}
                            onClick={() => pushPath(slot.itemId!, slotItem.name)}
                          >
                            Настроить: {slotItem.name}
                          </button>
                        ) : (
                          <span style={{ color: '#777', fontSize: '12px' }}>Пусто</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          )}

          {/* Области экипировки (на существах ИЛИ предметах) */}
          <details open>
            <summary style={summaryStyle}>
              <span>Области экипировки {equip ? `(${equip.equipmentAreas.length})` : '(0)'}</span>
              {!isReadOnly && (
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
                    let targetEquip = world.getComponent(targetId, 'equip');
                    if (!targetEquip) {
                      targetEquip = {
                        equipmentAreas: [],
                      };
                      world.addComponent(targetId, 'equip', targetEquip);
                    }
                    const areaId = `slot_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`;
                    targetEquip.equipmentAreas.push({
                      id: areaId,
                      name: 'Новый слот',
                      type: 'belt_slot',
                      space: 10,
                      itemIds: [],
                    });
                    requestCommit('Добавление области экипировки');
                    onUpdateStats();
                  }}
                >
                  + Слот
                </button>
              )}
            </summary>
            <div style={contentStyle}>
              {equip && equip.equipmentAreas.length > 0 ? (
                equip.equipmentAreas.map((area, idx) => {
                  let usedSpace = 0;
                  for (const id of area.itemIds) {
                    const item = world.getComponent(id, 'item');
                    if (item) usedSpace += item.size;
                  }
                  const isOverloaded = usedSpace > area.space;

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
                          marginBottom: '8px',
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
                            area.name = e.target.value;
                            requestCommit('Имя области');
                            onUpdateStats();
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
                                area.space = Math.max(1, +e.target.value);
                                requestCommit('Объем области');
                                onUpdateStats();
                              }}
                            />
                          </span>
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => {
                                if (area.itemIds.length > 0) {
                                  alert(
                                    'Нельзя удалить область экипировки, пока в ней есть предметы!'
                                  );
                                  return;
                                }
                                equip.equipmentAreas.splice(idx, 1);
                                requestCommit('Удаление области экипировки');
                                onUpdateStats();
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
                            area.type = e.target.value;
                            requestCommit('Тип области');
                            onUpdateStats();
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
                          area.itemIds.map((itemId) => {
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
                                onClick={() => pushPath(itemId, it?.name || 'Предмет')}
                              >
                                <span>{it ? it.name : itemId}</span>
                                <span style={{ color: '#888' }}>
                                  V:{it?.size ?? 0} | {itWeight}кг
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <span style={{ color: '#777', fontSize: '11px' }}>Слот свободен</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ color: '#777', fontSize: '11px', fontStyle: 'italic' }}>
                  Нет областей экипировки. Нажмите "+ Слот", чтобы добавить.
                </div>
              )}
            </div>
          </details>

          {/* Инвентарь (Сетка хранения) */}
          <details open>
            <summary style={summaryStyle}>
              <span>Сетка инвентаря</span>
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
                        world.removeComponent(targetId, 'inventory');
                        requestCommit('Удаление инвентаря');
                        onUpdateStats();
                      } else {
                        alert('Нельзя удалить инвентарь, пока в нем есть предметы!');
                      }
                    } else {
                      world.addComponent(targetId, 'inventory', {
                        size: { width: 4, height: 2 },
                        slots: Array.from({ length: 2 }, () =>
                          Array.from({ length: 4 }, () => ({ itemId: null, count: 0 }))
                        ),
                      });
                      requestCommit('Добавление инвентаря');
                      onUpdateStats();
                    }
                  }}
                >
                  {inv ? 'Удалить сетку' : '+ Добавить сетку'}
                </button>
              )}
            </summary>
            <div style={contentStyle}>
              {inv ? (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(${inv.size.width}, 36px)`,
                    gap: '4px',
                    justifyContent: 'center',
                    backgroundColor: '#111',
                    padding: '8px',
                    borderRadius: '4px',
                  }}
                >
                  {inv.slots.map((row, rIdx) =>
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
                  Инвентарь отсутствует.
                </div>
              )}
            </div>
          </details>
        </form>

        {/* Кнопка удаления для корневой сущности инспектора */}
        {path.length === 1 && !isReadOnly && (
          <div style={{ marginTop: '16px' }}>
            <button
              className="btn"
              style={{ width: '100%', backgroundColor: '#c0392b' }}
              onClick={handleDeleteEntity}
            >
              Удалить объект
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
