import * as THREE from 'three';

export class ProceduralPropManager {
  private static instance: ProceduralPropManager;
  private cache = new Map<string, THREE.Group>();

  private constructor() {}

  public static getInstance(): ProceduralPropManager {
    if (!ProceduralPropManager.instance) {
      ProceduralPropManager.instance = new ProceduralPropManager();
    }
    return ProceduralPropManager.instance;
  }

  /**
   * Возвращает копию закэшированной модели.
   * Для статических мешей используется обычный clone(), который переиспользует Geometry и Material.
   */
  public getProp(name: string): THREE.Group | null {
    if (this.cache.has(name)) {
      return this.cache.get(name)!.clone();
    }

    let prop: THREE.Group | null = null;
    if (name === 'sword') {
      prop = this.buildSword();
    } else if (name === 'tree') {
      prop = this.buildTree();
    }

    if (prop) {
      // Защищаем общую геометрию и материалы от случайного удаления
      prop.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.userData.isSharedAsset = true;
          child.userData.isSharedMaterial = true;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.cache.set(name, prop);
      return prop.clone();
    }

    return null;
  }

  private buildSword(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'SwordRoot';

    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x95a5a6,
      roughness: 0.3,
      metalness: 0.8,
    });
    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x2c3e50,
      roughness: 0.6,
      metalness: 0.5,
    });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x8b4513,
      roughness: 0.9,
      metalness: 0.0,
    });

    // Лезвие (Blade)
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 0.02), metalMat);
    blade.position.set(0, 0.5, 0); // Смещено вверх от гарды
    group.add(blade);

    // Гарда (Crossguard)
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.04), darkMetalMat);
    guard.position.set(0, 0, 0); // Центр объекта на уровне гарды
    group.add(guard);

    // Рукоять (Grip)
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.03), leatherMat);
    grip.position.set(0, -0.125, 0);
    group.add(grip);

    // Навершие (Pommel)
    const pommel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), darkMetalMat);
    pommel.position.set(0, -0.25, 0);
    group.add(pommel);

    // Добавляем невидимый узел для хвата (GripPoint), чтобы предмет правильно ложился в руку
    const gripPoint = new THREE.Object3D();
    gripPoint.name = 'GripPoint';
    gripPoint.position.set(0, -0.1, 0); // Хват за рукоять чуть ниже гарды
    // Клинок (+Y) направлен вперед (+Z руки), а острая кромка (-X) смотрит вниз (-Y руки)
    gripPoint.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
    group.add(gripPoint);

    return group;
  }

  private buildTree(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'TreeRoot';

    const barkMat = new THREE.MeshStandardMaterial({ color: 0x5d4037, roughness: 0.9 });
    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2e7d32,
      roughness: 0.8,
      flatShading: true,
    });

    // Ствол (Trunk) - цилиндр с низким кол-вом полигонов (low-poly)
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.35, 3.0, 6), barkMat);
    trunk.position.set(0, 1.5, 0); // Основание у земли (y=0)
    group.add(trunk);

    // Крона (Leaves) - состоит из 3 пересекающихся додекаэдров разного размера
    const crown1 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.6, 0), leafMat);
    crown1.position.set(0, 3.5, 0);
    group.add(crown1);

    const crown2 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2, 0), leafMat);
    crown2.position.set(0.8, 3.0, -0.6);
    group.add(crown2);

    const crown3 = new THREE.Mesh(new THREE.DodecahedronGeometry(1.3, 0), leafMat);
    crown3.position.set(-0.7, 2.8, 0.5);
    group.add(crown3);

    return group;
  }
}
