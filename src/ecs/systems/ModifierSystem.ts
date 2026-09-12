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
      if (comp.movementStats) {
        this.tickStatModifiers(comp.movementStats.maxSpeed, localDt);
        this.tickStatModifiers(comp.movementStats.maxTurnSpeed, localDt);
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
