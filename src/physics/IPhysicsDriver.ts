import RAPIER from '@dimforge/rapier3d-compat';
import { Vec3 } from '../types';

export interface PhysicsDriverStats {
  stepCount: number;
  bodyCount: number;
  colliderCount: number;
}

export interface IPhysicsDriver {
  /** Флаг готовности физического мира к симуляции */
  readonly isReady: boolean;

  /** Шаг фиксированного времени для интеграции (по умолчанию 1/60 с) */
  fixedTimestep: number;

  /** Выполняет шаг физической симуляции с внутренним аккумулятором времени */
  step(dt: number): void;

  /** Устанавливает 3D-вектор гравитации в метрах на секунду в квадрате */
  setGravity(x: number, y: number, z: number): void;

  /** Создает твердое тело в физическом мире с опциональной привязкой к EntityId */
  createRigidBody(desc: RAPIER.RigidBodyDesc, entityId?: string): RAPIER.RigidBody;

  /** Создает коллайдер геометрической формы и прикрепляет его к твердому телу */
  createCollider(desc: RAPIER.ColliderDesc, parent: RAPIER.RigidBody): RAPIER.Collider;

  /** Удаляет твердое тело и все прикрепленные к нему коллайдеры из физического мира */
  removeRigidBody(body: RAPIER.RigidBody): void;

  /** Создает динамическое тело с позицией (падающее под силой тяжести) */
  createDynamicBody(pos: Vec3, entityId?: string): RAPIER.RigidBody;

  /** Создает фиксированное неподвижное тело (препятствия, стены) */
  createFixedBody(pos: Vec3, entityId?: string): RAPIER.RigidBody;

  /** Создает кинематическое тело (для существ, управляемых напрямую кодом) */
  createKinematicPositionBody(pos: Vec3, entityId?: string): RAPIER.RigidBody;

  /** Создает сферический коллайдер */
  createBallCollider(radius: number, parent: RAPIER.RigidBody, mass?: number): RAPIER.Collider;

  /** Создает вертикальный капсульный коллайдер с опциональным вертикальным смещением */
  createCapsuleCollider(
    halfHeight: number,
    radius: number,
    parent: RAPIER.RigidBody,
    mass?: number,
    offsetY?: number
  ): RAPIER.Collider;

  /** Обновляет размеры и относительное смещение существующего капсульного коллайдера */
  updateCapsuleCollider(
    collider: RAPIER.Collider,
    halfHeight: number,
    radius: number,
    offsetY: number
  ): void;

  /** Вычисляет разрешенное движение кинематического персонажа через KCC с учетом препятствий и гравитации */
  computeCharacterMovement(
    collider: RAPIER.Collider,
    desiredTranslation: Vec3,
    characterMass: number
  ): { movement: Vec3; isGrounded: boolean };

  /** Проверяет наличие свободного пространства над головой для подъема из приседа/лежа */
  checkCeilingClearance(
    pos: Vec3,
    radius: number,
    currentHeight: number,
    targetHeight: number,
    ignoreEntityId?: string
  ): boolean;

  /** Создает коллайдер-кубоид (hx, hy, hz — половины размеров по осям) с опциональным вертикальным смещением */
  createCuboidCollider(
    hx: number,
    hy: number,
    hz: number,
    parent: RAPIER.RigidBody,
    mass?: number,
    offsetY?: number
  ): RAPIER.Collider;
  /** Создает статический пол (кубоид), верхняя грань которого находится на высоте y */
  createGround(
    size?: number,
    thickness?: number,
    y?: number
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider };

  /** Запрашивает все сущности в радиусе (сферическое перекрытие в 3D) */
  queryEntitiesInSphere(center: Vec3, radius: number): string[];

  /** Пускает луч и возвращает отсортированный по дальности список всех попаданий */
  castRayMultiple(
    start: Vec3,
    direction: Vec3,
    maxToi: number,
    solid: boolean,
    ignoreEntityId?: string
  ): Array<{ entityId: string; toi: number }>;

  /** Возвращает EntityId, привязанный к указанному телу */
  getEntityIdByBody(body: RAPIER.RigidBody): string | undefined;

  /** Возвращает твердое тело по EntityId */
  getBodyByEntityId(entityId: string): RAPIER.RigidBody | undefined;

  /** Возвращает ссылку на нативный инстанс мира (для низкоуровневых операций) */
  getRawWorld(): any;

  /** Возвращает базовую статистику мира */
  getStats(): PhysicsDriverStats;

  /** Очищает и освобождает всю память WebAssembly мира Rapier */
  destroy(): void;
}
