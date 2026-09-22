import { BodyStructureType } from '../ecs/templates';

export interface RigProfile {
  rigAsset: string | null;
  animations: Record<string, string>;
  animationSpeeds?: Record<string, number>;
}

export const CREATURE_RIG_PROFILES: Record<BodyStructureType, RigProfile> = {
  humanoid: {
    rigAsset: 'proc://rig/humanoid',
    animations: {
      stand_idle: 'proc://anim/humanoid/stand_idle',
      stand_walk: 'proc://anim/humanoid/stand_walk',
      stand_jog: 'proc://anim/humanoid/stand_jog',
      stand_sprint: 'proc://anim/humanoid/stand_sprint',
      crouch_idle: 'proc://anim/humanoid/crouch_idle',
      crouch_walk: 'proc://anim/humanoid/crouch_walk',
      crouch_jog: 'proc://anim/humanoid/crouch_jog',
      crouch_sprint: 'proc://anim/humanoid/crouch_sprint',
      prone_idle: 'proc://anim/humanoid/prone_idle',
      prone_crawl: 'proc://anim/humanoid/prone_crawl',
      stand_to_crouch: 'proc://anim/humanoid/stand_to_crouch',
      crouch_to_stand: 'proc://anim/humanoid/crouch_to_stand',
      stand_to_prone: 'proc://anim/humanoid/stand_to_prone',
      prone_to_stand: 'proc://anim/humanoid/prone_to_stand',
      crouch_to_prone: 'proc://anim/humanoid/crouch_to_prone',
      prone_to_crouch: 'proc://anim/humanoid/prone_to_crouch',
      attack: 'proc://anim/humanoid/attack',
      pickup: 'proc://anim/humanoid/pickup',
      put_on: 'proc://anim/humanoid/put_on',
      take_off: 'proc://anim/humanoid/take_off',
      throw: 'proc://anim/humanoid/throw',
      retrieve_inv: 'proc://anim/humanoid/retrieve_inv',
      store_inv: 'proc://anim/humanoid/store_inv',
      dead: 'proc://anim/humanoid/dead',
      fall_back: 'proc://anim/humanoid/fall_back',
    },
    animationSpeeds: {
      attack: 1.5,
      pickup: 0.9,
      stand_sprint: 1.0,
      crouch_sprint: 1.0,
    },
  },
  quadruped: {
    rigAsset: 'proc://rig/quadruped',
    animations: {
      stand_idle: 'proc://anim/quadruped/stand_idle',
      stand_walk: 'proc://anim/quadruped/stand_walk',
      stand_jog: 'proc://anim/quadruped/stand_jog',
      stand_sprint: 'proc://anim/quadruped/stand_sprint',
      attack: 'proc://anim/quadruped/attack',
      dead: 'proc://anim/quadruped/dead',
    },
    animationSpeeds: {
      stand_sprint: 1.4,
    },
  },
  arachnid: {
    rigAsset: null,
    animations: {},
  },
};
