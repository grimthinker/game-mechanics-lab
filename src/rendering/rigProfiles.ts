import { BodyStructureType } from '../ecs/templates';

export interface RigProfile {
  rigAsset: string;
  animations: Record<string, string>;
}

export const CREATURE_RIG_PROFILES: Record<BodyStructureType, RigProfile> = {
  humanoid: {
    rigAsset: '3d/creatures/humanoid/rig.glb',
    animations: {
      // Стойка: Стоя
      stand_idle: '3d/creatures/humanoid/anim/StandIdle.glb',
      stand_walk: '3d/creatures/humanoid/anim/StandWalk.glb',
      stand_jog: '3d/creatures/humanoid/anim/StandJogging.glb',
      stand_sprint: '3d/creatures/humanoid/anim/StandSprint.glb',

      // Стойка: Присед
      crouch_idle: '3d/creatures/humanoid/anim/CrouchIdle.glb',
      crouch_walk: '3d/creatures/humanoid/anim/CrouchWalk.glb',
      crouch_jog: '3d/creatures/humanoid/anim/CrouchJogging.glb',
      crouch_sprint: '3d/creatures/humanoid/anim/CrouchSprint.glb',

      // Стойка: Лёжа
      prone_idle: '3d/creatures/humanoid/anim/ProneIdle.glb',
      prone_crawl: '3d/creatures/humanoid/anim/ProneCrawl.glb',

      // Переходы между стойками
      stand_to_crouch: '3d/creatures/humanoid/anim/CrouchIdle.glb', // Пока используем idle приседа, если нет отдельной анимации перехода StandToCrouch
      crouch_to_stand: '3d/creatures/humanoid/anim/StandIdle.glb',
      stand_to_prone: '3d/creatures/humanoid/anim/StandToProne.glb',
      prone_to_stand: '3d/creatures/humanoid/anim/ProneToStand.glb',
      crouch_to_prone: '3d/creatures/humanoid/anim/CrouchToProne.glb',
      prone_to_crouch: '3d/creatures/humanoid/anim/ProneToCrouch.glb',

      // Действия
      attack: '3d/creatures/humanoid/anim/Attack.glb',
      pickup: '3d/creatures/humanoid/anim/Pickup.glb',
      put_on: '3d/creatures/humanoid/anim/PutOn.glb',
      take_off: '3d/creatures/humanoid/anim/TakeOff.glb',
      throw: '3d/creatures/humanoid/anim/ThrowItem.glb',
      retrieve_inv: '3d/creatures/humanoid/anim/RetrieveFromInventory.glb',
      store_inv: '3d/creatures/humanoid/anim/StoreInInventory.glb',

      // Смерть
      dead: '3d/creatures/humanoid/anim/Dead.glb',
      fall_back: '3d/creatures/humanoid/anim/FallBack.glb',
    },
  },
  quadruped: {
    rigAsset: '',
    animations: {},
  },
  arachnid: {
    rigAsset: '',
    animations: {},
  },
};
