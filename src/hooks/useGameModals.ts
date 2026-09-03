import { useState } from 'react';
import { StandardRadius, InventoryConfig, ItemData, WeaponConfig } from '../ecs/types';
import { GameApp } from '../GameApp';
import { Circle } from 'detect-collisions';
import { lastAddedWeaponConfigState } from '../Weapon';

interface UseGameModalsProps {
  appRef: React.RefObject<GameApp | null>;
  updateStats: () => void;
}

export function useGameModals({ appRef, updateStats }: UseGameModalsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingSpawnBehavior, setPendingSpawnBehavior] = useState<string>('PlayerTree');

  const [radius, setRadius] = useState<StandardRadius>(16);
  const [weight, setWeight] = useState<number>(10);
  const [maxSpeed, setMaxSpeed] = useState<number>(150);
  const [maxTurnSpeed, setMaxTurnSpeed] = useState<number>(270);
  const [runSpeedMultiplier, setRunSpeedMultiplier] = useState<number>(1.5);
  const [crouchSpeedMultiplier, setCrouchSpeedMultiplier] = useState<number>(0.5);
  const [crouchStealthMultiplier, setCrouchStealthMultiplier] = useState<number>(1.5);
  const [runTurnMultiplier, setRunTurnMultiplier] = useState<number>(0.8);
  const [crouchTurnMultiplier, setCrouchTurnMultiplier] = useState<number>(1.2);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editBehavior, setEditBehavior] = useState<string>('PlayerTree');
  const [editRadius, setEditRadius] = useState<StandardRadius>(24);
  const [editBaseRadius, setEditBaseRadius] = useState<StandardRadius>(24);
  const [editMaxSpeed, setEditMaxSpeed] = useState<number>(150);
  const [editMaxTurnSpeed, setEditMaxTurnSpeed] = useState<number>(270);
  const [editHp, setEditHp] = useState<number>(100);
  const [editMaxHp, setEditMaxHp] = useState<number>(100);
  const [editRunSpeedMultiplier, setEditRunSpeedMultiplier] = useState<number>(1.5);
  const [editCrouchSpeedMultiplier, setEditCrouchSpeedMultiplier] = useState<number>(0.5);
  const [editCrouchStealthMultiplier, setEditCrouchStealthMultiplier] = useState<number>(1.5);
  const [editRunTurnMultiplier, setEditRunTurnMultiplier] = useState<number>(0.8);
  const [editCrouchTurnMultiplier, setEditCrouchTurnMultiplier] = useState<number>(1.2);

  const [isItemSpawnModalOpen, setIsItemSpawnModalOpen] = useState(false);
  const openItemSpawnModal = () => setIsItemSpawnModalOpen(true);
  const closeItemSpawnModal = () => setIsItemSpawnModalOpen(false);

  const [selectedItemForEdit, setSelectedItemForEdit] = useState<ItemData | null>(null);

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
    const c = appRef.current?.selectedCreature;
    if (!c) return;
    setEditBehavior(c.behavior);
    setEditRadius(c.radius);
    setEditBaseRadius((c as any).baseRadius ?? c.radius);
    setEditMaxSpeed(c.maxSpeed);
    setEditMaxTurnSpeed(Math.round((c.maxTurnSpeed * 180) / Math.PI));
    setEditHp(c.hp);
    setEditMaxHp(c.maxHp);
    setEditRunSpeedMultiplier(c.runSpeedMultiplier);
    setEditCrouchSpeedMultiplier(c.crouchSpeedMultiplier);
    setEditCrouchStealthMultiplier(c.crouchStealthMultiplier);
    setEditRunTurnMultiplier(c.runTurnMultiplier);
    setEditCrouchTurnMultiplier(c.crouchTurnMultiplier);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => setIsEditModalOpen(false);

  const handleEditConfirm = () => {
    const app = appRef.current;
    const c = app?.selectedCreature;
    if (!c || !app) return;

    c.updateParams(
      {
        behavior: editBehavior,
        radius: editRadius,
        baseRadius: editBaseRadius,
        maxSpeed: editMaxSpeed,
        maxTurnSpeed: (editMaxTurnSpeed * Math.PI) / 180,
        hp: editHp,
        maxHp: editMaxHp,
        runSpeedMultiplier: editRunSpeedMultiplier,
        crouchSpeedMultiplier: editCrouchSpeedMultiplier,
        crouchStealthMultiplier: editCrouchStealthMultiplier,
        runTurnMultiplier: editRunTurnMultiplier,
        crouchTurnMultiplier: editCrouchTurnMultiplier,
      },
      (app as any).aiSystem
    );
    closeEditModal();
    updateStats();
  };

  const openItemEditModal = (item: ItemData) => {
    setSelectedItemForEdit(item);
  };

  const closeItemEditModal = () => {
    setSelectedItemForEdit(null);
  };

  const handleItemEditConfirm = (updatedItem: ItemData) => {
    const app = appRef.current;
    if (!app) return;

    const entityId = updatedItem.id;
    const itemComp = app.world.getComponent(entityId, 'item');
    
    if (itemComp) {
      Object.assign(itemComp, updatedItem);
      
      const phys = app.world.getComponent(entityId, 'physicsBody');
      const wasSolid = !!phys;
      const isSolidNow = !!updatedItem.config?.isSolid;
      
      if (!wasSolid && isSolidNow) {
        const rad = updatedItem.config?.radius ?? 16;
        const weight = updatedItem.config?.weight || 1;
        const transform = app.world.getComponent(entityId, 'transform');
        if (transform) {
          const body = new Circle({ x: transform.x, y: transform.y }, rad);
          body.isStatic = false;
          app.world.addComponent(entityId, 'physicsBody', { body, radius: rad, weight, isStatic: false });
          app.physics.registerBody(entityId, body);
        }
      } else if (wasSolid && !isSolidNow) {
        app.physics.unregisterBody(phys!.body);
        app.world.removeComponent(entityId, 'physicsBody');
      } else if (wasSolid && isSolidNow) {
        const newRadius = updatedItem.config?.radius ?? 16;
        if (phys!.radius !== newRadius) {
          phys!.radius = newRadius;
          phys!.body.r = newRadius;
        }
      }
    }

    if (selectedItemForEdit) {
      Object.assign(selectedItemForEdit, updatedItem);
    }
    
    if (updatedItem.type === 'weapon') {
      lastAddedWeaponConfigState.config = JSON.parse(JSON.stringify(updatedItem.config as WeaponConfig));
    }

    const c = app.selectedCreature;
    if (c && updatedItem.type === 'bag') {
      const bagCfg = updatedItem.config as InventoryConfig;
      const inv = app.world.getComponent(entityId, 'inventory');
      if (inv) {
        const isInventoryEmpty = inv.slots.every((row) => row.every((cell) => !cell.itemId));
        if (isInventoryEmpty) {
            inv.size = { width: bagCfg.size.width, height: bagCfg.size.height };
            inv.slots = Array.from({ length: bagCfg.size.height }, () =>
                Array.from({ length: bagCfg.size.width }, () => ({ itemId: null, count: 0 }))
            );
        }
      }
    }

    setSelectedItemForEdit(null);
    updateStats();
  };

  return {
    isModalOpen,
    pendingSpawnBehavior,
    setPendingSpawnBehavior,
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
    openSpawnModal,
    closeSpawnModal,
    isItemSpawnModalOpen,
    openItemSpawnModal,
    closeItemSpawnModal,
    isEditModalOpen,
    editBehavior,
    setEditBehavior,
    editRadius,
    setEditRadius,
    editBaseRadius,
    setEditBaseRadius,
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
    openEditModal,
    closeEditModal,
    handleEditConfirm,
    selectedItemForEdit,
    openItemEditModal,
    closeItemEditModal,
    handleItemEditConfirm,
  };
}