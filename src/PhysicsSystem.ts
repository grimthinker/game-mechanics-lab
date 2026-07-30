import { System, Line, Circle } from 'detect-collisions';
import { Creature } from './Creature';
import { ObstacleSegment, WeaponConfig, Point } from './types';

const PHYSICS_CONFIG = {
  A: 10,          // Коэффициент жесткости расталкивания существ
  C: 0.5,         // Максимальный коэффициент импульса за один кадр
  B: 0.01,        // Буфер при выталкивании из стен [cite: 161]
  d_min: 0.001,   // Минимальный порог смещения [cite: 166]
  R_mult: Math.sin(Math.PI / 4) // ~0.707 — множитель радиуса для sub-stepping [cite: 56, 131]
};

const creaturesMap = new WeakMap<any, Creature>();

export class PhysicsSystem {
  public system: System;
  private obstacleLines: Line[] = [];
  public obstaclesEnabled: boolean = true;

  constructor() {
    this.system = new System();
  }

  public addCreature(creature: Creature): void {
    creaturesMap.set(creature.body, creature);
    this.system.insert(creature.body);
  }

  public removeCreature(creature: Creature): void {
    creaturesMap.delete(creature.body);
    this.system.remove(creature.body);
  }

  // --- Препятствия ---

  public loadObstacles(segments: ObstacleSegment[]): void {
    this.clearObstacles();
    for (const seg of segments) {
      const line = new Line(
        { x: seg.start.x, y: seg.start.y },
        { x: seg.end.x, y: seg.end.y },
        { isStatic: true }
      );
      this.obstacleLines.push(line);
      if (this.obstaclesEnabled) {
        this.system.insert(line);
      }
    }
  }

  public setObstaclesEnabled(enabled: boolean): void {
    if (this.obstaclesEnabled === enabled) return;
    this.obstaclesEnabled = enabled;
    for (const line of this.obstacleLines) {
      if (enabled) {
        this.system.insert(line);
      } else {
        this.system.remove(line);
      }
    }
  }

  public clearObstacles(): void {
    for (const line of this.obstacleLines) {
      this.system.remove(line);
    }
    this.obstacleLines = [];
  }

  public getObstacleLines(): Line[] {
    return this.obstacleLines;
  }

  // --- Фильтры коллизий ---

  private canCollide(c1: Creature, c2: Creature): boolean {
    if (!c1.isAlive || c1.hp <= 0 || !c2.isAlive || c2.hp <= 0) {
      return false;
    }
    return true;
  }

  // --- Защита от туннелирования (Sub-stepping) ---

  public moveCreatureSafe(creature: Creature, dx: number, dy: number): void {
    const body = creature.body as Circle;
    const moveSq = dx * dx + dy * dy;
    const radiusThreshold = body.r * PHYSICS_CONFIG.R_mult;

    let steps = 1;
    if (moveSq > radiusThreshold * radiusThreshold) {
      const maxDim = Math.max(Math.abs(dx), Math.abs(dy));
      steps = maxDim / radiusThreshold;
      steps = steps > 2 ? Math.ceil(steps) : 2;
    }

    const stepX = dx / steps;
    const stepY = dy / steps;

    for (let i = 0; i < steps; i++) {
      body.setPosition(body.x + stepX, body.y + stepY);
      this.resolveObstaclesForCreature(creature);
    }

    creature.syncFromPhysics();
  }

  private resolveObstaclesForCreature(creature: Creature): void {
    if (!this.obstaclesEnabled) return;

    const potentials = this.system.getPotentials(creature.body);
    for (const wall of potentials) {
      if (wall instanceof Line && this.system.checkCollision(creature.body, wall)) {
        const response = this.system.response;
        const pushX = response.overlap * response.overlapV.x + PHYSICS_CONFIG.B * Math.sign(response.overlapV.x);
        const pushY = response.overlap * response.overlapV.y + PHYSICS_CONFIG.B * Math.sign(response.overlapV.y);

        creature.body.setPosition(
          creature.body.x - pushX,
          creature.body.y - pushY
        );
      }
    }
  }

  // --- Главный цикл обновления физики ---

  public update(dt: number, creatures: Creature[]): void {
    this.system.update();

    // 1. Расталкивание существ друг с другом с учетом масс (Step 1) [cite: 155]
    this.system.checkAll((response) => {
      const c1 = response.a;
      const c2 = response.b;

      if (c1.isStatic || c2.isStatic) return;

      const creature1 = creaturesMap.get(c1);
      const creature2 = creaturesMap.get(c2);
      if (!creature1 || !creature2) return;

      if (!this.canCollide(creature1, creature2)) return;

      const overlapX = response.overlap * response.overlapV.x;
      const overlapY = response.overlap * response.overlapV.y;

      const totalMass = creature1.mass + creature2.mass;
      const ratio1 = creature2.mass / totalMass;
      const ratio2 = creature1.mass / totalMass;

      const mult = Math.min(PHYSICS_CONFIG.C, dt * PHYSICS_CONFIG.A);
      const deltaX1 = mult * overlapX * ratio1;
      const deltaY1 = mult * overlapY * ratio1;
      const deltaX2 = mult * overlapX * ratio2;
      const deltaY2 = mult * overlapY * ratio2;

      if (Math.abs(deltaX1) > PHYSICS_CONFIG.d_min || Math.abs(deltaY1) > PHYSICS_CONFIG.d_min) {
        creature1.body.setPosition(creature1.body.x - deltaX1, creature1.body.y - deltaY1);
        creature1.syncFromPhysics();
      }
      if (Math.abs(deltaX2) > PHYSICS_CONFIG.d_min || Math.abs(deltaY2) > PHYSICS_CONFIG.d_min) {
        creature2.body.setPosition(creature2.body.x + deltaX2, creature2.body.y + deltaY2);
        creature2.syncFromPhysics();
      }
    });

    // 2. Гарантированное вторичное выталкивание всех существ из стен (Step 2) [cite: 156]
    if (this.obstaclesEnabled) {
      for (const creature of creatures) {
        if (!creature.isAlive) continue;
        this.resolveObstaclesForCreature(creature);
        creature.syncFromPhysics();
      }
    }
  }

  // --- Проверка препятствий при атаках ---

  private isLineOfSightBlocked(from: Point, to: Point): boolean {
    if (!this.obstaclesEnabled) return false;
    const rayResult = this.system.raycast(from, to);
    return rayResult ? rayResult.body instanceof Line : false;
  }

  // --- Попадания атак ---

  public checkWeaponHits(attacker: Creature, weapon: WeaponConfig, allCreatures: Creature[]): Creature[] {
    const hitCreatures: Creature[] = [];
    const pos = attacker.position;
    const angle = attacker.angle;

    for (const target of allCreatures) {
      if (target === attacker || !target.isAlive || target.hp <= 0) continue;

      let isHit = false;
      const dx = target.position.x - pos.x;
      const dy = target.position.y - pos.y;
      const dist = Math.hypot(dx, dy);

      switch (weapon.hitZoneType) {
        case 'radius': {
          const r = weapon.radius ?? 50;
          if (dist <= r + target.radius) {
            isHit = !this.isLineOfSightBlocked(pos, target.position);
          }
          break;
        }
        case 'angle': {
          const len = weapon.length ?? 120;
          const maxAngle = (weapon.angle ?? Math.PI / 6) / 2; // Половина угла сектора
          const dist = Math.hypot(target.position.x - pos.x, target.position.y - pos.y);
          const maxDist = len + target.radius;
        
          if (dist <= maxDist) {
            const targetAngle = Math.atan2(target.position.y - pos.y, target.position.x - pos.x);
            let angleDiff = targetAngle - angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            angleDiff = Math.abs(angleDiff);
        
            // Расширяем угловой диапазон на угол, который занимает радиус цели на данной дистанции
            const angularTolerance = dist > 0 ? Math.asin(Math.min(1, target.radius / dist)) : 0;
            
            if (angleDiff <= maxAngle + angularTolerance) {
              if (!this.isLineOfSightBlocked(pos, target.position)) {
                isHit = true;
              }
            }
          }
          break;
        }
        case 'line':
        case 'forward_line': {
          const len = (weapon.length ?? 150);
          // Максимальная дистанция увеличивается на радиус цели
          const maxDist = len + target.radius;
          const dist = Math.hypot(target.position.x - pos.x, target.position.y - pos.y);
          
          if (dist <= maxDist) {
            // Проверка угла / направления с учетом углового допуска для размера цели
            const targetAngle = Math.atan2(target.position.y - pos.y, target.position.x - pos.x);
            let angleDiff = Math.abs(targetAngle - angle);
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            angleDiff = Math.abs(angleDiff);
        
            // Допуск по углу расширяется на основе радиуса цели и расстояния
            const angularTolerance = Math.asin(Math.min(1, target.radius / Math.max(1, dist)));
            const maxAllowedAngle = (Math.PI / 6) + angularTolerance; // Например, для узкого луча/линии
        
            if (angleDiff <= maxAllowedAngle && !this.isLineOfSightBlocked(pos, target.position)) {
              isHit = true;
            }
          }
          break;
        }
        case 'shrapnel': {
          const len = weapon.length ?? 120;
          const maxAngle = (weapon.angle ?? Math.PI / 3) / 2;
          const count = weapon.rayCount ?? 5;
          for (let i = 0; i < count; i++) {
            const fraction = count > 1 ? i / (count - 1) - 0.5 : 0;
            const rayAngle = angle + fraction * (maxAngle * 2);
            const rx = pos.x + Math.cos(rayAngle) * len;
            const ry = pos.y + Math.sin(rayAngle) * len;
            const res = this.system.raycast({ x: pos.x, y: pos.y }, { x: rx, y: ry });
            if (res && res.body === target.body) {
              isHit = true;
              break;
            }
          }
          break;
        }
        case 'offset_radius': {
          const offset = weapon.offsetDistance ?? 70;
          const r = weapon.radius ?? 35;
          const centerX = pos.x + Math.cos(angle) * offset;
          const centerY = pos.y + Math.sin(angle) * offset;
          const dCenter = Math.hypot(target.position.x - centerX, target.position.y - centerY);
          if (dCenter <= r + target.radius) {
            isHit = !this.isLineOfSightBlocked(pos, target.position);
          }
          break;
        }
      }

      if (isHit) {
        hitCreatures.push(target);
      }
    }

    return hitCreatures;
  }
}