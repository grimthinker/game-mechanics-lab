import { World } from '../World';
import {
  EntityId,
  ConsciousnessState,
  LocomotionStateComponent as LocomotionState,
} from '../types';
import { getAnatomyParts } from './hierarchy';
import { BALANCE_CONFIG } from '../../config/balanceConfig';

export const enum PartStatus {
  INTACT = 'INTACT', // ФП >= 0
  BROKEN = 'BROKEN', // -max < ФП < 0
  DESTROYED = 'DESTROYED', // ФП <= -max
}

export function getPartStatus(world: World, partId: EntityId): PartStatus {
  const fp = world.getComponent(partId, 'functionalHealth');
  if (!fp) {
    const hp = world.getComponent(partId, 'health');
    if (hp && hp.current <= 0) return PartStatus.DESTROYED;
    return PartStatus.INTACT;
  }

  const maxFp = fp.max.current;
  if (fp.current >= 0) return PartStatus.INTACT;
  if (fp.current > -maxFp) return PartStatus.BROKEN;
  return PartStatus.DESTROYED;
}

export function getLocomotionState(world: World, rootId: EntityId): LocomotionState {
  const parts = getAnatomyParts(world, rootId);
  let intactLegs = 0;
  let brokenLegs = 0;
  let destroyedLegs = 0;
  let totalLegs = 0;

  for (const partId of parts) {
    if (world.getComponent(partId, 'locomotion')) {
      totalLegs++;
      const status = getPartStatus(world, partId);
      if (status === PartStatus.INTACT) intactLegs++;
      else if (status === PartStatus.BROKEN) brokenLegs++;
      else destroyedLegs++;
    }
  }

  const penalties = BALANCE_CONFIG.locomotionPenalties;

  // Если у существа изначально нет ног
  if (totalLegs === 0) {
    return {
      speedMult: penalties.oneLegDestroyedSpeedMultiplier,
      turnMult: penalties.oneLegDestroyedTurnMultiplier,
      canSprint: false,
      forceProneOnMove: true,
      canStand: false,
      intactLegs: 0,
      brokenLegs: 0,
      destroyedLegs: 0,
    };
  }

  // 2 и более целых ног — нормальное передвижение
  if (intactLegs >= 2) {
    return {
      speedMult: 1.0,
      turnMult: 1.0,
      canSprint: true,
      forceProneOnMove: false,
      canStand: true,
      intactLegs,
      brokenLegs,
      destroyedLegs,
    };
  }

  // 1 целая нога и хотя бы 1 сломанная
  if (intactLegs === 1 && brokenLegs >= 1) {
    return {
      speedMult: penalties.oneLegBrokenSpeedMultiplier,
      turnMult: penalties.oneLegBrokenTurnMultiplier,
      canSprint: false,
      forceProneOnMove: false,
      canStand: true,
      intactLegs,
      brokenLegs,
      destroyedLegs,
    };
  }

  // 1 целая нога и все остальные разрушены (сломанных 0)
  if (intactLegs === 1 && brokenLegs === 0) {
    return {
      speedMult: penalties.oneLegDestroyedSpeedMultiplier,
      turnMult: penalties.oneLegDestroyedTurnMultiplier,
      canSprint: false,
      forceProneOnMove: true,
      canStand: true,
      intactLegs,
      brokenLegs,
      destroyedLegs,
    };
  }

  // 0 целых ног (все сломаны либо разрушены)
  return {
    speedMult: penalties.oneLegDestroyedSpeedMultiplier,
    turnMult: penalties.oneLegDestroyedTurnMultiplier,
    canSprint: false,
    forceProneOnMove: true,
    canStand: false,
    intactLegs,
    brokenLegs,
    destroyedLegs,
  };
}

export interface AggregatedSensoryStats {
  vision: {
    fovAngle: number;
    clarity: number;
    maxDistance: number;
  };
  hearing: {
    sensitivity: number;
    maxDistance: number;
  };
}

export function getSensoryStats(world: World, rootId: EntityId): AggregatedSensoryStats {
  const parts = getAnatomyParts(world, rootId);

  interface EyeData {
    status: PartStatus;
    fovAngle: number;
    clarity: number;
    maxDistance: number;
  }
  const eyes: EyeData[] = [];

  interface EarData {
    status: PartStatus;
    sensitivity: number;
    maxDistance: number;
  }
  const ears: EarData[] = [];

  for (const partId of parts) {
    const visionComp = world.getComponent(partId, 'vision');
    if (visionComp) {
      eyes.push({
        status: getPartStatus(world, partId),
        fovAngle: visionComp.fovAngle.current,
        clarity: visionComp.clarity.current,
        maxDistance: visionComp.maxDistance.current,
      });
    }

    const hearingComp = world.getComponent(partId, 'hearing');
    if (hearingComp) {
      ears.push({
        status: getPartStatus(world, partId),
        sensitivity: hearingComp.sensitivity.current,
        maxDistance: hearingComp.maxDistance.current,
      });
    }
  }

  // Агрегация зрения:
  // >= 1 целого глаза -> max среди целых
  // 0 целых и >= 1 сломанного -> 0.5 * max среди сломанных
  // 0 целых и 0 сломанных -> 0 (полная слепота)
  let visionFov = 0;
  let visionClarity = 0;
  let visionMaxDist = 0;

  const intactEyes = eyes.filter((e) => e.status === PartStatus.INTACT);
  const brokenEyes = eyes.filter((e) => e.status === PartStatus.BROKEN);

  const brokenMult = BALANCE_CONFIG.senses.brokenSenseMultiplier;

  if (intactEyes.length > 0) {
    visionFov = Math.max(...intactEyes.map((e) => e.fovAngle));
    visionClarity = Math.max(...intactEyes.map((e) => e.clarity));
    visionMaxDist = Math.max(...intactEyes.map((e) => e.maxDistance));
  } else if (brokenEyes.length > 0) {
    visionFov = brokenMult * Math.max(...brokenEyes.map((e) => e.fovAngle));
    visionClarity = brokenMult * Math.max(...brokenEyes.map((e) => e.clarity));
    visionMaxDist = brokenMult * Math.max(...brokenEyes.map((e) => e.maxDistance));
  }

  // Агрегация слуха:
  let hearingSens = 0;
  let hearingMaxDist = 0;

  const intactEars = ears.filter((e) => e.status === PartStatus.INTACT);
  const brokenEars = ears.filter((e) => e.status === PartStatus.BROKEN);

  if (intactEars.length > 0) {
    hearingSens = Math.max(...intactEars.map((e) => e.sensitivity));
    hearingMaxDist = Math.max(...intactEars.map((e) => e.maxDistance));
  } else if (brokenEars.length > 0) {
    hearingSens = brokenMult * Math.max(...brokenEars.map((e) => e.sensitivity));
    hearingMaxDist = brokenMult * Math.max(...brokenEars.map((e) => e.maxDistance));
  }

  return {
    vision: {
      fovAngle: visionFov,
      clarity: visionClarity,
      maxDistance: visionMaxDist,
    },
    hearing: {
      sensitivity: hearingSens,
      maxDistance: hearingMaxDist,
    },
  };
}

export function evaluateConsciousness(world: World, rootId: EntityId): ConsciousnessState {
  const rootHealth = world.getComponent(rootId, 'health');
  if (rootHealth && !rootHealth.isAlive) {
    return ConsciousnessState.DEAD;
  }

  const parts = getAnatomyParts(world, rootId);

  interface HeartData {
    partId: EntityId;
    status: PartStatus;
    requiresBrain: boolean;
  }
  const hearts: HeartData[] = [];

  interface BrainData {
    partId: EntityId;
    status: PartStatus;
    power: number;
    isActive: boolean;
  }
  const brains: BrainData[] = [];

  for (const partId of parts) {
    const heartComp = world.getComponent(partId, 'heart');
    if (heartComp) {
      hearts.push({
        partId,
        status: getPartStatus(world, partId),
        requiresBrain: heartComp.requiresBrain,
      });
    }

    const brainComp = world.getComponent(partId, 'bodyBrain');
    if (brainComp) {
      brains.push({
        partId,
        status: getPartStatus(world, partId),
        power: brainComp.power,
        isActive: brainComp.isActive,
      });
    }
  }

  // Существо ОБЯЗАНО иметь хотя бы одно Сердце (Ядро)
  if (hearts.length === 0) {
    return ConsciousnessState.DEAD;
  }

  // Если все сердца полностью разрушены -> Смерть
  const allHeartsDestroyed = hearts.every((h) => h.status === PartStatus.DESTROYED);
  if (allHeartsDestroyed) {
    return ConsciousnessState.DEAD;
  }

  // Поиск наиболее сильного мозга
  const bestBrain = brains.sort((a, b) => b.power - a.power)[0] ?? null;

  // Сердца с requiresBrain = true умирают, если мозг полностью разрушен или отсутствует
  const viableHearts = hearts.filter((h) => {
    if (h.status === PartStatus.DESTROYED) return false;
    if (h.requiresBrain) {
      if (!bestBrain || bestBrain.status === PartStatus.DESTROYED) {
        return false;
      }
    }
    return true;
  });

  // Если ни одного жизнеспособного сердца не осталось -> Смерть
  if (viableHearts.length === 0) {
    return ConsciousnessState.DEAD;
  }

  // Проверка потери сознания:
  // 1. Одно поврежденное ядро, все остальные разрушены/отсутствуют (нет ни одного INTACT сердца)
  const hasIntactHeart = viableHearts.some((h) => h.status === PartStatus.INTACT);
  if (!hasIntactHeart) {
    return ConsciousnessState.UNCONSCIOUS;
  }

  // 2. Состояние мозга:
  if (bestBrain) {
    // Мозг сломан (-max < ФП < 0) -> Потеря сознания
    if (bestBrain.status === PartStatus.BROKEN) {
      return ConsciousnessState.UNCONSCIOUS;
    }
    // Мозг полностью разрушен, но сердце автономно (requiresBrain = false) -> Живо, но без сознания
    if (bestBrain.status === PartStatus.DESTROYED) {
      return ConsciousnessState.UNCONSCIOUS;
    }
  } else {
    // Мозга нет вовсе, но есть автономное сердце -> Живо, но без сознания
    return ConsciousnessState.UNCONSCIOUS;
  }

  return ConsciousnessState.CONSCIOUS;
}
