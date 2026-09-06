import { useState } from 'react';
import { StandardRadius } from '../ecs/types';
import { GameApp } from '../GameApp';

interface UseGameModalsProps {
  appRef: React.RefObject<GameApp | null>;
  updateStats: () => void;
}

export function useGameModals({ appRef }: UseGameModalsProps) {
  // Спавн существ
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

  const openSpawnModal = (behavior?: string) => {
    if (behavior) setPendingSpawnBehavior(behavior);
    setIsModalOpen(true);
  };
  const closeSpawnModal = () => setIsModalOpen(false);

  // Спавн предметов
  const [isItemSpawnModalOpen, setIsItemSpawnModalOpen] = useState(false);
  const openItemSpawnModal = () => setIsItemSpawnModalOpen(true);
  const closeItemSpawnModal = () => setIsItemSpawnModalOpen(false);

  // Единое модальное окно инспектора сущности
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);

  const openEditModal = (entityId?: string) => {
    const targetId = entityId ?? appRef.current?.selectedEntity?.id ?? null;
    if (!targetId) return;
    setEditingEntityId(targetId);
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingEntityId(null);
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
    editingEntityId,
    openEditModal,
    closeEditModal,
  };
}