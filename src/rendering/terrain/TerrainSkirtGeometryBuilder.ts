import * as THREE from 'three';
import { TerrainComponent, getTerrainHeightAt } from '../../ecs/components/terrain';
import { TERRAIN_CONFIG } from '../../config/terrainConfig';

function calculateHillHeight(x: number, z: number, distFromBorder: number): number {
  const cfg = TERRAIN_CONFIG.skirt;
  const weight = Math.min(1.0, Math.max(0.0, distFromBorder / cfg.edgeBlendDistance));
  const t = weight * weight * (3 - 2 * weight);

  const distFactor = Math.min(1.0, distFromBorder / (cfg.distance * 0.8));
  const maxH = 12.0 + distFactor * (cfg.maxElevation - 12.0);

  const s = cfg.hillNoiseScale;
  const n1 = Math.sin(x * s + 1.2) * Math.cos(z * s + 2.3);
  const n2 = Math.sin(x * s * 2.4 - 0.7) * Math.sin(z * s * 2.4 + 1.1) * 0.5;
  const n3 = Math.cos(x * s * 5.1 + 3.1) * Math.cos(z * s * 4.9 - 1.9) * 0.25;

  const ridge = 1.0 - Math.abs(Math.sin(x * s * 1.5 + z * s * 1.2));
  const ridgeH = ridge * ridge * 0.65;

  const raw = (n1 + n2 + n3 + ridgeH + 1.0) * 0.45;
  const h = Math.max(0.0, raw) * maxH;

  return h * t;
}

export class TerrainSkirtGeometryBuilder {
  public static buildGeometry(terrainComp: TerrainComponent): THREE.BufferGeometry {
    const cfg = TERRAIN_CONFIG.skirt;
    const segments = cfg.segments;
    const rings = cfg.rings;
    const halfW = terrainComp.width / 2;
    const halfD = terrainComp.depth / 2;
    const skirtDist = cfg.distance;
    const distPower = cfg.distributionPower;

    const totalVerts = (segments + 1) * (rings + 1);
    const positions = new Float32Array(totalVerts * 3);
    const uvs = new Float32Array(totalVerts * 2);

    const totalQuads = segments * rings;
    const indices = new Uint32Array(totalQuads * 6);

    let vPtr = 0;
    let uvPtr = 0;

    for (let j = 0; j <= rings; j++) {
      const u = j / rings;
      const dist = skirtDist * Math.pow(u, distPower);

      for (let i = 0; i <= segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const absCos = Math.max(1e-5, Math.abs(cosA));
        const absSin = Math.max(1e-5, Math.abs(sinA));
        const tBorder = Math.min(halfW / absCos, halfD / absSin);

        const x0 = cosA * tBorder;
        const z0 = sinA * tBorder;

        const x = x0 + cosA * dist;
        const z = z0 + sinA * dist;

        const clampX = Math.max(-halfW + 0.01, Math.min(halfW - 0.01, x0));
        const clampZ = Math.max(-halfD + 0.01, Math.min(halfD - 0.01, z0));
        const edgeH = getTerrainHeightAt(terrainComp, clampX, clampZ) ?? 0;

        const edgeBlend = Math.max(0.0, 1.0 - dist / cfg.edgeBlendDistance);
        const smoothEdge = edgeBlend * edgeBlend * (3 - 2 * edgeBlend);
        const hillY = calculateHillHeight(x, z, dist);
        const y = edgeH * smoothEdge + hillY;

        positions[vPtr] = x;
        positions[vPtr + 1] = y;
        positions[vPtr + 2] = z;

        uvs[uvPtr] = i / segments;
        // Записываем дистанцию в метрах от кромки активного мира
        uvs[uvPtr + 1] = dist;

        vPtr += 3;
        uvPtr += 2;
      }
    }

    let iPtr = 0;
    const ringStride = segments + 1;
    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segments; i++) {
        const i0 = j * ringStride + i;
        const i1 = i0 + 1;
        const i2 = (j + 1) * ringStride + i;
        const i3 = i2 + 1;

        // Корректный обход против часовой стрелки (CCW) при взгляде сверху:
        // Треугольник 1: i0 -> i1 -> i2
        indices[iPtr++] = i0;
        indices[iPtr++] = i1;
        indices[iPtr++] = i2;

        // Треугольник 2: i1 -> i3 -> i2
        indices[iPtr++] = i1;
        indices[iPtr++] = i3;
        indices[iPtr++] = i2;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();

    return geometry;
  }

  public static updateEdgeHeights(
    geometry: THREE.BufferGeometry,
    terrainComp: TerrainComponent
  ): void {
    const posAttr = geometry.attributes.position;
    const cfg = TERRAIN_CONFIG.skirt;
    const segments = cfg.segments;
    const rings = cfg.rings;
    const halfW = terrainComp.width / 2;
    const halfD = terrainComp.depth / 2;
    const skirtDist = cfg.distance;
    const distPower = cfg.distributionPower;

    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const absCos = Math.max(1e-5, Math.abs(cosA));
      const absSin = Math.max(1e-5, Math.abs(sinA));
      const tBorder = Math.min(halfW / absCos, halfD / absSin);

      const x0 = cosA * tBorder;
      const z0 = sinA * tBorder;

      const clampX = Math.max(-halfW + 0.01, Math.min(halfW - 0.01, x0));
      const clampZ = Math.max(-halfD + 0.01, Math.min(halfD - 0.01, z0));
      const edgeH = getTerrainHeightAt(terrainComp, clampX, clampZ) ?? 0;

      for (let j = 0; j <= rings; j++) {
        const u = j / rings;
        const dist = skirtDist * Math.pow(u, distPower);
        if (dist > cfg.edgeBlendDistance) break;

        const vIdx = j * (segments + 1) + i;
        const x = posAttr.getX(vIdx);
        const z = posAttr.getZ(vIdx);

        const edgeBlend = Math.max(0.0, 1.0 - dist / cfg.edgeBlendDistance);
        const smoothEdge = edgeBlend * edgeBlend * (3 - 2 * edgeBlend);
        const hillY = calculateHillHeight(x, z, dist);
        const y = edgeH * smoothEdge + hillY;

        posAttr.setY(vIdx, y);
      }
    }

    posAttr.needsUpdate = true;
    geometry.computeVertexNormals();
  }
}
