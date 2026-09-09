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
  const [walkSpeedMultiplier, setWalkSpeedMultiplier] = useState<number>(0.5);
  const [crouchTurnMultiplier, setCrouchTurnMultiplier] = useState<number>(0.8);
  const [strafeSpeedMultiplier, setStrafeSpeedMultiplier] = useState<number>(0.8);
  const [backwardSpeedMultiplier, setBackwardSpeedMultiplier] = useState<number>(0.6);
  const [strafeTurnMultiplier, setStrafeTurnMultiplier] = useState<number>(0.8);
  const [backwardTurnMultiplier, setBackwardTurnMultiplier] = useState<number>(0.6);
  const [stealthPower, setStealthPower] = useState<number>(10);
  const [runStealthMultiplier, setRunStealthMultiplier] = useState<number>(0.5);
  const [walkStealthMultiplier, setWalkStealthMultiplier] = useState<number>(1.3);
  const [turnInPlaceStealthMultiplier, setTurnInPlaceStealthMultiplier] = useState<number>(1.5);
  const [immobileStealthMultiplier, setImmobileStealthMultiplier] = useState<number>(2.0);

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
  const [modalStack, setModalStack] = useState<string[]>([]);

  const isEditModalOpen = modalStack.length > 0;
  const editingEntityId = modalStack.length > 0 ? modalStack[modalStack.length - 1] : null;

  const openEditModal = useCallback(
    (entityId?: string) => {
      const targetId = entityId ?? appRef.current?.selectedEntity?.id ?? null;
      if (!targetId) return;
      setModalStack((prev) => [...prev, targetId]);
    },
    [appRef]
  );

  const closeEditModal = useCallback(() => {
    setModalStack((prev) => {
      if (prev.length <= 1) return [];
      return prev.slice(0, prev.length - 1);
    });
  }, []);

  const closeAllEditModals = useCallback(() => {
    setModalStack([]);
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
      walkSpeedMultiplier,
      setWalkSpeedMultiplier,
      crouchTurnMultiplier,
      setCrouchTurnMultiplier,
      strafeSpeedMultiplier,
      setStrafeSpeedMultiplier,
      backwardSpeedMultiplier,
      setBackwardSpeedMultiplier,
      strafeTurnMultiplier,
      setStrafeTurnMultiplier,
      backwardTurnMultiplier,
      setBackwardTurnMultiplier,
      stealthPower,
      setStealthPower,
      runStealthMultiplier,
      setRunStealthMultiplier,
      walkStealthMultiplier,
      setWalkStealthMultiplier,
      turnInPlaceStealthMultiplier,
      setTurnInPlaceStealthMultiplier,
      immobileStealthMultiplier,
      setImmobileStealthMultiplier,
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
      closeAllEditModals,
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
      walkSpeedMultiplier,
      crouchTurnMultiplier,
      strafeSpeedMultiplier,
      backwardSpeedMultiplier,
      strafeTurnMultiplier,
      backwardTurnMultiplier,
      stealthPower,
      runStealthMultiplier,
      walkStealthMultiplier,
      turnInPlaceStealthMultiplier,
      immobileStealthMultiplier,
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
      closeAllEditModals,
    ]
  );
}
