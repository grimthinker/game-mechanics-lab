import RAPIER from '@dimforge/rapier3d-compat';
import { IPhysicsDriver, PhysicsDriverStats } from './IPhysicsDriver';

export class RapierPhysicsDriver implements IPhysicsDriver {
  private world: RAPIER.World | null = null;
  private eventQueue: RAPIER.EventQueue | null = null;
  private accumulator: number = 0;
  private stepCount: number = 0;
  public fixedTimestep: number = 1 / 60;
  private readonly maxSubsteps: number = 4;

  // Маппинг связей дескрипторов тел и сущностей ECS
  private bodyHandleToEntityMap: Map<number, string> = new Map();
  private entityToBodyMap: Map<string, RAPIER.RigidBody> = new Map();

  // Ссылка на статическое тело пола
  private groundBody: RAPIER.RigidBody | null = null;
  private groundCollider: RAPIER.Collider | null = null;

  constructor() {
    const gravity = new RAPIER.Vector3(0.0, -9.81, 0.0);
    this.world = new RAPIER.World(gravity);
    this.world.integrationParameters.dt = this.fixedTimestep;
    this.eventQueue = new RAPIER.EventQueue(true);

    // Создаем базовый статический пол 100x100 метров на уровне Y = 0
    this.createGround(100, 1.0, 0.0);

    console.log(
      '[RapierPhysicsDriver] Физический мир Rapier3D создан (гравитация: 0, -9.81, 0, пол создан на Y = 0.0)'
    );
  }

  public get isReady(): boolean {
    return this.world !== null;
  }

  public step(dt: number): void {
    if (!this.world) return;

    this.accumulator += dt;

    let substeps = 0;
    while (this.accumulator >= this.fixedTimestep && substeps < this.maxSubsteps) {
      this.world.step(this.eventQueue || undefined);
      this.accumulator -= this.fixedTimestep;
      this.stepCount++;
      substeps++;
    }

    // Защита от "спирали смерти" при сильных лагах и просадках FPS
    if (this.accumulator >= this.fixedTimestep) {
      this.accumulator = 0;
    }
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
    return body;
  }

  public createCollider(desc: RAPIER.ColliderDesc, parent: RAPIER.RigidBody): RAPIER.Collider {
    if (!this.world) {
      throw new Error(
        '[RapierPhysicsDriver] Невозможно создать коллайдер: мир Rapier не инициализирован.'
      );
    }
    return this.world.createCollider(desc, parent);
  }

  public removeCollider(collider: RAPIER.Collider, wakeUp: boolean = true): void {
    if (!this.world) return;
    this.world.removeCollider(collider, wakeUp);
  }

  public removeRigidBody(body: RAPIER.RigidBody): void {
    if (!this.world) return;
    const entityId = this.bodyHandleToEntityMap.get(body.handle);
    if (entityId) {
      this.entityToBodyMap.delete(entityId);
      this.bodyHandleToEntityMap.delete(body.handle);
    }
    this.world.removeRigidBody(body);
  }

  public createDynamicBody(pos: import('../types').Vec3, entityId?: string): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z);
    return this.createRigidBody(desc, entityId);
  }

  public createFixedBody(pos: import('../types').Vec3, entityId?: string): RAPIER.RigidBody {
    const desc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
    return this.createRigidBody(desc, entityId);
  }

  public createKinematicPositionBody(
    pos: import('../types').Vec3,
    entityId?: string
  ): RAPIER.RigidBody {
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

    return { body, collider };
  }

  public queryEntitiesInSphere(center: import('../types').Vec3, radius: number): string[] {
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
    start: import('../types').Vec3,
    direction: import('../types').Vec3,
    maxToi: number,
    solid: boolean,
    ignoreEntityId?: string
  ): Array<{ entityId: string; toi: number }> {
    if (!this.world) return [];
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
