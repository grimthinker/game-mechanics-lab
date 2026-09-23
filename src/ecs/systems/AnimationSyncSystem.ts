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
      } else if (meta.stance === 'airborne') {
        targetAnim = 'airborne';
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

      if (targetAnim === 'airborne') {
        animator.playbackSpeed = 1.0;
      } else if (
        (targetAnim.includes('walk') ||
          targetAnim.includes('jog') ||
          targetAnim.includes('sprint') ||
          targetAnim.includes('crawl')) &&
        movementStats &&
        velocity
      ) {
        const actualSpd = velocity.actualSpeed ?? velocity.currentSpeed ?? 0;
        const targetSpd = movementStats.maxSpeed.current ?? 1;

        let scale = 1.0;

        if (meta.movementMode === 'turning') {
          // При повороте на месте скорость шага пропорциональна угловой скорости, без взлета до 2.5x
          const maxTurn = movementStats.maxTurnSpeed.current ?? 1;
          const turnRatio = Math.min(
            1.0,
            Math.abs(velocity.currentTurnSpeed) / Math.max(0.1, maxTurn)
          );
          scale = Math.max(0.5, turnRatio);
        } else {
          // При линейном движении соотносим фактическую скорость с ожидаемой для данного режима
          if (actualSpd < 0.05) {
            scale = 0; // Полная остановка анимации, если персонаж уперся в стену
          } else if (targetSpd > 0.1) {
            scale = actualSpd / targetSpd;
          }
        }

        if (actualSpd < 0.05 && meta.movementMode !== 'turning') {
          animator.playbackSpeed = 0;
        } else {
          // Ограничиваем диапазон разумными пределами (0.2x - 1.5x) во избежание резких рывков
          animator.playbackSpeed = Math.max(0.2, Math.min(1.5, scale));
        }
      } else {
        // Сброс на базовую нормальную скорость для атак, бездействия (idle), подборов и бросков
        animator.playbackSpeed = 1.0;
      }
    }
  }
}
