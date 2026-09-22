import * as THREE from 'three';

export interface GripTransform {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
}

/**
 * Вычисляет Bounding Box объекта строго в его локальной системе координат,
 * игнорируя мировое положение объекта на сцене.
 */
export function computeLocalBox(rootObject: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3();
  rootObject.updateMatrix();

  rootObject.traverse((child) => {
    if (child instanceof THREE.Mesh && child.visible && !child.userData.isSelectionOutline) {
      if (child.geometry) {
        if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
        if (child.geometry.boundingBox) {
          // Строим локальную матрицу трансформации от меша до rootObject
          const m = new THREE.Matrix4();
          let curr: THREE.Object3D | null = child;
          const chain: THREE.Object3D[] = [];
          while (curr && curr !== rootObject) {
            chain.push(curr);
            curr = curr.parent;
          }
          for (let i = chain.length - 1; i >= 0; i--) {
            chain[i].updateMatrix();
            m.multiply(chain[i].matrix);
          }

          const childBox = child.geometry.boundingBox.clone().applyMatrix4(m);
          box.union(childBox);
        }
      }
    }
  });

  if (box.isEmpty()) {
    box.set(new THREE.Vector3(-0.15, -0.15, -0.15), new THREE.Vector3(0.15, 0.15, 0.15));
  }

  return box;
}

/**
 * Автоматически рассчитывает точку хвата на поверхности оторванной части тела
 */
export function computeDetachedLimbGrip(limbGroup: THREE.Group, subType?: string): GripTransform {
  // Вычисляем размеры строго в локальных координатах отцентрированной конечности
  const box = computeLocalBox(limbGroup);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const quat = new THREE.Quaternion();
  const gripPos = center.clone();

  // 1. ТУЛОВИЩЕ
  if (subType === 'torso') {
    // Хват за верхнюю плечевую зону; туловище свободно свисает вертикально вниз вдоль бедра
    gripPos.y = box.max.y * 0.75;
    gripPos.z = box.max.z * 0.45; // На внешнюю плоскость груди
  }
  // 2. ГОЛОВА
  else if (subType === 'head') {
    // Хват за основание шеи снизу
    gripPos.y = box.min.y * 0.7;
    gripPos.z = box.max.z * 0.4;
  }
  // 3. РУКИ И НОГИ
  else {
    // Определяем продольную ось длины
    let majorAxis: 'x' | 'y' | 'z' = 'y';
    if (size.x >= size.y && size.x >= size.z) majorAxis = 'x';
    else if (size.z >= size.y && size.z >= size.x) majorAxis = 'z';

    // Хват за верхнюю часть сустава среза; конечность свисает вниз
    if (majorAxis === 'y') {
      gripPos.y = box.max.y * 0.75;
      gripPos.z = box.max.z * 0.45;
    } else if (majorAxis === 'x') {
      gripPos.x = box.max.x * 0.75;
      gripPos.y = box.max.y * 0.45;
      // Если анатомическая кость была ориентирована по X, выравниваем ее вертикально вниз
      quat.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    } else {
      gripPos.z = box.max.z * 0.75;
      gripPos.y = box.max.y * 0.45;
      quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
    }
  }

  // Инвертируем вектор хвата с учетом поворота, чтобы точка на поверхности легла ровно в ладонь (0, 0, 0)
  const finalPos = gripPos.clone().negate().applyQuaternion(quat);

  return {
    position: finalPos,
    quaternion: quat,
  };
}

/**
 * Рассчитывает точку хвата для обычных предметов, оружия и примитивов
 */
export function computeItemGrip(itemObj: THREE.Object3D, itemType?: string): GripTransform {
  // 1. Поиск явной ноды рукояти в 3D-модели (GripPoint / Handle)
  const explicitGrip =
    itemObj.getObjectByName('GripPoint') ||
    itemObj.getObjectByName('Handle') ||
    itemObj.getObjectByName('grip');

  if (explicitGrip) {
    explicitGrip.updateMatrix();
    const pos = explicitGrip.position.clone().negate();
    const quat = explicitGrip.quaternion.clone().invert();
    return { position: pos, quaternion: quat };
  }

  // 2. Локальный расчет по Bounding Box без утечки мировых координат
  const box = computeLocalBox(itemObj);
  const size = new THREE.Vector3();
  box.getSize(size);
  const center = new THREE.Vector3();
  box.getCenter(center);

  const quat = new THREE.Quaternion();
  const gripPos = center.clone();

  const maxDim = Math.max(size.x, size.y, size.z);
  const minDim = Math.min(size.x, size.y, size.z);
  const isElongated = maxDim > minDim * 1.6;

  if (itemType === 'weapon' && isElongated) {
    // Для длинного оружия хват на 28% от заднего конца
    if (size.x >= size.y && size.x >= size.z) {
      gripPos.x = box.min.x + size.x * 0.28;
      gripPos.y = box.min.y + size.y * 0.45;
    } else if (size.y >= size.x && size.y >= size.z) {
      gripPos.y = box.min.y + size.y * 0.28;
      gripPos.z = box.min.z + size.z * 0.45;
      quat.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    } else {
      gripPos.z = box.min.z + size.z * 0.28;
      gripPos.y = box.min.y + size.y * 0.45;
    }
  } else {
    // Для ящиков, брони, шлемов прижимаем нижнюю плоскость к ладони
    gripPos.y = box.min.y + Math.min(0.04, size.y * 0.2);
  }

  const finalPos = gripPos.clone().negate().applyQuaternion(quat);

  return {
    position: finalPos,
    quaternion: quat,
  };
}
