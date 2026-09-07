import { World } from '../World';
import { StatValue } from '../types';
import { evaluateStat } from '../stats/StatEvaluator';

export class ModifierSystem {
  public update(dt: number, world: World): void {
    const entities = world.getAllEntities();

    for (const [_id, comp] of entities) {
      if (comp.health?.max) {
        const expired = this.tickStatModifiers(comp.health.max, dt);
        if (expired) {
          comp.health.current = Math.min(comp.health.current, comp.health.max.current);
        }
      }
      if (comp.movementStats) {
        this.tickStatModifiers(comp.movementStats.maxSpeed, dt);
        this.tickStatModifiers(comp.movementStats.maxTurnSpeed, dt);
      }
      if (comp.stealthStats) {
        this.tickStatModifiers(comp.stealthStats.stealthPower, dt);
      }
      if (comp.physicsStats) {
        this.tickStatModifiers(comp.physicsStats.radius, dt);
        this.tickStatModifiers(comp.physicsStats.weight, dt);
      }
      if (comp.weaponStats) {
        this.tickStatModifiers(comp.weaponStats.baseDamage, dt);
        this.tickStatModifiers(comp.weaponStats.prepTime, dt);
        this.tickStatModifiers(comp.weaponStats.castTime, dt);
        this.tickStatModifiers(comp.weaponStats.recoveryTime, dt);
      }
      if (comp.armorStats) {
        this.tickStatModifiers(comp.armorStats.defense, dt);
        this.tickStatModifiers(comp.armorStats.flatReduction, dt);
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
