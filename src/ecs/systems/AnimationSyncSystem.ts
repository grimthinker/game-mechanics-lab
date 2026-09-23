import { World } from '../World';

export class AnimationSyncSystem {
  public update(_dt: number, world: World): void {
    const entities = world.getEntitiesWith('animator', 'meta');

    for (const [id, { animator, meta }] of entities) {
      const health = world.getComponent(id, 'health');
      const isAlive = health ? health.isAlive : true;
      const activeAttacks = world.getComponent(id, 'activeAttacks');
      const stanceTransition = world.getComponent(id, 'stanceTransition');

      let targetAnim = 'stand_idle';

      const interactionAction = world.getComponent(id, 'interactionAction');

      if (!isAlive) {
        targetAnim = 'dead';
      } else if (activeAttacks && activeAttacks.attacks.length > 0) {
        const slotKind = activeAttacks.attacks[0]?.slotKind || 'left_hand';
        targetAnim = `attack_${slotKind}`;
      } else if (meta.actionMode === 'pickup') {
        const slotKind = interactionAction?.slotKind || 'left_hand';
        targetAnim = `pickup_${slotKind}`;
      } else if (meta.actionMode === 'drop') {
        const slotKind = interactionAction?.slotKind || 'left_hand';
        targetAnim = `drop_item_${slotKind}`;
      } else if (stanceTransition && stanceTransition.transitionStance) {
        // Проигрываем анимацию перехода между стойками (например: stand_to_prone, prone_to_stand)
        targetAnim = stanceTransition.transitionStance;
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
              : moveMode === 'walking' || moveMode === 'turning'
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

      // Динамическое скалирование скорости анимации (Kinematic Animation Scaling)
      // Предотвращает эффект проскальзывания ног, жестко синхронизируя анимацию с реальным перемещением тела.
      const movementStats = world.getComponent(id, 'movementStats');
      const velocity = world.getComponent(id, 'velocity');

      if (
        (targetAnim.includes('walk') ||
          targetAnim.includes('jog') ||
          targetAnim.includes('sprint') ||
          targetAnim.includes('crawl')) &&
        movementStats &&
        velocity
      ) {
        const actualSpd = velocity.actualSpeed ?? velocity.currentSpeed ?? 0;
        const targetSpd = movementStats.maxSpeed.current ?? 1;

        // Учитываем вращение корпуса, чтобы ноги реалистично перебирали при повороте на месте
        let turnContribution = 0;
        if (Math.abs(velocity.currentTurnSpeed) > 0.01) {
          turnContribution = Math.abs(velocity.currentTurnSpeed) * 1.2;
        }

        const effectiveSpeed = Math.max(actualSpd, turnContribution);

        if (targetSpd > 0.1) {
          const scale = effectiveSpeed / targetSpd;

          // Полная остановка анимации, если мы уперлись в стену (скорость = 0)
          if (effectiveSpeed < 0.05 && meta.movementMode !== 'turning') {
            animator.playbackSpeed = 0;
          } else {
            // Ограничение множителя во избежание визуальных глитчей и дерганий
            animator.playbackSpeed = Math.max(0.1, Math.min(2.5, scale));
          }
        }
      } else {
        // Сброс на базовую нормальную скорость для атак, бездействия (idle), подборов и бросков
        animator.playbackSpeed = 1.0;
      }
    }
  }
}
