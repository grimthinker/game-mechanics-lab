import { useState, useCallback, useMemo } from 'react';
import { StandardRadius } from '../ecs/types';
import { GameApp } from '../GameApp';

interface UseGameModalsProps {
  appRef: React.RefObject<GameApp | null>;
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

  const openSpawnModal = useCallback((behavior?: string) => {
    if (behavior) setPendingSpawnBehavior(behavior);
    setIsModalOpen(true);
  }, []);
  const closeSpawnModal = useCallback(() => setIsModalOpen(false), []);

  // Спавн предметов
  const [isItemSpawnModalOpen, setIsItemSpawnModalOpen] = useState(false);
  const openItemSpawnModal = useCallback(() => setIsItemSpawnModalOpen(true), []);
  const closeItemSpawnModal = useCallback(() => setIsItemSpawnModalOpen(false), []);

  // Спавн зон
  const [isZoneSpawnModalOpen, setIsZoneSpawnModalOpen] = useState(false);
  const openZoneSpawnModal = useCallback(() => setIsZoneSpawnModalOpen(true), []);
  const closeZoneSpawnModal = useCallback(() => setIsZoneSpawnModalOpen(false), []);

  // Единое модальное окно инспектора сущности
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingEntityId, setEditingEntityId] = useState<string | null>(null);

  const openEditModal = useCallback(
    (entityId?: string) => {
      const targetId = entityId ?? appRef.current?.selectedEntity?.id ?? null;
      if (!targetId) return;
      setEditingEntityId(targetId);
      setIsEditModalOpen(true);
    },
    [appRef]
  );

  const closeEditModal = useCallback(() => {
    setIsEditModalOpen(false);
    setEditingEntityId(null);
  }, []);

  return useMemo(
    () => ({
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
      isZoneSpawnModalOpen,
      openZoneSpawnModal,
      closeZoneSpawnModal,
      isEditModalOpen,
      editingEntityId,
      openEditModal,
      closeEditModal,
    }),
    [
      isModalOpen,
      pendingSpawnBehavior,
      isSolid,
      radius,
      weight,
      maxSpeed,
      maxTurnSpeed,
      runSpeedMultiplier,
      crouchSpeedMultiplier,
      crouchStealthMultiplier,
      runTurnMultiplier,
      crouchTurnMultiplier,
      stealthPower,
      runStealthMultiplier,
      openSpawnModal,
      closeSpawnModal,
      isItemSpawnModalOpen,
      openItemSpawnModal,
      closeItemSpawnModal,
      isZoneSpawnModalOpen,
      openZoneSpawnModal,
      closeZoneSpawnModal,
      isEditModalOpen,
      editingEntityId,
      openEditModal,
      closeEditModal,
    ]
  );
}
