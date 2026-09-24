import * as THREE from 'three';

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      if (!child.userData.isSharedAsset) {
        child.geometry?.dispose();
      }
      if (!child.userData.isSharedAsset && !child.userData.isSharedMaterial) {
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => m.dispose());
        } else if (child.material) {
          child.material.dispose();
        }
      }
    }
  });
}

export function attachOutlines(object: THREE.Object3D, material: THREE.Material): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh && !child.userData.isSelectionOutline) {
      const outline = new THREE.Mesh(child.geometry, material);
      outline.scale.set(1.06, 1.06, 1.06);
      outline.userData.isSelectionOutline = true;
      outline.visible = false;
      child.add(outline);
    }
  });
}
