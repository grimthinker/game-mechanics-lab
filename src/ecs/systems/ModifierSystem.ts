import { World } from '../World';
import { StatValue } from '../types';
import { evaluateStat } from '../stats/StatEvaluator';

export class ModifierSystem {
  public update(dt: number, world: World): void {
    const entities = world.getAllEntities();

    for (const [_id, comp] of entities) {
      const ts = comp.timeScale?.multiplier.current ?? 1.0;
      const localDt = dt * ts;

      if (comp.health?.max) {
        const expired = this.tickStatModifiers(comp.health.max, localDt);
        if (expired) {
          comp.health.current = Math.min(comp.health.current, comp.health.max.current);
        }
      }
      if (comp.functionalHealth?.max) {
        const expired = this.tickStatModifiers(comp.functionalHealth.max, localDt);
        if (expired) {
          comp.functionalHealth.current = Math.min(
            comp.functionalHealth.current,
            comp.functionalHealth.max.current
          );
          comp.functionalHealth.current = Math.max(
            comp.functionalHealth.current,
            -2 * comp.functionalHealth.max.current
          );
        }
      }
      if (comp.socketLink?.links) {
        for (const link of Object.values(comp.socketLink.links)) {
          if (link.maxStrength) {
            this.tickStatModifiers(link.maxStrength, localDt);
          }
        }
      }
      if (comp.movementStats) {
        this.tickStatModifiers(comp.movementStats.maxSpeed, localDt);
        this.tickStatModifiers(comp.movementStats.maxTurnSpeed, localDt);
        this.tickStatModifiers(comp.movementStats.standToCrouchTime, localDt);
        this.tickStatModifiers(comp.movementStats.crouchToStandTime, localDt);
        this.tickStatModifiers(comp.movementStats.standToProneTime, localDt);
        this.tickStatModifiers(comp.movementStats.proneToStandTime, localDt);
        this.tickStatModifiers(comp.movementStats.crouchToProneTime, localDt);
        this.tickStatModifiers(comp.movementStats.proneToCrouchTime, localDt);
        if (comp.movementStats.throwPrepTime)
          this.tickStatModifiers(comp.movementStats.throwPrepTime, localDt);
        if (comp.movementStats.throwRecoveryTime)
          this.tickStatModifiers(comp.movementStats.throwRecoveryTime, localDt);
      }
      if (comp.stealthStats) {
        this.tickStatModifiers(comp.stealthStats.stealthPower, localDt);
      }
      if (comp.physicsStats) {
        this.tickStatModifiers(comp.physicsStats.radius, localDt);
        this.tickStatModifiers(comp.physicsStats.weight, localDt);
      }
      if (comp.weaponStats) {
        this.tickStatModifiers(comp.weaponStats.baseDamage, localDt);
        this.tickStatModifiers(comp.weaponStats.prepTime, localDt);
        this.tickStatModifiers(comp.weaponStats.castTime, localDt);
        this.tickStatModifiers(comp.weaponStats.recoveryTime, localDt);
      }
      if (comp.armorStats) {
        this.tickStatModifiers(comp.armorStats.defense, localDt);
        this.tickStatModifiers(comp.armorStats.flatReduction, localDt);
      }
      if (comp.timeScale) {
        // Модификаторы времени тикают по мировому симулированному dt,
        // чтобы замедление или заморозка (timeScale = 0) гарантированно могли истечь
        this.tickStatModifiers(comp.timeScale.multiplier, dt);
      }
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
