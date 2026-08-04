import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';

export class MovementSystem {
  public update(dt: number, world: World, physics: PhysicsSystem): void {
    const entities = world.getEntitiesWith(
      'transform',
      'velocity',
      'input',
      'health',
      'activeAttacks',
      'stealth',
      'meta',
      'stats'
    );

    for (const [id, { transform, velocity, input, health, activeAttacks, stealth, meta, stats }] of entities) {
      if (!health.isAlive || stats.hp.current <= 0) {
        velocity.currentSpeed = 0;
        velocity.currentTurnSpeed = 0;
        meta.state = 'dead';
        continue;
      }

      // 1. Расчет стелса через текущие статы
      stats.stealth.current = input.isCrouching
        ? stats.stealth.base * stats.crouchStealthMultiplier.current
        : stats.stealth.base;

      // 2. Расчет замедления от атак
      let moveSlow = 1;
      let turnSlow = 1;
      for (const atk of activeAttacks.attacks) {
        const mMove = atk.phase === 'prep' ? atk.weapon.prepMoveSlow : atk.weapon.recoveryMoveSlow;
        const mTurn = atk.phase === 'prep' ? atk.weapon.prepTurnSlow : atk.weapon.recoveryTurnSlow;
        if (mMove < moveSlow) moveSlow = mMove;
        if (mTurn < turnSlow) turnSlow = mTurn;
      }

      // 3. Множитель скорости
      let speedMult = 1;
      if (input.isRunning) {
        speedMult = stats.runSpeedMultiplier.current;
      } else if (input.isCrouching) {
        speedMult = stats.crouchSpeedMultiplier.current;
      }
      velocity.currentSpeed = (input.isMovingForward ? stats.maxSpeed.current * speedMult : 0) * moveSlow;

      // 4. Множитель поворота
      let turnMult = 1;
      if (input.isRunning) {
        turnMult = stats.runTurnMultiplier.current;
      } else if (input.isCrouching) {
        turnMult = stats.crouchTurnMultiplier.current;
      }

      // 5. Ограничение скорости поворота максимальным значением скорости поворота игрока
      const turnSpeed = Math.min(stats.maxTurnSpeed.current, input.turnSpeed);

      velocity.currentTurnSpeed = input.turnDirection * turnSpeed * turnSlow * turnMult;

      // 6. Поворот
      if (velocity.currentTurnSpeed !== 0) {
        transform.angle += velocity.currentTurnSpeed * dt;
      }

      // 7. Движение
      if (velocity.currentSpeed > 0) {
        const dx = Math.cos(transform.angle) * velocity.currentSpeed * dt;
        const dy = Math.sin(transform.angle) * velocity.currentSpeed * dt;
        physics.moveEntitySafe(world, id, dx, dy);
      }

      // 8. Обновление состояния
      if (activeAttacks.attacks.length > 0) {
        meta.state = 'attacking';
      } else if (input.isRunning && (input.isMovingForward || input.turnDirection !== 0)) {
        meta.state = 'running';
      } else if (input.isCrouching && (input.isMovingForward || input.turnDirection !== 0)) {
        meta.state = 'crouching';
      } else if (input.isMovingForward || input.turnDirection !== 0) {
        meta.state = 'moving';
      } else {
        meta.state = 'idle';
      }
    }
  }
}