import { System, Line, Circle } from 'detect-collisions';
import { Creature } from './Creature';
import { ObstacleSegment } from './types';

// Внутренние параметры физического движка (аналог PHYSICS_CONFIG из old_physic_system)
const PHYSICS_CONFIG = {
  A: 10,          // Коэффициент жесткости расталкивания существ
  C: 0.5,         // Максимальный коэффициент импульса за один кадр
  B: 0.01,        // Буфер при выталкивании из стен (предотвращает повторное касание в кеше)
  d_min: 0.001,   // Минимальный порог смещения (защита от дрожания float-чисел)
  R_mult: Math.sin(Math.PI / 4) // ~0.707 — множитель радиуса для расчета sub-stepping
};

export class PhysicsSystem {
  public system: System;
  private obstacleLines: Line[] = [];
  public obstaclesEnabled: boolean = true;

  constructor() {
    this.system = new System();
  }

  public addCreature(creature: Creature): void {
    this.system.insert(creature.body);
  }

  public removeCreature(creature: Creature): void {
    this.system.remove(creature.body);
  }

  // --- Загрузка и управление препятствиями ---

  public loadObstacles(segments: ObstacleSegment[]): void {
    this.clearObstacles();

    for (const seg of segments) {
      const line = new Line(
        { x: seg.start.x, y: seg.start.y },
        { x: seg.end.x, y: seg.end.y }
      );
      // Помечаем линию как статичный объект для удобства фильтрации
      line.isStatic = true;
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

  // --- Фильтры коллизий ---

  /**
   * Проверяет, должны ли два существа сталкиваться друг с другом.
   * Учитывает статус жизни и правила прохождения (например, Игрок сквозь NPC).
   */
  private canCollide(c1: Creature, c2: Creature): boolean {
    // 1. Мертвые существа не участвуют в коллизиях
    if (c1.isAlive === false || c2.isAlive === false) {
      return false;
    }

    // 2. Игрок и NPC не сталкиваются друг с другом (проходят насквозь)
    if ((c1.isPlayer && c2.isNPC) || (c2.isPlayer && c1.isNPC)) {
      return false;
    }

    return true;
  }

  // --- Защита от туннелирования (Sub-stepping) ---

  /**
   * Безопасное перемещение существа с защитой от пролета сквозь стены (Sub-stepping).
   * Если шаг перемещения больше радиуса, движение бьется на микро-шаги.
   */
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
      // На каждом микро-шаге выталкиваем существо из стен
      this.resolveObstaclesForCreature(creature);
    }

    creature.syncFromPhysics();
  }

  /**
   * Разрешение столкновений конкретного существа со стенами (с учетом буфера B).
   */
  private resolveObstaclesForCreature(creature: Creature): void {
    if (!this.obstaclesEnabled) return;

    const potentials = this.system.getPotentials(creature.body);
    for (const wall of potentials) {
      if (wall instanceof Line && this.system.checkCollision(creature.body, wall)) {
        const response = this.system.response;
        // Добавляем буфер B, чтобы гарантированно вывести тело из коллизии
        const pushX = response.overlap * response.overlapV.x + PHYSICS_CONFIG.B * Math.sign(response.overlapV.x);
        const pushY = response.overlap * response.overlapV.y + PHYSICS_CONFIG.B * Math.sign(response.overlapV.y);

        creature.body.setPosition(
          creature.body.x - pushX,
          creature.body.y - pushY
        );
      }
    }
  }

  // --- Главный цикл разрешения столкновений ---

  /**
   * Комплексное разрешение всех столкновений за кадр с учетом dt.
   */
  public resolveCollisions(creatures: Creature[], dt: number): void {
    this.system.update();

    // Расчет коэффициента силы выталкивания с ограничением C
    let mult = PHYSICS_CONFIG.A * dt;
    mult = mult > PHYSICS_CONFIG.C ? PHYSICS_CONFIG.C : mult;

    // 1. Столкновение существ друг с другом (Soft Push-Back + Фильтры + Масса)
    for (let i = 0; i < creatures.length; i++) {
      for (let j = i + 1; j < creatures.length; j++) {
        const c1 = creatures[i];
        const c2 = creatures[j];

        // Применяем фильтр коллизий
        if (!this.canCollide(c1, c2)) continue;

        if (this.system.checkCollision(c1.body, c2.body)) {
          const response = this.system.response;

          const overlapX = response.overlap * response.overlapV.x;
          const overlapY = response.overlap * response.overlapV.y;

          // Распределение сдвига обратно пропорционально массе
          const totalMass = c1.mass + c2.mass;
          const ratio1 = c2.mass / totalMass;
          const ratio2 = c1.mass / totalMass;

          // Плавное выталкивание с учетом dt (множитель mult)
          const deltaX1 = mult * overlapX * ratio1;
          const deltaY1 = mult * overlapY * ratio1;
          const deltaX2 = mult * overlapX * ratio2;
          const deltaY2 = mult * overlapY * ratio2;

          // Проверка порога минимального смещения d_min
          const moved1 = Math.abs(deltaX1) > PHYSICS_CONFIG.d_min || Math.abs(deltaY1) > PHYSICS_CONFIG.d_min;
          const moved2 = Math.abs(deltaX2) > PHYSICS_CONFIG.d_min || Math.abs(deltaY2) > PHYSICS_CONFIG.d_min;

          if (moved1) {
            c1.body.setPosition(c1.body.x - deltaX1, c1.body.y - deltaY1);
            c1.syncFromPhysics();
          }
          if (moved2) {
            c2.body.setPosition(c2.body.x + deltaX2, c2.body.y + deltaY2);
            c2.syncFromPhysics();
          }
        }
      }
    }

    // 2. Столкновения существ с препятствиями
    if (this.obstaclesEnabled) {
      for (const creature of creatures) {
        this.resolveObstaclesForCreature(creature);
        creature.syncFromPhysics();
      }
    }
  }

  public getObstacleLines(): Line[] {
    return this.obstacleLines;
  }
}