import { GameSimulation } from '../../core/GameSimulation';
import { Vec3, Radians } from '../../types';
import { deg2Rad, createRectanglePoints } from '../../utils';
import { createEffectorZoneConfig } from '../archetypes/ZoneArchetype';
import { createDefaultTerrainConfig } from '../archetypes/TerrainArchetype';
import { createDefaultEnvironmentConfig } from '../archetypes/EnvironmentArchetype';
import {
  createHouseConfig,
  createFenceConfig,
  createRockConfig,
  createTreeConfig,
} from '../archetypes/ObstacleArchetype';
import { getTerrainHeightAt } from '../components/terrain';
import { spawnFetchGroup } from './fetchGroupPrefab';

export function initDefaultWorldPrefab(simulation: GameSimulation, center?: Vec3): void {
  const { x: bx, y: by, z: bz } = center ?? { x: 0, y: 0, z: 0 };

  // 1. Спавн процедурного террейна и окружения
  simulation.spawnEntity(createDefaultTerrainConfig(100, 100), { x: 0, y: 0, z: 0 }, 'terrain');
  simulation.spawnEntity(createDefaultEnvironmentConfig(), { x: 0, y: 0, z: 0 }, 'environment');

  const terrainComp = simulation.world.getComponent('terrain', 'terrain');
  const getHeight = (x: number, z: number): number => {
    if (!terrainComp) return by;
    return getTerrainHeightAt(terrainComp, x, z) ?? by;
  };

  // 2. Спавн дома в центре двора (фасад ориентирован на запад к подъездной дорожке)
  const houseX = bx + 1.0;
  const houseZ = bz + 0.0;
  const houseY = getHeight(houseX, houseZ);
  simulation.spawnEntity(
    createHouseConfig({ x: houseX, y: houseY, z: houseZ }, (-Math.PI / 2) as Radians)
  );

  // 3. Сборка периметра деревянного забора вокруг двора дома с проемом для ворот
  const spawnFenceSegment = (x: number, z: number, angle: Radians) => {
    const gy = getHeight(x, z);
    simulation.spawnEntity(createFenceConfig(2.4, { x, y: gy, z }, angle));
  };

  const spawnFenceLine = (ax: number, az: number, bxCoord: number, bzCoord: number) => {
    const dx = bxCoord - ax;
    const dz = bzCoord - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.5) return;

    const angle = Math.atan2(dz, dx) as Radians;
    const segLen = 2.35;
    const count = Math.max(1, Math.round(len / segLen));
    const step = len / count;
    const dirX = dx / len;
    const dirZ = dz / len;

    for (let i = 0; i < count; i++) {
      const d = (i + 0.5) * step;
      spawnFenceSegment(ax + dirX * d, az + dirZ * d, angle);
    }
  };

  // Узловые точки периметра забора усадьбы
  spawnFenceLine(bx - 6.0, bz - 8.5, bx + 7.0, bz - 8.5);
  spawnFenceLine(bx + 7.0, bz - 8.5, bx + 7.0, bz + 8.5);
  spawnFenceLine(bx + 7.0, bz + 8.5, bx - 6.0, bz + 8.5);
  spawnFenceLine(bx - 6.0, bz + 8.5, bx - 9.0, bz + 3.2);
  spawnFenceLine(bx - 6.0, bz - 8.5, bx - 9.0, bz - 2.8);

  // 4. Спавн лесных массивов
  const spawnTree = (tx: number, tz: number) => {
    const ty = getHeight(tx, tz);
    const randomAngle = (Math.random() * Math.PI * 2) as Radians;
    simulation.spawnEntity(
      createTreeConfig(
        'proc://prop/tree',
        'Дерево',
        0.3,
        3.0,
        4.0,
        0.6,
        { x: tx, y: ty, z: tz },
        randomAngle
      ),
      { x: tx, y: ty, z: tz }
    );
  };

  // Северная роща
  for (let i = 0; i < 28; i++) {
    const tx = bx + (Math.random() - 0.3) * 26;
    const tz = bz - 20 - Math.random() * 24;
    spawnTree(tx, tz);
  }

  // Южный лесной массив
  for (let i = 0; i < 34; i++) {
    const tx = bx + (Math.random() - 0.4) * 36;
    const tz = bz + 18 + Math.random() * 26;
    spawnTree(tx, tz);
  }

  // Деревья вдоль обочин тракта
  const roadTreePositions = [
    { x: -7, z: -42 },
    { x: -8, z: -32 },
    { x: -10, z: -20 },
    { x: -13, z: -10 },
    { x: -14, z: 8 },
    { x: -16, z: 18 },
    { x: -19, z: 28 },
    { x: -25, z: 38 },
    { x: -33, z: 46 },
  ];
  roadTreePositions.forEach((pt) => spawnTree(bx + pt.x, bz + pt.z));

  // Деревья на восточной поляне
  const eastTreePositions = [
    { x: 30, z: -16 },
    { x: 33, z: -10 },
    { x: 34, z: -2 },
    { x: 33, z: 8 },
    { x: 30, z: 16 },
    { x: 26, z: 22 },
    { x: 42, z: -25 },
  ];
  eastTreePositions.forEach((pt) => spawnTree(bx + pt.x, bz + pt.z));

  // Деревья внутри двора
  spawnTree(bx - 2.5, bz - 6.5);
  spawnTree(bx + 4.5, bz + 4.5);

  // 5. Россыпи камней (все 5 вариантов)
  const rockSpawns = [
    { x: -18, z: 12, v: 1 as const, s: 1.2 },
    { x: -24, z: 25, v: 4 as const, s: 1.4 },
    { x: -15, z: -24, v: 5 as const, s: 1.1 },
    { x: -28, z: 40, v: 2 as const, s: 1.3 },
    { x: -17, z: -38, v: 1 as const, s: 1.0 },
    { x: 13, z: -14, v: 3 as const, s: 1.3 },
    { x: 29, z: -8, v: 2 as const, s: 1.5 },
    { x: 28, z: 10, v: 4 as const, s: 1.2 },
    { x: 14, z: 8, v: 1 as const, s: 1.0 },
    { x: -12, z: -4, v: 5 as const, s: 0.9 },
    { x: -11, z: 5, v: 2 as const, s: 1.0 },
  ];

  rockSpawns.forEach((r, idx) => {
    const rx = bx + r.x;
    const rz = bz + r.z;
    const ry = getHeight(rx, rz);
    const angle = ((idx * 1.37) % (Math.PI * 2)) as Radians;
    simulation.spawnEntity(createRockConfig(r.v, r.s, { x: rx, y: ry, z: rz }, angle));
  });

  // 6. Игрок
  const playerX = bx - 11.5;
  const playerZ = bz + 0.5;
  const playerY = getHeight(playerX, playerZ);
  simulation.playerEntityId = simulation.entityFactory.spawnModularHumanoid(
    simulation.world,
    simulation.physics,
    simulation.aiSystem,
    { x: playerX, y: playerY, z: playerZ },
    'PlayerTree',
    'Игрок'
  );

  // 7. Префаб связки «Хозяин и собаки (Апорт)»
  const masterX = bx - 2.5;
  const masterZ = bz + 0.5;
  const masterY = getHeight(masterX, masterZ);
  spawnFetchGroup(simulation, { x: masterX, y: masterY, z: masterZ });

  // 8. Зона эффектора
  const healY = getHeight(bx + 4.0, bz - 4.5);
  simulation.spawnEntity(createEffectorZoneConfig('heal', 2.5, 15), {
    x: bx + 4.0,
    y: healY,
    z: bz - 4.5,
  });

  // 9. Предметы экипировки и оружие во дворе
  const yardItemY = getHeight(bx - 2.5, bz + 2.2);
  simulation.spawnEntity(
    {
      tag: { archetype: 'item', subType: 'weapon' },
      meta: { name: 'Меч', entityType: 'item' },
      visualModel: { modelId: 'proc://prop/sword' },
      item: {
        name: 'Меч',
        type: 'weapon',
        maxStack: 1,
        count: 1,
        size: 10,
        equipTypes: [],
        equippable: false,
        equipTimeMultiplier: 1.0,
      },
      physics: {
        radius: 0.4,
        weight: 2,
        isSolid: true,
        halfExtents: { x: 0.15, y: 0.64, z: 0.02 },
        colliderOffset: { x: 0, y: 0.36, z: 0 },
      },
      weaponStats: { baseDamage: 25, prepTime: 0.2, castTime: 0, recoveryTime: 0.3 },
      weaponZone: {
        hitZoneType: 'angle',
        radius: 2.5,
        angle: deg2Rad(90),
        pierceObstacles: false,
        pierceCreatures: false,
        pierceItems: false,
      },
    },
    { x: bx - 2.5, y: yardItemY + 0.2, z: bz + 2.2 }
  );

  simulation.spawnEntity(
    {
      tag: { archetype: 'item', subType: 'armor' },
      item: {
        name: 'Тяжёлый нагрудник',
        type: 'armor',
        maxStack: 1,
        count: 1,
        size: 20,
        equipTypes: ['torso'],
        equippable: true,
        equipTimeMultiplier: 1.0,
      },
      physics: { radius: 0.4, weight: 20, isSolid: true },
      armorStats: { defense: 25, flatReduction: 5 },
    },
    { x: bx - 2.5, y: yardItemY + 0.2, z: bz + 3.0 }
  );

  simulation.spawnEntity(
    {
      tag: { archetype: 'item', subType: 'armor' },
      item: {
        name: 'Стальной шлем',
        type: 'armor',
        maxStack: 1,
        count: 1,
        size: 10,
        equipTypes: ['head'],
        equippable: true,
        equipTimeMultiplier: 1.0,
      },
      physics: { radius: 0.3, weight: 10, isSolid: true },
      armorStats: { defense: 15, flatReduction: 2 },
    },
    { x: bx - 2.5, y: yardItemY + 0.2, z: bz + 3.8 }
  );

  simulation.syncPhysicsStructures();
}
