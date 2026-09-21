import { World } from '../World';

export class AnimationSyncSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('animator', 'meta');

    for (const [id, { animator, meta }] of entities) {
      const health = world.getComponent(id, 'health');
      const isAlive = health ? health.isAlive : true;
      const activeAttacks = world.getComponent(id, 'activeAttacks');

      let targetAnim = 'stand_idle';

      if (!isAlive) {
        targetAnim = 'dead';
      } else if (activeAttacks && activeAttacks.attacks.length > 0) {
        targetAnim = 'attack';
      } else if (meta.actionMode === 'pickup') {
        targetAnim = 'pickup';
      } else {
        const stance = meta.stance || 'standing';
        const moveMode = meta.movementMode || 'immobile';

        const prefix = stance.includes('crouch')
          ? 'crouch'
          : stance.includes('prone')
            ? 'prone'
            : 'stand';

        const suffix =
          moveMode === 'sprinting'
            ? 'sprint'
            : moveMode === 'jogging'
              ? 'jog'
              : moveMode === 'walking'
                ? 'walk'
                : 'idle';

        if (prefix === 'prone' && (suffix === 'walk' || suffix === 'sprint' || suffix === 'jog')) {
          targetAnim = 'prone_crawl';
        } else {
          targetAnim = `${prefix}_${suffix}`;
        }
      }

      if (animator.currentAnimation !== targetAnim) {
        animator.currentAnimation = targetAnim;
      }
    }
  }
}
