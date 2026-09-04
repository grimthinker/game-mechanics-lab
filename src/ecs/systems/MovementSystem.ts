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
      'meta',
      'movementStats'
    );

    for (const [id, { transform, velocity, input, health, activeAttacks, meta, movementStats }] of entities) {
      const healthStats = world.getComponent(id, 'healthStats');
      if (!health.isAlive || (healthStats && healthStats.hp.current <= 0)) {
        velocity.currentSpeed = 0;
        velocity.currentTurnSpeed = 0;
        meta.state = 'dead';
        continue;
      }

      // 1. Расчет стелса через текущие статы
      const stealthStats = world.getComponent(id, 'stealthStats');
      if (stealthStats) {
        if (input.isCrouching) {
          stealthStats.stealthPower.current = stealthStats.stealthPower.base * stealthStats.crouchStealthMultiplier.current;
        } else if (input.isRunning) {
          stealthStats.stealthPower.current = stealthStats.stealthPower.base * stealthStats.runStealthMultiplier.current;
        } else {
          stealthStats.stealthPower.current = stealthStats.stealthPower.base;
        }
      }

      // 2. Расчет замедления от атак
      let moveSlow = 1;
      let turnSlow = 1;
      for (const atk of activeAttacks.attacks) {
        let mMove = 1;
        let mTurn = 1;

        if (atk.phase === 'prep') {
          mMove = atk.weapon.prepMoveSlow;
          mTurn = atk.weapon.prepTurnSlow;
        } else if (atk.phase === 'cast') {
          mMove = atk.weapon.castMoveSlow ?? atk.weapon.prepMoveSlow;
          mTurn = 0; // Во время задержки перед ударом поворот запрещен
        } else {
          mMove = atk.weapon.recoveryMoveSlow;
          mTurn = atk.weapon.recoveryTurnSlow;
        }

        if (mMove < moveSlow) moveSlow = mMove;
        if (mTurn < turnSlow) turnSlow = mTurn;
      }

      // 3. Множитель скорости
      let speedMult = 1;
      if (input.isRunning) {
        speedMult = movementStats.runSpeedMultiplier.current;
      } else if (input.isCrouching) {
        speedMult = movementStats.crouchSpeedMultiplier.current;
      }
      velocity.currentSpeed = (input.isMovingForward ? movementStats.maxSpeed.current * speedMult : 0) * moveSlow;

      // 4. Множитель поворота
      let turnMult = 1;
      if (input.isRunning) {
        turnMult = movementStats.runTurnMultiplier.current;
      } else if (input.isCrouching) {
        turnMult = movementStats.crouchTurnMultiplier.current;
      }

      // 5. Ограничение скорости поворота максимальным значением скорости поворота игрока
      const turnSpeed = Math.min(movementStats.maxTurnSpeed.current, input.turnSpeed);

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