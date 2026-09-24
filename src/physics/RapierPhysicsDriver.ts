import RAPIER from '@dimforge/rapier3d-compat';
import { IPhysicsDriver, PhysicsDriverStats, PhysicalRaycastResult } from './IPhysicsDriver';
import { Vec3 } from '../types';

export class RapierPhysicsDriver implements IPhysicsDriver {
  private world: RAPIER.World | null = null;
  private eventQueue: RAPIER.EventQueue | null = null;
  private stepCount: number = 0;
  public fixedTimestep: number = 1 / 60;
  private isBroadPhaseDirty: boolean = true;

  // Маппинг связей дескрипторов тел и сущностей ECS
  private bodyHandleToEntityMap: Map<number, string> = new Map();
  private entityToBodyMap: Map<string, RAPIER.RigidBody> = new Map();

  // Ссылка на статическое тело пола
  private groundBody: RAPIER.RigidBody | null = null;
  private groundCollider: RAPIER.Collider | null = null;

  // Переиспользуемый инстанс KCC
  private characterController: RAPIER.KinematicCharacterController | null = null;

  constructor() {
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);
    this.world.integrationParameters.dt = this.fixedTimestep;
    this.eventQueue = new RAPIER.EventQueue(true);

    // Создаем базовый статический пол 100x100 метров на уровне Y = 0
    this.createGround(100, 1.0, 0.0);

    // Инициализация KCC контроллера с автоподъемом на ступени и мягким скольжением
    const offset = 0.02; // отступ 2 см для исключения залипания
    this.characterController = this.world.createCharacterController(offset);
    this.characterController.enableAutostep(0.15, 0.25, false); // преодоление ступеней и кочек до 15 см
    this.characterController.enableSnapToGround(0.35); // прилипание к земле на спусках холмов до 35 см
    this.characterController.setMaxSlopeClimbAngle((40 * Math.PI) / 180); // свободный подъем на склоны до 40 градусов
    this.characterController.setMinSlopeSlideAngle((40 * Math.PI) / 180); // соскальзывание со склонов круче 40 градусов
    this.characterController.setApplyImpulsesToDynamicBodies(true); // передача импульса ящикам и предметам
    this.characterController.setSlideEnabled(true);

    console.log(
      '[RapierPhysicsDriver] Физический мир Rapier3D создан (гравитация: 0, -9.81, 0, KCC активирован)'
    );
  }

  public get isReady(): boolean {
    return this.world !== null;
  }

  public step(dt?: number): void {
    if (!this.world) return;

    if (dt !== undefined && dt > 0) {
      this.world.integrationParameters.dt = dt;
    }
    this.world.step(this.eventQueue || undefined);
    this.stepCount++;
    this.isBroadPhaseDirty = false;
  }

  public setGravity(x: number, y: number, z: number): void {
    if (!this.world) return;
    this.world.gravity = new RAPIER.Vector3(x, y, z);
  }

  public createRigidBody(desc: RAPIER.RigidBodyDesc, entityId?: string): RAPIER.RigidBody {
    if (!this.world) {
      throw new Error(
        '[RapierPhysicsDriver] Невозможно создать тело: мир Rapier не инициализирован.'
      );
    }
    const body = this.world.createRigidBody(desc);
    if (entityId) {
      this.bodyHandleToEntityMap.set(body.handle, entityId);
      this.entityToBodyMap.set(entityId, body);
      (body as any).userData = { entityId };
    }
    this.isBroadPhaseDirty = true;
    return body;
  }

  public createCollider(desc: RAPIER.ColliderDesc, parent: RAPIER.RigidBody): RAPIER.Collider {
    if (!this.world) {
      throw new Error(
        '[RapierPhysicsDriver] Невозможно создать коллайдер: мир Rapier не инициализирован.'
      );
    }
    const collider = this.world.createCollider(desc, parent);
    this.isBroadPhaseDirty = true;
    return collider;
  }

  public removeCollider(collider: RAPIER.Collider, wakeUp: boolean = true): void {
    if (!this.world) return;
    this.world.removeCollider(collider, wakeUp);
    this.isBroadPhaseDirty = true;
  }

  public removeRigidBody(body: RAPIER.RigidBody): void {
    if (!this.world) return;
    const entityId = this.bodyHandleToEntityMap.get(body.handle);
    if (entityId) {
      this.entityToBodyMap.delete(entityId);
      this.bodyHandleToEntityMap.delete(body.handle);
    }
    this.world.removeRigidBody(body);
    this.isBroadPhaseDirty = true;
  }

  public createDynamicBody(pos: Vec3, entityId?: string): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z);
    return this.createRigidBody(desc, entityId);
  }

  public createFixedBody(pos: Vec3, entityId?: string): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
    return this.createRigidBody(desc, entityId);
  }

  public createKinematicPositionBody(pos: Vec3, entityId?: string): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z);
    return this.createRigidBody(desc, entityId);
  }

  public createBallCollider(
    radius: number,
    parent: RAPIER.RigidBody,
    mass?: number
  ): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.ball(Math.max(0.01, radius));
    if (mass !== undefined && mass > 0) {
      desc.setMass(mass);
    }
    return this.createCollider(desc, parent);
  }

  public createCapsuleCollider(
    halfHeight: number,
    radius: number,
    parent: RAPIER.RigidBody,
    mass?: number,
    offsetY?: number
  ): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.capsule(Math.max(0.01, halfHeight), Math.max(0.01, radius));
    if (offsetY !== undefined && offsetY !== 0) {
      desc.setTranslation(0.0, offsetY, 0.0);
    }
    if (mass !== undefined && mass > 0) {
      desc.setMass(mass);
    }
    return this.createCollider(desc, parent);
  }

  public updateCapsuleCollider(
    collider: RAPIER.Collider,
    halfHeight: number,
    radius: number,
    offsetY: number
  ): void {
    if (!this.world) return;
    // В Rapier3D напрямую методы setHalfHeight и setRadius отсутствуют, нужно использовать setShape
    const newShape = new RAPIER.Capsule(Math.max(0.01, halfHeight), Math.max(0.01, radius));
    collider.setShape(newShape);
    collider.setTranslationWrtParent({ x: 0, y: offsetY, z: 0 });
    this.isBroadPhaseDirty = true;
  }
  public computeCharacterMovement(
    collider: RAPIER.Collider,
    desiredTranslation: Vec3,
    characterMass: number,
    isAirborne?: boolean
  ): { movement: Vec3; isGrounded: boolean; groundNormal?: Vec3; slopeAngleDeg?: number } {
    if (!this.world || !this.characterController) {
      return {
        movement: desiredTranslation,
        isGrounded: true,
        groundNormal: { x: 0, y: 1, z: 0 },
        slopeAngleDeg: 0,
      };
    }

    this.characterController.setCharacterMass(characterMass);

    // Во время свободного полета в прыжке отключаем принудительное прилипание к земле (snap-to-ground),
    // чтобы KCC не затягивал летящую капсулу сквозь крутые наклонные полигоны холма
    if (isAirborne) {
      this.characterController.enableSnapToGround(0.0);
    } else {
      this.characterController.enableSnapToGround(0.35);
    }

    // Исключаем сенсоры и кинематические тела (других существ) для мягкого расталкивания солвером
    const filterFlags =
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS | RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC;

    this.characterController.computeColliderMovement(collider, desiredTranslation, filterFlags);

    // Определение нормали поверхности и пробуждение динамических тел
    let groundNormal: Vec3 = { x: 0, y: 1, z: 0 };
    let maxNormalY = 0;

    const numCollisions = this.characterController.numComputedCollisions();
    for (let i = 0; i < numCollisions; i++) {
      const collision = this.characterController.computedCollision(i);
      const parentBody = collision?.collider?.parent();
      if (parentBody && parentBody.isDynamic() && parentBody.isSleeping()) {
        parentBody.wakeUp();
      }
      if (collision && collision.normal1 && collision.normal1.y > maxNormalY) {
        maxNormalY = collision.normal1.y;
        groundNormal = {
          x: collision.normal1.x,
          y: collision.normal1.y,
          z: collision.normal1.z,
        };
      }
    }

    const computed = this.characterController.computedMovement();
    const isGrounded = this.characterController.computedGrounded();

    // Страховочный опрос нормали прямо под центром капсулы при контакте с землей
    if (isGrounded && maxNormalY === 0) {
      const colPos = collider.translation();
      const downRay = this.world.castRayAndGetNormal(
        new RAPIER.Ray(colPos, new RAPIER.Vector3(0, -1, 0)),
        1.5,
        true,
        RAPIER.QueryFilterFlags.EXCLUDE_KINEMATIC | RAPIER.QueryFilterFlags.EXCLUDE_SENSORS
      );
      if (downRay && downRay.normal) {
        groundNormal = { x: downRay.normal.x, y: downRay.normal.y, z: downRay.normal.z };
      }
    }

    const nLen = Math.hypot(groundNormal.x, groundNormal.y, groundNormal.z);
    if (nLen > 0.0001) {
      groundNormal.x /= nLen;
      groundNormal.y /= nLen;
      groundNormal.z /= nLen;
    }

    // Угол наклона поверхности от горизонтали в градусах (0° = ровный пол, 90° = отвесная стена)
    const slopeAngleDeg = Math.acos(Math.min(1, Math.max(0, groundNormal.y))) * (180 / Math.PI);

    return {
      movement: { x: computed.x, y: computed.y, z: computed.z },
      isGrounded,
      groundNormal,
      slopeAngleDeg,
    };
  }

  public wakeUpDynamicBodiesInRadius(center: Vec3, radius: number): void {
    if (!this.world) return;
    const ids = this.queryEntitiesInSphere(center, radius);
    for (const id of ids) {
      const body = this.getBodyByEntityId(id);
      if (body && body.isDynamic() && body.isSleeping()) {
        body.wakeUp();
      }
    }
  }

  public checkCeilingClearance(
    pos: Vec3,
    radius: number,
    currentHeight: number,
    targetHeight: number,
    ignoreEntityId?: string
  ): boolean {
    if (!this.world) return false;

    const halfHeight = Math.max(0.01, (targetHeight - 2 * radius) / 2);
    const capsuleCenterY = pos.y + halfHeight + radius;

    const shapePos = new RAPIER.Vector3(pos.x, capsuleCenterY, pos.z);
    const shapeRot = { w: 1.0, x: 0.0, y: 0.0, z: 0.0 };
    const shape = new RAPIER.Capsule(halfHeight, radius);

    let isBlocked = false;

    this.world.intersectionsWithShape(shapePos, shapeRot, shape, (collider: RAPIER.Collider) => {
      const parent = collider.parent();
      if (parent) {
        const entityId = this.getEntityIdByBody(parent);
        if (entityId && entityId === ignoreEntityId) {
          return true;
        }
        if (collider.isSensor()) {
          return true;
        }
        if (parent.isFixed() || parent.isDynamic()) {
          isBlocked = true;
          return false;
        }
      }
      return true;
    });

    return isBlocked;
  }

  public createCuboidCollider(
    hx: number,
    hy: number,
    hz: number,
    parent: RAPIER.RigidBody,
    mass?: number,
    offsetY?: number
  ): RAPIER.Collider {
    const desc = RAPIER.ColliderDesc.cuboid(
      Math.max(0.01, hx),
      Math.max(0.01, hy),
      Math.max(0.01, hz)
    );
    if (offsetY !== undefined && offsetY !== 0) {
      desc.setTranslation(0.0, offsetY, 0.0);
    }
    if (mass !== undefined && mass > 0) {
      desc.setMass(mass);
    }
    return this.createCollider(desc, parent);
  }
  public createGround(
    size: number = 100,
    thickness: number = 1.0,
    y: number = 0.0
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } {
    if (!this.world) {
      throw new Error('[RapierPhysicsDriver] Невозможно создать пол: мир не инициализирован.');
    }

    // Если пол уже был создан — удаляем старый
    if (this.groundBody) {
      this.world.removeRigidBody(this.groundBody);
      this.groundBody = null;
      this.groundCollider = null;
    }

    // Центр кубоида пола смещен вниз на половину толщины, чтобы верхняя грань была строго на Y
    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0.0, y - thickness / 2, 0.0);
    const body = this.world.createRigidBody(groundBodyDesc);

    // halfExtents для cuboid: половина ширины, высоты и глубины
    const groundColliderDesc = RAPIER.ColliderDesc.cuboid(size / 2, thickness / 2, size / 2);
    const collider = this.world.createCollider(groundColliderDesc, body);

    this.groundBody = body;
    this.groundCollider = collider;
    this.isBroadPhaseDirty = true;

    return { body, collider };
  }

  public createOrUpdateTerrain(
    size: number,
    resolution: number,
    heights: Float32Array,
    entityId?: string
  ): { body: RAPIER.RigidBody; collider: RAPIER.Collider } | null {
    if (!this.world) return null;

    const safeRes = Math.max(2, Math.round(Number(resolution) || 128));
    const safeSize = Math.max(1, Number(size) || 100);

    // Удаляем предыдущий статический коллайдер пола / террейна
    if (this.groundBody) {
      this.removeRigidBody(this.groundBody);
      this.groundBody = null;
      this.groundCollider = null;
    }

    const groundBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0.0, 0.0, 0.0);
    const body = this.createRigidBody(groundBodyDesc, entityId);

    // 1. Генерация 3D вершин (X, Y, Z) террейна в мировых координатах
    const numVerts = safeRes * safeRes;
    const vertices = new Float32Array(numVerts * 3);
    const step = safeSize / (safeRes - 1);
    const halfSize = safeSize / 2;

    for (let z = 0; z < safeRes; z++) {
      for (let x = 0; x < safeRes; x++) {
        const idx = z * safeRes + x;
        const vIdx = idx * 3;
        const h = heights[idx];
        vertices[vIdx] = x * step - halfSize;
        vertices[vIdx + 1] = typeof h === 'number' && Number.isFinite(h) ? h : 0;
        vertices[vIdx + 2] = z * step - halfSize;
      }
    }

    // 2. Генерация треугольников (индексов), полностью совпадающих с геометрией Three.js PlaneGeometry
    const numQuads = (safeRes - 1) * (safeRes - 1);
    const indices = new Uint32Array(numQuads * 6);
    let iPtr = 0;

    for (let z = 0; z < safeRes - 1; z++) {
      for (let x = 0; x < safeRes - 1; x++) {
        const row1 = z * safeRes;
        const row2 = (z + 1) * safeRes;

        const a = row1 + x;
        const b = row1 + x + 1;
        const c = row2 + x;
        const d = row2 + x + 1;

        indices[iPtr++] = a;
        indices[iPtr++] = c;
        indices[iPtr++] = b;

        indices[iPtr++] = b;
        indices[iPtr++] = c;
        indices[iPtr++] = d;
      }
    }

    try {
      // trimesh в Rapier3D работает абсолютно стабильно, исключая паники WASM ядра
      const colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);
      colliderDesc.setRestitution(0.0);
      colliderDesc.setFriction(0.8);

      const collider = this.createCollider(colliderDesc, body);

      this.groundBody = body;
      this.groundCollider = collider;
      this.isBroadPhaseDirty = true;

      return { body, collider };
    } catch (err) {
      console.error('[RapierPhysicsDriver] Ошибка создания физической коллизии террейна:', err);
      return null;
    }
  }

  public queryEntitiesInSphere(center: Vec3, radius: number): string[] {
    if (!this.world) return [];
    const hitIds = new Set<string>();
    const shapePos = new RAPIER.Vector3(center.x, center.y, center.z);
    const shapeRot = { w: 1.0, x: 0.0, y: 0.0, z: 0.0 };
    const shape = new RAPIER.Ball(radius);

    this.world.intersectionsWithShape(shapePos, shapeRot, shape, (collider: RAPIER.Collider) => {
      const parent = collider.parent();
      if (parent) {
        const entityId = this.getEntityIdByBody(parent);
        if (entityId) hitIds.add(entityId);
      }
      return true;
    });
    return Array.from(hitIds);
  }

  public castRayMultiple(
    start: Vec3,
    direction: Vec3,
    maxToi: number,
    solid: boolean,
    ignoreEntityId?: string
  ): Array<{ entityId: string; toi: number }> {
    if (!this.world) return [];

    if (this.isBroadPhaseDirty) {
      this.updateSceneQueries();
    }

    const hits: Array<{ entityId: string; toi: number }> = [];
    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(start.x, start.y, start.z),
      new RAPIER.Vector3(direction.x, direction.y, direction.z)
    );

    this.world.intersectionsWithRay(
      ray,
      maxToi,
      solid,
      (intersect: RAPIER.RayColliderIntersection) => {
        const collider = intersect.collider;
        const parent = collider.parent();
        if (parent) {
          const entityId = this.getEntityIdByBody(parent);
          if (entityId && entityId !== ignoreEntityId) {
            hits.push({ entityId, toi: intersect.timeOfImpact });
          }
        }
        return true;
      }
    );

    hits.sort((a, b) => a.toi - b.toi);

    // Оставляем только уникальные entityId (ближайшее пересечение для каждого тела)
    const uniqueHits: Array<{ entityId: string; toi: number }> = [];
    const seen = new Set<string>();
    for (const hit of hits) {
      if (!seen.has(hit.entityId)) {
        seen.add(hit.entityId);
        uniqueHits.push(hit);
      }
    }

    return uniqueHits;
  }

  public updateSceneQueries(): void {
    if (!this.world) return;

    // 1. Проталкиваем координаты тел в коллайдеры
    this.world.propagateModifiedBodyPositionsToColliders();

    // 2. Выполняем шаг с нулевым dt, чтобы обновить BroadPhase без движения динамических тел
    const prevTimestep = this.world.timestep;
    try {
      this.world.timestep = 0;
      this.world.step();
    } finally {
      this.world.timestep = prevTimestep;
    }

    this.isBroadPhaseDirty = false;
  }

  public castRay(
    start: Vec3,
    direction: Vec3,
    maxToi: number = 1000,
    solid: boolean = true,
    filterExcludeEntityId?: string
  ): PhysicalRaycastResult | null {
    if (!this.world) return null;

    if (this.isBroadPhaseDirty) {
      this.updateSceneQueries();
    }

    const len = Math.hypot(direction.x, direction.y, direction.z);
    if (len === 0) return null;
    const dirX = direction.x / len;
    const dirY = direction.y / len;
    const dirZ = direction.z / len;

    const ray = new RAPIER.Ray(
      new RAPIER.Vector3(start.x, start.y, start.z),
      new RAPIER.Vector3(dirX, dirY, dirZ)
    );

    const excludeBody = filterExcludeEntityId
      ? this.getBodyByEntityId(filterExcludeEntityId)
      : undefined;

    // Исключаем сенсоры (зоны-триггеры урона/лечения), опрашиваем только материальные коллайдеры
    const hit = this.world.castRayAndGetNormal(
      ray,
      maxToi,
      solid,
      RAPIER.QueryFilterFlags.EXCLUDE_SENSORS,
      undefined,
      undefined,
      excludeBody
    );

    if (hit) {
      const toi = hit.timeOfImpact;
      const hitPoint: Vec3 = {
        x: start.x + dirX * toi,
        y: start.y + dirY * toi,
        z: start.z + dirZ * toi,
      };

      const normal: Vec3 = {
        x: hit.normal.x,
        y: hit.normal.y,
        z: hit.normal.z,
      };

      const parentBody = hit.collider.parent();
      const isGround =
        (this.groundCollider !== null && hit.collider.handle === this.groundCollider.handle) ||
        (this.groundBody !== null &&
          parentBody !== null &&
          parentBody.handle === this.groundBody.handle);

      const entityId = parentBody ? this.getEntityIdByBody(parentBody) : undefined;

      return {
        point: hitPoint,
        normal,
        toi,
        entityId,
        isGround: Boolean(isGround),
        collider: hit.collider,
      };
    }

    // Фоллбэк: если луч не пересек ни один коллайдер сцены, пересекаем с горизонтальной плоскостью Y = 0
    if (Math.abs(dirY) > 1e-5) {
      const t = -start.y / dirY;
      if (t > 0 && t <= maxToi) {
        return {
          point: {
            x: start.x + dirX * t,
            y: 0,
            z: start.z + dirZ * t,
          },
          normal: { x: 0, y: 1, z: 0 },
          toi: t,
          isGround: true,
        };
      }
    }

    return null;
  }

  public getEntityIdByBody(body: RAPIER.RigidBody): string | undefined {
    return this.bodyHandleToEntityMap.get(body.handle);
  }

  public getBodyByEntityId(entityId: string): RAPIER.RigidBody | undefined {
    return this.entityToBodyMap.get(entityId);
  }

  public getRawWorld(): RAPIER.World | null {
    return this.world;
  }

  public getStats(): PhysicsDriverStats {
    if (!this.world) {
      return { stepCount: 0, bodyCount: 0, colliderCount: 0 };
    }
    return {
      stepCount: this.stepCount,
      bodyCount: this.world.bodies.len(),
      colliderCount: this.world.colliders.len(),
    };
  }

  public destroy(): void {
    this.bodyHandleToEntityMap.clear();
    this.entityToBodyMap.clear();
    this.groundBody = null;
    this.groundCollider = null;

    if (this.characterController) {
      this.characterController.free();
      this.characterController = null;
    }
    if (this.eventQueue) {
      this.eventQueue.free();
      this.eventQueue = null;
    }
    if (this.world) {
      this.world.free();
      this.world = null;
      console.log(
        '[RapierPhysicsDriver] Память физического мира Rapier3D (WASM) успешно освобождена.'
      );
    }
  }
}
