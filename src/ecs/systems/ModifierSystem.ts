import { World } from '../World';
import { StatValue } from '../types';
import { evaluateStat } from '../stats/StatEvaluator';

export class ModifierSystem {
  public update(dt: number, world: World): void {
    const getLocalDt = (id: string): number => {
      const ts = world.getComponent(id, 'timeScale')?.multiplier.current ?? 1.0;
      return dt * ts;
    };

    // 1. Модификаторы масштаба времени (тикают по реальному dt симуляции, чтобы заморозка могла истечь)
    for (const [, { timeScale }] of world.getEntitiesWith('timeScale')) {
      this.tickStatModifiers(timeScale.multiplier, dt);
    }

    // 2. Здоровье
    for (const [id, { health }] of world.getEntitiesWith('health')) {
      if (health.max) {
        const localDt = getLocalDt(id);
        const expired = this.tickStatModifiers(health.max, localDt);
        if (expired) {
          health.current = Math.min(health.current, health.max.current);
        }
      }
    }

    // 3. Функциональная прочность
    for (const [id, { functionalHealth }] of world.getEntitiesWith('functionalHealth')) {
      if (functionalHealth.max) {
        const localDt = getLocalDt(id);
        const expired = this.tickStatModifiers(functionalHealth.max, localDt);
        if (expired) {
          functionalHealth.current = Math.min(
            functionalHealth.current,
            functionalHealth.max.current
          );
          functionalHealth.current = Math.max(
            functionalHealth.current,
            -2 * functionalHealth.max.current
          );
        }
      }
    }

    // 4. Связи сокетов анатомии
    for (const [id, { socketLink }] of world.getEntitiesWith('socketLink')) {
      if (socketLink.links) {
        const localDt = getLocalDt(id);
        for (const link of Object.values(socketLink.links)) {
          if (link.maxStrength) {
            this.tickStatModifiers(link.maxStrength, localDt);
          }
        }
      }
    }

    // 5. Характеристики движения (обрабатываются только ходячие существа)
    for (const [id, { movementStats }] of world.getEntitiesWith('movementStats')) {
      const localDt = getLocalDt(id);
      this.tickStatModifiers(movementStats.maxSpeed, localDt);
      this.tickStatModifiers(movementStats.maxTurnSpeed, localDt);
      this.tickStatModifiers(movementStats.standToCrouchTime, localDt);
      this.tickStatModifiers(movementStats.crouchToStandTime, localDt);
      this.tickStatModifiers(movementStats.standToProneTime, localDt);
      this.tickStatModifiers(movementStats.proneToStandTime, localDt);
      this.tickStatModifiers(movementStats.crouchToProneTime, localDt);
      this.tickStatModifiers(movementStats.proneToCrouchTime, localDt);
      if (movementStats.dropPrepTime) {
        this.tickStatModifiers(movementStats.dropPrepTime, localDt);
      }
      if (movementStats.dropRecoveryTime) {
        this.tickStatModifiers(movementStats.dropRecoveryTime, localDt);
      }
      if (movementStats.jumpVelocity) {
        this.tickStatModifiers(movementStats.jumpVelocity, localDt);
      }
      if (movementStats.maxJumpSlopeAngle) {
        this.tickStatModifiers(movementStats.maxJumpSlopeAngle, localDt);
      }
    }

    // 5.1. Характеристики ориентации головы
    for (const [id, { headOrientation }] of world.getEntitiesWith('headOrientation')) {
      const localDt = getLocalDt(id);
      this.tickStatModifiers(headOrientation.turnSpeed, localDt);
    }

    // 6. Скрытность
    for (const [id, { stealthStats }] of world.getEntitiesWith('stealthStats')) {
      const localDt = getLocalDt(id);
      this.tickStatModifiers(stealthStats.stealthPower, localDt);
    }

    // 7. Физические статы
    for (const [id, { physicsStats }] of world.getEntitiesWith('physicsStats')) {
      const localDt = getLocalDt(id);
      this.tickStatModifiers(physicsStats.radius, localDt);
      this.tickStatModifiers(physicsStats.weight, localDt);
    }

    // 8. Оружие
    for (const [id, { weaponStats }] of world.getEntitiesWith('weaponStats')) {
      const localDt = getLocalDt(id);
      this.tickStatModifiers(weaponStats.baseDamage, localDt);
      this.tickStatModifiers(weaponStats.prepTime, localDt);
      this.tickStatModifiers(weaponStats.castTime, localDt);
      this.tickStatModifiers(weaponStats.recoveryTime, localDt);
    }

    // 9. Броня
    for (const [id, { armorStats }] of world.getEntitiesWith('armorStats')) {
      const localDt = getLocalDt(id);
      this.tickStatModifiers(armorStats.defense, localDt);
      this.tickStatModifiers(armorStats.flatReduction, localDt);
    }
  }

  private tickStatModifiers(stat: StatValue<any> | undefined, dt: number): boolean {
    if (!stat || !stat.modifiers || stat.modifiers.length === 0) return false;

    let hasExpired = false;

    for (let i = stat.modifiers.length - 1; i >= 0; i--) {
      const mod = stat.modifiers[i];
      if (mod.duration !== undefined) {
        mod.duration -= dt;
        if (mod.duration <= 0) {
          stat.modifiers.splice(i, 1);
          hasExpired = true;
        }
      }
    }

    if (hasExpired) {
      stat.current = evaluateStat(stat);
    }

    return hasExpired;
  }
}
