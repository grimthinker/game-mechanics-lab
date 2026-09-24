import * as THREE from 'three';
import { TerrainComponent } from '../../ecs/components/terrain';
import { EntityId } from '../../ecs/types';
import { createTerrainMaterial } from './TerrainMaterial';
import { disposeObject } from '../renderUtils';

export class TerrainSyncSystem {
  public createTerrainMesh(id: EntityId, terrainComp: TerrainComponent): THREE.Group {
    const group = new THREE.Group();
    group.userData.entityId = id;

    const res = terrainComp.resolution;
    const size = terrainComp.size;

    const geo = new THREE.PlaneGeometry(size, size, res - 1, res - 1);
    geo.rotateX(-Math.PI / 2); // Ориентируем плоскость горизонтально в плоскости XZ

    // Задаем начальные высоты вершин
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setY(i, terrainComp.heights[i]);
    }
    posAttr.needsUpdate = true;
    geo.computeVertexNormals();

    // Создаем текстуру Splatmap из Uint8Array высокой плотности (512x512)
    const splatRes = terrainComp.splatResolution || 512;
    const splatTexture = new THREE.DataTexture(
      terrainComp.splatData,
      splatRes,
      splatRes,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    splatTexture.wrapS = THREE.ClampToEdgeWrapping;
    splatTexture.wrapT = THREE.ClampToEdgeWrapping;
    splatTexture.magFilter = THREE.LinearFilter;
    splatTexture.minFilter = THREE.LinearFilter;
    splatTexture.generateMipmaps = false;
    splatTexture.needsUpdate = true;

    const terrainMat = createTerrainMaterial(splatTexture, terrainComp.textureTiling);
    const mainMesh = new THREE.Mesh(geo, terrainMat);
    mainMesh.receiveShadow = true;
    mainMesh.userData.isTerrainMesh = true;
    mainMesh.userData.splatTexture = splatTexture;

    terrainComp.isGeometryDirty = false;
    terrainComp.isSplatDirty = false;

    group.add(mainMesh);
    return group;
  }

  public syncTerrain(obj: THREE.Object3D, terrainComp: TerrainComponent): void {
    const terrainMesh = obj.children.find((c) => c.userData.isTerrainMesh) as THREE.Mesh;
    if (!terrainMesh || !terrainMesh.geometry) return;

    if (terrainComp.isGeometryDirty) {
      const posAttr = terrainMesh.geometry.attributes.position;
      const heights = terrainComp.heights;
      for (let i = 0; i < posAttr.count; i++) {
        posAttr.setY(i, heights[i]);
      }
      posAttr.needsUpdate = true;
      terrainMesh.geometry.computeVertexNormals();
      terrainComp.isGeometryDirty = false;
    }

    if (terrainComp.isSplatDirty && terrainMesh.userData.splatTexture) {
      terrainMesh.userData.splatTexture.needsUpdate = true;
      terrainComp.isSplatDirty = false;
    }
  }

  public disposeTerrain(obj: THREE.Object3D): void {
    const terrainMesh = obj.children.find((c) => c.userData.isTerrainMesh) as THREE.Mesh;
    if (terrainMesh) {
      if (terrainMesh.userData.splatTexture) {
        terrainMesh.userData.splatTexture.dispose();
      }
    }
    disposeObject(obj);
  }
}
