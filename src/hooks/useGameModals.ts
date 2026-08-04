import { useState } from 'react';
import { CreatureType, StandardRadius, WeaponConfig, ArmorConfig, InventoryConfig, ItemData } from '../ecs/types';
import { GameApp } from '../GameApp';

interface UseGameModalsProps {
  appRef: React.RefObject<GameApp | null>;
  updateStats: () => void;
}

export function useGameModals({ appRef, updateStats }: UseGameModalsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingSpawnType, setPendingSpawnType] = useState<CreatureType | null>(null);
  
  // Параметры спавна
  const [radius, setRadius] = useState<StandardRadius>(16);
  const [mass, setMass] = useState<number>(10);
  const [maxSpeed, setMaxSpeed] = useState<number>(150);
  const [maxTurnSpeed, setMaxTurnSpeed] = useState<number>(270);
  const [runSpeedMultiplier, setRunSpeedMultiplier] = useState<number>(1.5);
  const [crouchSpeedMultiplier, setCrouchSpeedMultiplier] = useState<number>(0.5);
  const [crouchStealthMultiplier, setCrouchStealthMultiplier] = useState<number>(1.5);
  const [runTurnMultiplier, setRunTurnMultiplier] = useState<number>(0.8);
  const [crouchTurnMultiplier, setCrouchTurnMultiplier] = useState<number>(1.2);

  // Редактирование существа
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editRadius, setEditRadius] = useState<StandardRadius>(24);
  const [editMaxSpeed, setEditMaxSpeed] = useState<number>(150);
  const [editMaxTurnSpeed, setEditMaxTurnSpeed] = useState<number>(270);
  const [editHp, setEditHp] = useState<number>(100);
  const [editMaxHp, setEditMaxHp] = useState<number>(100);
  const [editRunSpeedMultiplier, setEditRunSpeedMultiplier] = useState<number>(1.5);
  const [editCrouchSpeedMultiplier, setEditCrouchSpeedMultiplier] = useState<number>(0.5);
  const [editCrouchStealthMultiplier, setEditCrouchStealthMultiplier] = useState<number>(1.5);
  const [editRunTurnMultiplier, setEditRunTurnMultiplier] = useState<number>(0.8);
  const [editCrouchTurnMultiplier, setEditCrouchTurnMultiplier] = useState<number>(1.2);

  // Редактирование оружия
  const [selectedWeaponForEdit, setSelectedWeaponForEdit] = useState<WeaponConfig | null>(null);
  const [editWeaponName, setEditWeaponName] = useState<string>('');
  const [editWeaponDamage, setEditWeaponDamage] = useState<number>(25);
  const [editWeaponPrepTime, setEditWeaponPrepTime] = useState<number>(0.2);
  const [editWeaponRecoveryTime, setEditWeaponRecoveryTime] = useState<number>(0.3);
  const [editWeaponRange, setEditWeaponRange] = useState<number>(0);
  const [editWeaponRadius, setEditWeaponRadius] = useState<number>(0);
  const [editWeaponNumLines, setEditWeaponNumLines] = useState<number>(1);
  const [editWeaponAngle, setEditWeaponAngle] = useState<number>(0);
  const [editWeaponPierceObstacles, setEditWeaponPierceObstacles] = useState<boolean>(false);
  const [editWeaponPiercePlayers, setEditWeaponPiercePlayers] = useState<boolean>(false);
  const [editWeaponPierceBots, setEditWeaponPierceBots] = useState<boolean>(false);

  // Редактирование брони
  const [selectedArmorForEdit, setSelectedArmorForEdit] = useState<ArmorConfig | null>(null);
  const [editArmorName, setEditArmorName] = useState<string>('');
  const [editArmorDefense, setEditArmorDefense] = useState<number>(15);
  const [editArmorFlatReduction, setEditArmorFlatReduction] = useState<number>(3);
  const [editArmorWeight, setEditArmorWeight] = useState<number>(3);

  // Редактирование сумки
  const [selectedBagForEdit, setSelectedBagForEdit] = useState<InventoryConfig | null>(null);
  const [editBagName, setEditBagName] = useState<string>('');
  const [editBagWidth, setEditBagWidth] = useState<number>(6);
  const [editBagHeight, setEditBagHeight] = useState<number>(4);
  const [editBagWeight, setEditBagWeight] = useState<number>(1);

  const openSpawnModal = (type: CreatureType) => {
    setPendingSpawnType(type);
    setIsModalOpen(true);
  };

  const closeSpawnModal = () => {
    setPendingSpawnType(null);
    setIsModalOpen(false);
  };

  const openEditModal = () => {
    const c = appRef.current?.selectedCreature;
    if (!c) return;
    setEditRadius(c.radius);
    setEditMaxSpeed(c.maxSpeed);
    setEditMaxTurnSpeed(Math.round((c.maxTurnSpeed * 180) / Math.PI));
    setEditHp(c.hp);
    setEditMaxHp(c.maxHp);
    setEditRunSpeedMultiplier(c.runSpeedMultiplier);
    setEditCrouchSpeedMultiplier(c.crouchSpeedMultiplier);
    setEditCrouchStealthMultiplier(c.crouchStealthMultiplier);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => setIsEditModalOpen(false);

  const handleEditConfirm = () => {
    const c = appRef.current?.selectedCreature;
    if (!c) return;
    c.updateParams({
      radius: editRadius,
      maxSpeed: editMaxSpeed,
      maxTurnSpeed: (editMaxTurnSpeed * Math.PI) / 180,
      hp: editHp,
      maxHp: editMaxHp,
      runSpeedMultiplier: editRunSpeedMultiplier,
      crouchSpeedMultiplier: editCrouchSpeedMultiplier,
      crouchStealthMultiplier: editCrouchStealthMultiplier,
    });
    closeEditModal();
    updateStats();
  };

  const openWeaponEditModal = (weapon: WeaponConfig) => {
    const w = weapon as any;
    const zone = w.zone || {};
    setSelectedWeaponForEdit(weapon);
    setEditWeaponName(w.name || '');
    setEditWeaponDamage(w.baseDamage ?? 25);
    setEditWeaponPrepTime(w.prepTime ?? 0.2);
    setEditWeaponRecoveryTime(w.recoveryTime ?? 0.3);
    setEditWeaponRange(zone.length ?? zone.range ?? 0);
    setEditWeaponRadius(zone.radius ?? zone.offsetDistance ?? 0);
    setEditWeaponNumLines(zone.rayCount ?? zone.numLines ?? zone.lines ?? 1);
    setEditWeaponAngle(zone.angle !== undefined ? Math.round((zone.angle * 180) / Math.PI) : 0);
    setEditWeaponPierceObstacles(!!zone.pierceObstacles);
    setEditWeaponPiercePlayers(!!zone.piercePlayers);
    setEditWeaponPierceBots(!!zone.pierceBots);
  };

  const closeWeaponEditModal = () => setSelectedWeaponForEdit(null);

  const handleWeaponEditConfirm = () => {
    if (!selectedWeaponForEdit) return;
    const w = selectedWeaponForEdit as any;
    if (!w.zone) w.zone = {};

    w.name = editWeaponName;
    w.baseDamage = editWeaponDamage;
    w.prepTime = editWeaponPrepTime;
    w.recoveryTime = editWeaponRecoveryTime;

    if (w.zone.length !== undefined || w.zone.range !== undefined || editWeaponRange > 0) {
      if (w.zone.length !== undefined) w.zone.length = editWeaponRange;
      if (w.zone.range !== undefined) w.zone.range = editWeaponRange;
      if (w.zone.length === undefined && w.zone.range === undefined) w.zone.length = editWeaponRange;
    }

    if (w.zone.radius !== undefined) {
      w.zone.radius = editWeaponRadius;
    } else if (w.zone.offsetDistance !== undefined && w.zone.hitZoneType === 'offset_radius') {
      w.zone.radius = editWeaponRadius;
    }

    if (w.zone.rayCount !== undefined) w.zone.rayCount = editWeaponNumLines;
    if (w.zone.numLines !== undefined) w.zone.numLines = editWeaponNumLines;
    if (w.zone.lines !== undefined) w.zone.lines = editWeaponNumLines;

    if (w.zone.angle !== undefined) {
      w.zone.angle = (editWeaponAngle * Math.PI) / 180;
    }

    w.zone.pierceObstacles = editWeaponPierceObstacles;
    w.zone.piercePlayers = editWeaponPiercePlayers;
    w.zone.pierceBots = editWeaponPierceBots;

    closeWeaponEditModal();
    updateStats();
  };

  const openArmorEditModal = (armor: ArmorConfig) => {
    setSelectedArmorForEdit(armor);
    setEditArmorName(armor.name || '');
    setEditArmorDefense(armor.defense ?? 15);
    setEditArmorFlatReduction(armor.flat_reduction ?? 3);
    setEditArmorWeight(armor.invWeight ?? 3);
  };

  const closeArmorEditModal = () => setSelectedArmorForEdit(null);

  const handleArmorEditConfirm = () => {
    if (!selectedArmorForEdit) return;
    selectedArmorForEdit.name = editArmorName;
    selectedArmorForEdit.defense = editArmorDefense;
    selectedArmorForEdit.flat_reduction = editArmorFlatReduction;
    selectedArmorForEdit.invWeight = editArmorWeight;
    closeArmorEditModal();
    updateStats();
  };

  const openBagEditModal = (bag: InventoryConfig) => {
    setSelectedBagForEdit(bag);
    setEditBagName(bag.name || '');
    setEditBagWidth(bag.size?.width ?? 6);
    setEditBagHeight(bag.size?.height ?? 4);
    setEditBagWeight(bag.invWeight ?? 1);
  };

  const closeBagEditModal = () => setSelectedBagForEdit(null);

  const handleBagEditConfirm = () => {
    if (!selectedBagForEdit) return;
    selectedBagForEdit.name = editBagName;
    selectedBagForEdit.invWeight = editBagWeight;

    const c = appRef.current?.selectedCreature;
    const isInventoryEmpty =
      !c?.inventory || c.inventory.slots.every((row) => row.every((cell) => !cell.item));

    if (
      isInventoryEmpty &&
      (selectedBagForEdit.size.width !== editBagWidth ||
        selectedBagForEdit.size.height !== editBagHeight)
    ) {
      selectedBagForEdit.size = { width: editBagWidth, height: editBagHeight };
      if (c) {
        c.updateInventorySize(editBagWidth, editBagHeight);
      }
    }

    closeBagEditModal();
    updateStats();
  };

  const openItemEditModal = (item: ItemData) => {
    if (!item.config) return;
    if (item.type === 'weapon') {
      closeArmorEditModal();
      closeBagEditModal();
      openWeaponEditModal(item.config as WeaponConfig);
    } else if (item.type === 'armor') {
      closeWeaponEditModal();
      closeBagEditModal();
      openArmorEditModal(item.config as ArmorConfig);
    } else if (item.type === 'bag') {
      closeWeaponEditModal();
      closeArmorEditModal();
      openBagEditModal(item.config as InventoryConfig);
    }
  };

  return {
    isModalOpen,
    pendingSpawnType,
    setPendingSpawnType,
    radius, setRadius,
    mass, setMass,
    maxSpeed, setMaxSpeed,
    maxTurnSpeed, setMaxTurnSpeed,
    runSpeedMultiplier, setRunSpeedMultiplier,
    crouchSpeedMultiplier, setCrouchSpeedMultiplier,
    crouchStealthMultiplier, setCrouchStealthMultiplier,
    runTurnMultiplier, setRunTurnMultiplier,
    crouchTurnMultiplier, setCrouchTurnMultiplier,
    openSpawnModal, closeSpawnModal,

    isEditModalOpen,
    editRadius, setEditRadius,
    editMaxSpeed, setEditMaxSpeed,
    editMaxTurnSpeed, setEditMaxTurnSpeed,
    editHp, setEditHp,
    editMaxHp, setEditMaxHp,
    editRunSpeedMultiplier, setEditRunSpeedMultiplier,
    editCrouchSpeedMultiplier, setEditCrouchSpeedMultiplier,
    editCrouchStealthMultiplier, setEditCrouchStealthMultiplier,
    editRunTurnMultiplier, setEditRunTurnMultiplier,
    editCrouchTurnMultiplier, setEditCrouchTurnMultiplier,
    openEditModal, closeEditModal, handleEditConfirm,

    selectedWeaponForEdit, editWeaponName, setEditWeaponName,
    editWeaponDamage, setEditWeaponDamage, editWeaponPrepTime, setEditWeaponPrepTime,
    editWeaponRecoveryTime, setEditWeaponRecoveryTime, editWeaponRange, setEditWeaponRange,
    editWeaponRadius, setEditWeaponRadius, editWeaponNumLines, setEditWeaponNumLines,
    editWeaponAngle, setEditWeaponAngle, editWeaponPierceObstacles, setEditWeaponPierceObstacles,
    editWeaponPiercePlayers, setEditWeaponPiercePlayers, editWeaponPierceBots, setEditWeaponPierceBots,
    closeWeaponEditModal, handleWeaponEditConfirm,

    selectedArmorForEdit, editArmorName, setEditArmorName,
    editArmorDefense, setEditArmorDefense, editArmorFlatReduction, setEditArmorFlatReduction,
    editArmorWeight, setEditArmorWeight,
    closeArmorEditModal, handleArmorEditConfirm,

    selectedBagForEdit, editBagName, setEditBagName,
    editBagWidth, setEditBagWidth, editBagHeight, setEditBagHeight,
    editBagWeight, setEditBagWeight,
    closeBagEditModal, handleBagEditConfirm,

    openItemEditModal,
  };
}