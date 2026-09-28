import * as THREE from 'three';
import { World } from '../../ecs/World';
import { EntityId } from '../../ecs/types';
import { RigAnimatorState } from './CreatureMeshAssembler';
import { getAggregatedInteractionSlots } from '../../ecs/utils/hierarchy';
import { GripTransform } from '../gripCalculators';
import { disposeObject } from '../renderUtils';

export class RigSocketBinder {
  /**
   * Синхронизирует прикрепление предметов из ячеек взаимодействия (оружие, мячи и т.д.)
   * к костям сокетов скелетного рига существа (LeftHandSocket, RightHandSocket, JawsSocket и др.)
   */
  public syncCreatureSockets(
    creatureId: EntityId,
    animState: RigAnimatorState,
    world: World,
    meshes: Map<EntityId, THREE.Object3D>,
    scene: THREE.Scene
  ): void {
    const aggSlots = getAggregatedInteractionSlots(world, creatureId);

    for (const info of aggSlots) {
      if (!info.slot.rigSocketName) continue;

      const socketBone =
        animState.socketBones.get(info.slot.rigSocketName) ||
        animState.rig.getObjectByName(info.slot.rigSocketName);

      if (!socketBone) continue;

      if (info.slot.itemId) {
        const itemObj = meshes.get(info.slot.itemId);

        // Удаляем из кости все посторонние меши (если предмет был заменен или сброшен)
        for (let c = socketBone.children.length - 1; c >= 0; c--) {
          const child = socketBone.children[c];
          if (child !== itemObj) {
            socketBone.remove(child);
            const entId = child.userData.entityId;
            if (entId && world.hasEntity(entId)) {
              scene.add(child);
            } else {
              disposeObject(child);
            }
          }
        }

        // Прикрепляем актуальный предмет к кости с учетом точки хвата
        if (itemObj && itemObj.parent !== socketBone) {
          socketBone.add(itemObj);
          const grip = itemObj.userData.gripTransform as GripTransform | undefined;
          if (grip) {
            itemObj.position.copy(grip.position);
            itemObj.quaternion.copy(grip.quaternion);
          } else {
            itemObj.position.set(0, 0, 0);
            itemObj.rotation.set(0, 0, 0);
          }
        }
      } else {
        // Если ячейка пуста — полностью освобождаем сокет кости
        while (socketBone.children.length > 0) {
          const child = socketBone.children[0];
          socketBone.remove(child);
          const entId = child.userData.entityId;
          if (entId && world.hasEntity(entId)) {
            scene.add(child);
          } else {
            disposeObject(child);
          }
        }
      }
    }
  }
}
