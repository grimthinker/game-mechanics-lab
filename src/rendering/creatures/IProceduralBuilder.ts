import * as THREE from 'three';

export interface IProceduralCreatureBuilder {
  /** Создает пустой иерархический каркас рига с пивотами и сокетами */
  createRigTemplate(): THREE.Group;

  /** Создает меш для конкретной части тела (для сборки персонажа или отрыва конечности) */
  createPartMesh(partKey: string): THREE.Object3D | null;

  /** Генерирует и возвращает словарь всех поддерживаемых анимационных клипов */
  createAnimationClips(): Map<string, THREE.AnimationClip>;
}
