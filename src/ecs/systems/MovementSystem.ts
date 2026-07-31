import { World } from '../World';
import { PhysicsSystem } from './PhysicsSystem';

export class MovementSystem {
  public update(dt: number, world: World, physics: PhysicsSystem): void {
    const entities = world.getEntitiesWith(
      'transform',
      'velocity',
      'input',
      'health',
      'weaponInventory',
      'stealth',
      'meta'
    );

    for (const [id, { transform, velocity, input, health, weaponInventory, stealth, meta }] of entities) {
      if (!health.isAlive || health.hp <= 0) {
        velocity.currentSpeed = 0;
        velocity.currentTurnSpeed = 0;
        meta.state = 'dead';
        continue;
      }

      // 1. Расчет стелса
      stealth.stealth = input.isCrouching
        ? stealth.baseStealth * stealth.crouchStealthMultiplier
        : stealth.baseStealth;

      // 2. Расчет замедления от атак
      let moveSlow = 1;
      let turnSlow = 1;
      for (const atk of weaponInventory.activeAttacks) {
        const mMove = atk.phase === 'prep' ? atk.weapon.prepMoveSlow : atk.weapon.recoveryMoveSlow;
        const mTurn = atk.phase === 'prep' ? atk.weapon.prepTurnSlow : atk.weapon.recoveryTurnSlow;
        if (mMove < moveSlow) moveSlow = mMove;
        if (mTurn < turnSlow) turnSlow = mTurn;
      }

      // 3. Множитель скорости
      let speedMult = 1;
      if (input.isRunning) {
        speedMult = velocity.runSpeedMultiplier;
      } else if (input.isCrouching) {
        speedMult = velocity.crouchSpeedMultiplier;
      }

      velocity.currentSpeed = (input.isMovingForward ? velocity.maxSpeed * speedMult : 0) * moveSlow;
      velocity.currentTurnSpeed = input.turningDirection * velocity.maxTurnSpeed * turnSlow;

      // 4. Поворот
      if (velocity.currentTurnSpeed !== 0) {
        transform.angle += velocity.currentTurnSpeed * dt;
      }

      // 5. Движение
      if (velocity.currentSpeed > 0) {
        const dx = Math.cos(transform.angle) * velocity.currentSpeed * dt;
        const dy = Math.sin(transform.angle) * velocity.currentSpeed * dt;
        physics.moveEntitySafe(world, id, dx, dy);
      }

      // 6. Обновление состояния (Meta)
      if (weaponInventory.activeAttacks.length > 0) {
        meta.state = 'attacking';
      } else if (input.isRunning && (input.isMovingForward || input.turningDirection !== 0)) {
        meta.state = 'running';
      } else if (input.isCrouching && (input.isMovingForward || input.turningDirection !== 0)) {
        meta.state = 'crouching';
      } else if (input.isMovingForward || input.turningDirection !== 0) {
        meta.state = 'moving';
      } else {
        meta.state = 'idle';
      }
    }
  }
}