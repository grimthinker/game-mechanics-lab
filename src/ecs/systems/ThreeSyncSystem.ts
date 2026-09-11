import * as THREE from 'three';
import { World } from '../World';
import { GameMode } from '../../constants';
import { EntityId } from '../types';

export class ThreeSyncSystem {
  private scene: THREE.Scene;
  private meshes: Map<EntityId, THREE.Object3D> = new Map();

  // Кэшированные материалы для производительности
  private matPlayer = new THREE.MeshLambertMaterial({ color: 0x2980b9 });
  private matEnemy = new THREE.MeshLambertMaterial({ color: 0xc0392b });
  private matIdle = new THREE.MeshLambertMaterial({ color: 0x34495e });
  private matObstacle = new THREE.MeshLambertMaterial({ color: 0x555555 });
  private matWeapon = new THREE.MeshLambertMaterial({ color: 0xf1c40f });
  private matArmor = new THREE.MeshLambertMaterial({ color: 0x3498db });
  private matBag = new THREE.MeshLambertMaterial({ color: 0x2ecc71 });

  private matZoneDmg = new THREE.MeshBasicMaterial({
    color: 0xe74c3c,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  private matZoneHeal = new THREE.MeshBasicMaterial({
    color: 0x2ecc71,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });
  private matZoneNeutral = new THREE.MeshBasicMaterial({
    color: 0x9b59b6,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
  });

  private matSelection = new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  public update(_dt: number, world: World, _gameMode: GameMode, selectedIds: Set<EntityId>): void {
    const activeIds = new Set<EntityId>();
    const renderables = world.getEntitiesWith('transform', 'renderable');

    for (const [id, { transform, renderable }] of renderables) {
      if (!renderable.isVisible) continue;

      activeIds.add(id);

      const tag = world.getComponent(id, 'tag');
      const archetype = tag?.archetype;

      // Пропускаем 2D маркеры редактора в 3D виде
      if (archetype === 'marker') continue;

      let obj = this.meshes.get(id);

      // 1. Создание меша, если его еще нет
      if (!obj) {
        obj = this.createMeshForEntity(world, id, archetype);
        if (obj) {
          this.scene.add(obj);
          this.meshes.set(id, obj);
        }
      }

      // 2. Обновление состояния меша
      if (obj) {
        // Перенос координат: 2D(X, Y) -> 3D(X, Z).
        obj.position.x = transform.x;
        obj.position.z = transform.y;

        // В 2D поворот по часовой стрелке, в 3D вокруг Y против часовой, поэтому минус
        obj.rotation.y = -transform.angle;

        // Подсветка выделения
        const isSelected = selectedIds.has(id);
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh && child.userData.isSelectionOutline !== undefined) {
            child.visible = isSelected;
          }
        });

        // Сплющивание при смерти
        const health = world.getComponent(id, 'health');
        if (health && !health.isAlive) {
          obj.scale.set(1, 0.1, 1);
        } else {
          obj.scale.set(1, 1, 1);
        }

        // Динамическое обновление материала зоны при изменении эффекта в редакторе
        if (archetype === 'zone') {
          const zTrigger = world.getComponent(id, 'zoneTrigger');
          if (zTrigger) {
            let mat = this.matZoneNeutral;
            if (zTrigger.effect === 'damage') mat = this.matZoneDmg;
            else if (zTrigger.effect === 'heal') mat = this.matZoneHeal;

            const mainMesh = obj.children.find(
              (c) => c instanceof THREE.Mesh && !c.userData.isSelectionOutline
            ) as THREE.Mesh;
            if (mainMesh && mainMesh.material !== mat) {
              mainMesh.material = mat;
            }
          }
        }
      }
    }

    // 3. Очистка удаленных из мира сущностей
    for (const [id, mesh] of this.meshes.entries()) {
      if (!activeIds.has(id)) {
        this.scene.remove(mesh);
        this.meshes.delete(id);
      }
    }
  }

  private createMeshForEntity(
    world: World,
    id: EntityId,
    archetype: string | undefined
  ): THREE.Object3D | undefined {
    const physStats = world.getComponent(id, 'physicsStats');
    const radius = physStats ? physStats.radius.current : 16;
    const group = new THREE.Group();

    let mainMesh: THREE.Mesh | null = null;

    if (archetype === 'creature') {
      const aiStats = world.getComponent(id, 'aiStats');
      const behavior = aiStats?.behavior?.current;
      let mat = this.matIdle;
      if (behavior === 'PlayerTree') mat = this.matPlayer;
      else if (behavior === 'AttackerTree') mat = this.matEnemy;

      const h = 40;
      const geo = new THREE.CylinderGeometry(radius, radius, h, 16);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = h / 2;

      // "Нос" для индикации направления взгляда
      const noseGeo = new THREE.BoxGeometry(radius, radius * 0.4, radius * 0.4);
      const nose = new THREE.Mesh(noseGeo, mat);
      nose.position.set(radius, h * 0.75, 0); // Смотрит в сторону +X
      group.add(nose);
    } else if (archetype === 'obstacle') {
      let w = 100,
        d = 40;
      if (physStats?.points) {
        let minX = 0,
          maxX = 0,
          minY = 0,
          maxY = 0;
        physStats.points.forEach((p) => {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        });
        w = maxX - minX;
        d = maxY - minY;
      }
      const h = 60;
      const geo = new THREE.BoxGeometry(w, h, d);
      mainMesh = new THREE.Mesh(geo, this.matObstacle);
      mainMesh.position.y = h / 2;
    } else if (archetype === 'item') {
      const item = world.getComponent(id, 'item');
      let mat = this.matWeapon;
      if (item?.type === 'armor') mat = this.matArmor;
      else if (item?.type === 'bag') mat = this.matBag;

      const size = radius * 1.5;
      const geo = new THREE.BoxGeometry(size, size, size);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = size / 2;
    } else if (archetype === 'zone') {
      const zTrigger = world.getComponent(id, 'zoneTrigger');
      let mat = this.matZoneNeutral;
      if (zTrigger?.effect === 'damage') mat = this.matZoneDmg;
      else if (zTrigger?.effect === 'heal') mat = this.matZoneHeal;

      const geo = new THREE.CylinderGeometry(radius, radius, 2, 32);
      mainMesh = new THREE.Mesh(geo, mat);
      mainMesh.position.y = 1; // Чуть выше пола
    }

    if (mainMesh) {
      group.userData.entityId = id;
      mainMesh.userData.entityId = id;
      group.add(mainMesh);

      // Создаем обводку выделения
      const outlineGeo = mainMesh.geometry.clone();
      const outline = new THREE.Mesh(outlineGeo, this.matSelection);
      outline.scale.set(1.05, 1.05, 1.05);
      outline.position.copy(mainMesh.position);
      outline.userData.isSelectionOutline = true;
      outline.visible = false;
      group.add(outline);

      return group;
    }

    return undefined;
  }
}
