import { useState } from 'react';
import {
  StandardRadius,
  COLLISION_MASK_ALL,
  COLLISION_MASK_NONE,
} from '../ecs/types';
import { GameApp } from '../GameApp';
import { ItemEditValues } from '../components/modals/ItemEditModal';
import { deg2Rad, rad2Deg } from '../utils';

interface UseGameModalsProps {
  appRef: React.RefObject<GameApp | null>;
  updateStats: () => void;
}

export function useGameModals({ appRef, updateStats }: UseGameModalsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingSpawnBehavior, setPendingSpawnBehavior] = useState<string>('PlayerTree');

  const [isSolid, setIsSolid] = useState<boolean>(true);
  const [radius, setRadius] = useState<StandardRadius>(16);
  const [weight, setWeight] = useState<number>(10);
  const [maxSpeed, setMaxSpeed] = useState<number>(150);
  const [maxTurnSpeed, setMaxTurnSpeed] = useState<number>(270);
  const [runSpeedMultiplier, setRunSpeedMultiplier] = useState<number>(1.5);
  const [crouchSpeedMultiplier, setCrouchSpeedMultiplier] = useState<number>(0.5);
  const [crouchStealthMultiplier, setCrouchStealthMultiplier] = useState<number>(1.5);
  const [runTurnMultiplier, setRunTurnMultiplier] = useState<number>(0.8);
  const [crouchTurnMultiplier, setCrouchTurnMultiplier] = useState<number>(1.2);
  const [stealthPower, setStealthPower] = useState<number>(10);
  const [runStealthMultiplier, setRunStealthMultiplier] = useState<number>(0.5);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editBehavior, setEditBehavior] = useState<string>('PlayerTree');
  const [editIsSolid, setEditIsSolid] = useState<boolean>(true);
  const [editRadius, setEditRadius] = useState<StandardRadius>(24);
  const [editBaseRadius, setEditBaseRadius] = useState<StandardRadius>(24);
  const [editWeight, setEditWeight] = useState<number>(10);
  const [editBaseWeight, setEditBaseWeight] = useState<number>(10);
  const [editMaxSpeed, setEditMaxSpeed] = useState<number>(150);
  const [editMaxTurnSpeed, setEditMaxTurnSpeed] = useState<number>(270);
  const [editHp, setEditHp] = useState<number>(100);
  const [editMaxHp, setEditMaxHp] = useState<number>(100);
  const [editRunSpeedMultiplier, setEditRunSpeedMultiplier] = useState<number>(1.5);
  const [editCrouchSpeedMultiplier, setEditCrouchSpeedMultiplier] = useState<number>(0.5);
  const [editCrouchStealthMultiplier, setEditCrouchStealthMultiplier] = useState<number>(1.5);
  const [editRunTurnMultiplier, setEditRunTurnMultiplier] = useState<number>(0.8);
  const [editCrouchTurnMultiplier, setEditCrouchTurnMultiplier] = useState<number>(1.2);
  const [editStealthPower, setEditStealthPower] = useState<number>(10);
  const [editRunStealthMultiplier, setEditRunStealthMultiplier] = useState<number>(0.5);

  const [isItemSpawnModalOpen, setIsItemSpawnModalOpen] = useState(false);
  const openItemSpawnModal = () => setIsItemSpawnModalOpen(true);
  const closeItemSpawnModal = () => setIsItemSpawnModalOpen(false);

  const [selectedItemEntityId, setSelectedItemEntityId] = useState<string | null>(null);

  const openSpawnModal = (behavior?: string) => {
    if (behavior) {
      setPendingSpawnBehavior(behavior);
    }
    setIsModalOpen(true);
  };

  const closeSpawnModal = () => {
    setIsModalOpen(false);
  };

  const openEditModal = () => {
    const c = appRef.current?.selectedEntity;
    if (!c || c.itemData) return;
    setEditBehavior(c.behavior);
    setEditIsSolid(c.isSolid);
    setEditRadius(c.radius);
    setEditBaseRadius(c.baseRadius ?? c.radius);
    setEditWeight(c.weight);
    setEditBaseWeight(c.baseWeight ?? c.weight);
    setEditMaxSpeed(c.maxSpeed);
    setEditMaxTurnSpeed(Math.round(rad2Deg(c.maxTurnSpeed)));
    setEditHp(c.hp);
    setEditMaxHp(c.maxHp);
    setEditRunSpeedMultiplier(c.runSpeedMultiplier);
    setEditCrouchSpeedMultiplier(c.crouchSpeedMultiplier);
    setEditCrouchStealthMultiplier(c.crouchStealthMultiplier);
    setEditRunTurnMultiplier(c.runTurnMultiplier);
    setEditCrouchTurnMultiplier(c.crouchTurnMultiplier);
    setEditStealthPower(c.stealthPower);
    setEditRunStealthMultiplier(c.runStealthMultiplier);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => setIsEditModalOpen(false);

  const handleEditConfirm = () => {
    const app = appRef.current;
    const c = app?.selectedEntity;
    if (!c || !app) return;

    c.updateParams(
      {
        behavior: editBehavior,
        isSolid: editIsSolid,
        radius: editRadius,
        baseRadius: editBaseRadius,
        weight: editWeight,
        baseWeight: editBaseWeight,
        maxSpeed: editMaxSpeed,
        maxTurnSpeed: deg2Rad(editMaxTurnSpeed),
        hp: editHp,
        maxHp: editMaxHp,
        runSpeedMultiplier: editRunSpeedMultiplier,
        crouchSpeedMultiplier: editCrouchSpeedMultiplier,
        crouchStealthMultiplier: editCrouchStealthMultiplier,
        runTurnMultiplier: editRunTurnMultiplier,
        crouchTurnMultiplier: editCrouchTurnMultiplier,
        stealthPower: editStealthPower,
        runStealthMultiplier: editRunStealthMultiplier,
      },
      (app as any).aiSystem,
      app.physics
    );
    closeEditModal();
    updateStats();
  };

  const openItemEditModal = (entityId: string) => {
    setSelectedItemEntityId(entityId);
  };

  const closeItemEditModal = () => {
    setSelectedItemEntityId(null);
  };

  const handleItemEditConfirm = (values: ItemEditValues) => {
    const app = appRef.current;
    if (!app || !selectedItemEntityId) return;

    const entityId = selectedItemEntityId;
    const itemComp = app.world.getComponent(entityId, 'item');

    if (itemComp) {
      itemComp.name = values.name;
    }

    const phys = app.world.getComponent(entityId, 'physicsBody');
    const physStats = app.world.getComponent(entityId, 'physicsStats');
    if (phys) {
      phys.body.r = values.radius;
      phys.mask = values.isSolid ? COLLISION_MASK_ALL : COLLISION_MASK_NONE;
      (phys.body as any).mask = phys.mask;
    }
    if (physStats) {
      physStats.radius.current = values.radius;
      physStats.radius.base = values.radius;
      physStats.weight.current = values.weight;
      physStats.weight.base = values.weight;
      physStats.isSolid.current = values.isSolid;
      physStats.isSolid.base = values.isSolid;
    }

    if (values.weapon) {
      const wStats = app.world.getComponent(entityId, 'weaponStats');
      if (wStats) {
        wStats.baseDamage.base = values.weapon.baseDamage;
        wStats.baseDamage.current = values.weapon.baseDamage;
        wStats.prepTime.base = values.weapon.prepTime;
        wStats.prepTime.current = values.weapon.prepTime;
        wStats.recoveryTime.base = values.weapon.recoveryTime;
        wStats.recoveryTime.current = values.weapon.recoveryTime;
      }
      app.world.addComponent(entityId, 'weaponZone', JSON.parse(JSON.stringify(values.weapon.zone)));
    } else if (values.armor) {
      const aStats = app.world.getComponent(entityId, 'armorStats');
      if (aStats) {
        aStats.defense.base = values.armor.defense;
        aStats.defense.current = values.armor.defense;
        aStats.flatReduction.base = values.armor.flatReduction;
        aStats.flatReduction.current = values.armor.flatReduction;
      }
    } else if (values.bag) {
      const { width, height } = values.bag;
      const inv = app.world.getComponent(entityId, 'inventory');
      if (inv) {
        const isInventoryEmpty = inv.slots.every((row) => row.every((cell) => !cell.itemId));
        if (isInventoryEmpty) {
          inv.size = { width, height };
          inv.slots = Array.from({ length: height }, () =>
            Array.from({ length: width }, () => ({ itemId: null, count: 0 }))
          );
        }
      }
    }

    setSelectedItemEntityId(null);
    updateStats();
  };

  return {
    isModalOpen,
    pendingSpawnBehavior,
    setPendingSpawnBehavior,
    isSolid,
    setIsSolid,
    radius,
    setRadius,
    weight,
    setWeight,
    maxSpeed,
    setMaxSpeed,
    maxTurnSpeed,
    setMaxTurnSpeed,
    runSpeedMultiplier,
    setRunSpeedMultiplier,
    crouchSpeedMultiplier,
    setCrouchSpeedMultiplier,
    crouchStealthMultiplier,
    setCrouchStealthMultiplier,
    runTurnMultiplier,
    setRunTurnMultiplier,
    crouchTurnMultiplier,
    setCrouchTurnMultiplier,
    stealthPower,
    setStealthPower,
    runStealthMultiplier,
    setRunStealthMultiplier,
    openSpawnModal,
    closeSpawnModal,
    isItemSpawnModalOpen,
    openItemSpawnModal,
    closeItemSpawnModal,
    isEditModalOpen,
    editBehavior,
    setEditBehavior,
    editIsSolid,
    setEditIsSolid,
    editRadius,
    setEditRadius,
    editBaseRadius,
    setEditBaseRadius,
    editWeight,
    setEditWeight,
    editBaseWeight,
    setEditBaseWeight,
    editMaxSpeed,
    setEditMaxSpeed,
    editMaxTurnSpeed,
    setEditMaxTurnSpeed,
    editHp,
    setEditHp,
    editMaxHp,
    setEditMaxHp,
    editRunSpeedMultiplier,
    setEditRunSpeedMultiplier,
    editCrouchSpeedMultiplier,
    setEditCrouchSpeedMultiplier,
    editCrouchStealthMultiplier,
    setEditCrouchStealthMultiplier,
    editRunTurnMultiplier,
    setEditRunTurnMultiplier,
    editCrouchTurnMultiplier,
    setEditCrouchTurnMultiplier,
    editStealthPower,
    setEditStealthPower,
    editRunStealthMultiplier,
    setEditRunStealthMultiplier,
    openEditModal,
    closeEditModal,
    handleEditConfirm,
    selectedItemEntityId,
    openItemEditModal,
    closeItemEditModal,
    handleItemEditConfirm,
  };
}