import { Radians } from '../../utils';
import { World } from '../World';

export class MovementSystem {
  public update(dt: number, world: World): void {
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
        velocity.currentTurnSpeed = 0 as Radians;
        meta.state = 'dead';
        continue;
      }

      // 1. Расчет замедления от атак
      let moveSlow = 1;
      let turnSlow = 1;
      for (const atk of activeAttacks.attacks) {
        let mMove = 1;
        let mTurn = 1;

        const wStats = world.getComponent(atk.weaponId, 'weaponStats');
        if (!wStats) continue;

        const prepMoveSlow = wStats.prepMoveSlow.current;
        const prepTurnSlow = wStats.prepTurnSlow.current;
        const castMoveSlow = wStats.castMoveSlow.current;
        const recoveryMoveSlow = wStats.recoveryMoveSlow.current;
        const recoveryTurnSlow = wStats.recoveryTurnSlow.current;

        if (atk.phase === 'prep') {
          mMove = prepMoveSlow;
          mTurn = prepTurnSlow;
        } else if (atk.phase === 'cast') {
          mMove = castMoveSlow;
          mTurn = 0; // Во время задержки перед ударом поворот запрещен
        } else {
          mMove = recoveryMoveSlow;
          mTurn = recoveryTurnSlow;
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

      velocity.currentTurnSpeed = (input.turnDirection * turnSpeed * turnSlow * turnMult) as Radians;

      // 6. Поворот
      if (velocity.currentTurnSpeed !== 0) {
        transform.angle = (transform.angle + velocity.currentTurnSpeed * dt) as Radians;
      }

      // 7. Обновление состояния
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