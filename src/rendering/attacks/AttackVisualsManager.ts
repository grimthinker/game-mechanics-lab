import * as THREE from 'three';
import { World } from '../../ecs/World';
import { EntityId, HitZoneConfig, HitZoneType } from '../../ecs/types';
import { TransformComponent } from '../../ecs/components/physics';

interface AttackVisualState {
  object: THREE.Object3D;
  key: string;
  phase: 'prep' | 'cast';
}

export class AttackVisualsManager {
  private attackVisuals: Map<EntityId, AttackVisualState> = new Map();

  private matAttackPrepMesh = new THREE.MeshBasicMaterial({
    color: 0xf39c12,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  private matAttackCastMesh = new THREE.MeshBasicMaterial({
    color: 0xe74c3c,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  private matAttackPrepLine = new THREE.LineBasicMaterial({
    color: 0xf39c12,
    transparent: true,
    opacity: 0.75,
  });

  private matAttackCastLine = new THREE.LineBasicMaterial({
    color: 0xe74c3c,
    transparent: true,
    opacity: 0.95,
  });

  constructor(private scene: THREE.Scene) {}

  public update(world: World): void {
    const activeAttackEntities = world.getEntitiesWith('activeAttacks', 'transform', 'health');
    const currentAttackingIds = new Set<EntityId>();

    for (const [id, { activeAttacks, transform, health }] of activeAttackEntities) {
      if (!health.isAlive) continue;

      const currentAttack = activeAttacks.attacks[0];
      if (!currentAttack) continue;
      if (currentAttack.phase !== 'prep' && currentAttack.phase !== 'cast') continue;

      const weaponZone = world.getComponent(currentAttack.weaponId, 'weaponZone');
      if (!weaponZone) continue;

      currentAttackingIds.add(id);
      this.syncAttackVisual(id, currentAttack.phase, weaponZone, transform);
    }

    // Удаляем визуализаторы завершившихся атак
    for (const [id, visual] of this.attackVisuals.entries()) {
      if (!currentAttackingIds.has(id)) {
        this.scene.remove(visual.object);
        this.disposeAttackObject(visual.object);
        this.attackVisuals.delete(id);
      }
    }
  }

  private syncAttackVisual(
    entityId: EntityId,
    phase: 'prep' | 'cast',
    zone: HitZoneConfig,
    transform: TransformComponent
  ): void {
    const key = `${zone.hitZoneType}_${zone.radius ?? 0}_${zone.length ?? 0}_${zone.angle ?? 0}_${zone.rayCount ?? 0}`;
    let visual = this.attackVisuals.get(entityId);

    if (!visual || visual.key !== key) {
      if (visual) {
        this.scene.remove(visual.object);
        this.disposeAttackObject(visual.object);
      }
      const object = this.createAttackObject(zone, phase);
      visual = { object, key, phase };
      this.attackVisuals.set(entityId, visual);
      this.scene.add(object);
    } else if (visual.phase !== phase) {
      visual.phase = phase;
      this.updateAttackObjectPhase(visual.object, zone.hitZoneType, phase);
    }

    // Привязываем положение чуть выше пола (0.02м) во избежание z-fighting
    visual.object.position.set(transform.x, transform.y + 0.02, transform.z);
    if (transform.rotation) {
      visual.object.quaternion.set(
        transform.rotation.x,
        transform.rotation.y,
        transform.rotation.z,
        transform.rotation.w
      );
    }
  }

  private createAttackObject(zone: HitZoneConfig, phase: 'prep' | 'cast'): THREE.Object3D {
    const isCast = phase === 'cast';

    if (zone.hitZoneType === 'radius') {
      const radius = zone.radius ?? 2.5;
      const geo = new THREE.CircleGeometry(radius, 32);
      geo.rotateX(-Math.PI / 2);
      return new THREE.Mesh(geo, isCast ? this.matAttackCastMesh : this.matAttackPrepMesh);
    }

    if (zone.hitZoneType === 'angle') {
      const radius = zone.length ?? zone.radius ?? 4.5;
      const angle = zone.angle ?? Math.PI / 6;
      const segments = 24;
      const positions: number[] = [];
      const halfAngle = angle / 2;

      for (let i = 0; i < segments; i++) {
        const a1 = -halfAngle + (i / segments) * angle;
        const a2 = -halfAngle + ((i + 1) / segments) * angle;

        positions.push(0, 0, 0);
        positions.push(Math.cos(a1) * radius, 0, Math.sin(a1) * radius);
        positions.push(Math.cos(a2) * radius, 0, Math.sin(a2) * radius);
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.computeVertexNormals();

      return new THREE.Mesh(geo, isCast ? this.matAttackCastMesh : this.matAttackPrepMesh);
    }

    if (zone.hitZoneType === 'forward_line') {
      const len = zone.length ?? 6.0;
      const hw = 0.15; // полуширина полосы удара (15 см)
      const positions = [0, 0, -hw, len, 0, -hw, len, 0, hw, 0, 0, -hw, len, 0, hw, 0, 0, hw];

      const meshGeo = new THREE.BufferGeometry();
      meshGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      meshGeo.computeVertexNormals();
      const mesh = new THREE.Mesh(
        meshGeo,
        isCast ? this.matAttackCastMesh : this.matAttackPrepMesh
      );

      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(len, 0, 0),
      ]);
      const line = new THREE.Line(
        lineGeo,
        isCast ? this.matAttackCastLine : this.matAttackPrepLine
      );

      const group = new THREE.Group();
      group.add(mesh);
      group.add(line);
      return group;
    }

    if (zone.hitZoneType === 'shrapnel') {
      const length = zone.length ?? 5.0;
      const angle = zone.angle ?? Math.PI / 3;
      const count = Math.max(2, zone.rayCount ?? 5);
      const halfAngle = angle / 2;
      const points: THREE.Vector3[] = [];

      for (let i = 0; i < count; i++) {
        const fraction = count > 1 ? i / (count - 1) : 0.5;
        const rayAngle = -halfAngle + fraction * angle;
        points.push(new THREE.Vector3(0, 0, 0));
        points.push(new THREE.Vector3(Math.cos(rayAngle) * length, 0, Math.sin(rayAngle) * length));
      }

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      return new THREE.LineSegments(geo, isCast ? this.matAttackCastLine : this.matAttackPrepLine);
    }

    return new THREE.Group();
  }

  private updateAttackObjectPhase(
    obj: THREE.Object3D,
    hitZoneType: HitZoneType,
    phase: 'prep' | 'cast'
  ): void {
    const isCast = phase === 'cast';

    if (hitZoneType === 'shrapnel') {
      if (obj instanceof THREE.LineSegments) {
        obj.material = isCast ? this.matAttackCastLine : this.matAttackPrepLine;
      }
    } else if (hitZoneType === 'forward_line') {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = isCast ? this.matAttackCastMesh : this.matAttackPrepMesh;
        } else if (child instanceof THREE.Line) {
          child.material = isCast ? this.matAttackCastLine : this.matAttackPrepLine;
        }
      });
    } else {
      if (obj instanceof THREE.Mesh) {
        obj.material = isCast ? this.matAttackCastMesh : this.matAttackPrepMesh;
      }
    }
  }

  private disposeAttackObject(obj: THREE.Object3D): void {
    obj.traverse((child) => {
      if (
        child instanceof THREE.Mesh ||
        child instanceof THREE.Line ||
        child instanceof THREE.LineSegments
      ) {
        child.geometry?.dispose();
      }
    });
  }

  public clear(): void {
    for (const [, visual] of this.attackVisuals.entries()) {
      this.disposeAttackObject(visual.object);
      if (visual.object.parent) {
        visual.object.parent.remove(visual.object);
      }
    }
    this.attackVisuals.clear();
  }

  public destroy(): void {
    this.clear();
    this.matAttackPrepMesh.dispose();
    this.matAttackCastMesh.dispose();
    this.matAttackPrepLine.dispose();
    this.matAttackCastLine.dispose();
  }
}
