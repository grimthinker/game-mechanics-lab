import * as THREE from 'three';
import { TerrainComponent } from '../../ecs/components/terrain';
import { EntityId } from '../../ecs/types';
import { createTerrainMaterial } from './TerrainMaterial';
import { createTerrainSkirtMaterial } from './TerrainSkirtMaterial';
import { TerrainSkirtGeometryBuilder } from './TerrainSkirtGeometryBuilder';
import { disposeObject } from '../renderUtils';

export class TerrainSyncSystem {
  public createTerrainMesh(id: EntityId, terrainComp: TerrainComponent): THREE.Group {
    const group = new THREE.Group();
    group.userData.entityId = id;

    const res = terrainComp.resolution;
    const width = terrainComp.width;
    const depth = terrainComp.depth;

    const geo = new THREE.PlaneGeometry(width, depth, res - 1, res - 1);
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

    // Создаем процедурную юбку горизонта под размеры активного мира
    const skirtGeo = TerrainSkirtGeometryBuilder.buildGeometry(terrainComp);
    const skirtMat = createTerrainSkirtMaterial();
    const skirtMesh = new THREE.Mesh(skirtGeo, skirtMat);
    skirtMesh.receiveShadow = true;
    skirtMesh.userData.isTerrainSkirt = true;

    terrainComp.isGeometryDirty = false;
    terrainComp.isSplatDirty = false;

    group.add(mainMesh);
    group.add(skirtMesh);
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

      const skirtMesh = obj.children.find((c) => c.userData.isTerrainSkirt) as THREE.Mesh;
      if (skirtMesh && skirtMesh.geometry) {
        TerrainSkirtGeometryBuilder.updateEdgeHeights(skirtMesh.geometry, terrainComp);
      }

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

    const skirtMesh = obj.children.find((c) => c.userData.isTerrainSkirt) as THREE.Mesh;
    if (skirtMesh) {
      skirtMesh.geometry?.dispose();
      if (Array.isArray(skirtMesh.material)) {
        skirtMesh.material.forEach((m) => m.dispose());
      } else if (skirtMesh.material) {
        skirtMesh.material.dispose();
      }
    }

    disposeObject(obj);
  }
}
