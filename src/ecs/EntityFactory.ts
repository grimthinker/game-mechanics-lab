import { World } from './World';
import { PhysicsSystem } from './systems/PhysicsSystem';
import { AISystem } from './systems/AISystem';
import { EntityId, EntityConfig, CollisionCategory, COLLISION_MASK_ALL } from './types';
import { Point } from '../types';
import { ARCHETYPE_ASSEMBLERS, detectArchetype } from './archetypes';
import { assembleBodyPart } from './archetypes/BodyPartArchetype';
import { Circle } from 'detect-collisions';
import { createStat } from './stats/StatEvaluator';
import { BALANCE_CONFIG } from '../config/balanceConfig';

export class EntityFactory {
  public generateId(prefix: string = 'ent'): EntityId {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  public spawnEntity(
    world: World,
    physics: PhysicsSystem,
    aiSystem: AISystem,
    config: EntityConfig,
    position?: Point,
    forcedId?: string
  ): EntityId {
    const id = forcedId || this.generateId('ent');
    world.createEntity(id);

    const archetype = detectArchetype(config);
    const assembler = ARCHETYPE_ASSEMBLERS[archetype] ?? ARCHETYPE_ASSEMBLERS.creature;
    assembler(world, physics, aiSystem, id, config, position);

    return id;
  }

  public spawnModularHumanoid(
    world: World,
    physics: PhysicsSystem,
    aiSystem: AISystem,
    position: Point,
    behavior: string = 'IdleTree',
    name: string = 'Существо'
  ): EntityId {
    const rootId = this.generateId('creature');
    world.createEntity(rootId);

    // Abstract Root Setup
    const rootConfig: EntityConfig = { ai: { behavior }, meta: { name, entityType: 'creature' } };
    ARCHETYPE_ASSEMBLERS.creature(world, physics, aiSystem, rootId, rootConfig, position);

    // Initial Physics and Render for Root (required for anatomy system and rendering)
    const radius = 16;
    world.addComponent(rootId, 'physicsStats', {
      radius: createStat(radius),
      weight: createStat(10),
      isSolid: true,
    });
    const body = new Circle({ x: position.x, y: position.y }, radius);
    body.isStatic = false;
    world.addComponent(rootId, 'physicsBody', {
      body,
      isStatic: false,
      category: CollisionCategory.CREATURE,
      mask: COLLISION_MASK_ALL,
    });
    physics.registerBody(rootId, body);

    world.addComponent(rootId, 'renderable', {
      zIndex: 40,
      isVisible: true,
      syncWithTransform: true,
      primitives: [
        {
          kind: 'circle',
          radius,
          fill: '#34495e',
          stroke: behavior === 'PlayerTree' ? '#2980b9' : '#c0392b',
          strokeWidth: 2,
        },
        {
          kind: 'polygon',
          points: [
            { x: radius, y: 0 },
            { x: 0, y: -radius },
            { x: 0, y: radius },
          ],
          fill: '#7f8c8d',
          stroke: '#95a5a6',
          strokeWidth: 1.5,
        },
      ],
    });

    world.addComponent(rootId, 'perception', {
      visionFovAngle: BALANCE_CONFIG.senses.defaultFovAngle,
      visionClarity: BALANCE_CONFIG.senses.defaultVisionClarity,
      visionMaxDistance: BALANCE_CONFIG.senses.defaultVisionMaxDistance,
      hearingSensitivity: BALANCE_CONFIG.senses.defaultHearingSensitivity,
      hearingMaxDistance: BALANCE_CONFIG.senses.defaultHearingMaxDistance,
    });

    // Body Parts Generation
    const torsoId = this.generateId('part_torso');
    const headId = this.generateId('part_head');
    const armLId = this.generateId('part_arm_l');
    const armRId = this.generateId('part_arm_r');
    const legLId = this.generateId('part_leg_l');
    const legRId = this.generateId('part_leg_r');

    const createSocketLink = (
      strA: number,
      strB: number,
      sizeA: number,
      sizeB: number,
      targetEntityId: string,
      targetSocketId: string
    ) => {
      const strength = Math.min(strA, strB);
      return {
        targetEntityId,
        targetSocketId,
        currentStrength: strength,
        maxStrength: createStat(strength),
        socketSize: sizeA + sizeB,
      };
    };

    // Torso (Ядро / Сердце)
    world.createEntity(torsoId);
    assembleBodyPart(
      world,
      physics,
      aiSystem,
      torsoId,
      {
        tag: { archetype: 'bodyPart', subType: 'torso' },
        meta: { name: 'Туловище' },
        physics: { radius: 12, weight: 15, size: 20 },
        heart: { requiresBrain: true },
        socketDef: {
          sockets: {
            neck: { type: 'neck', size: 10, strength: 50 },
            l_shoulder: { type: 'shoulder', size: 10, strength: 40 },
            r_shoulder: { type: 'shoulder', size: 10, strength: 40 },
            l_hip: { type: 'hip', size: 12, strength: 50 },
            r_hip: { type: 'hip', size: 12, strength: 50 },
          },
        },
        socketLink: {
          links: {
            neck: createSocketLink(50, 50, 10, 10, headId, 'base'),
            l_shoulder: createSocketLink(40, 40, 10, 10, armLId, 'base'),
            r_shoulder: createSocketLink(40, 40, 10, 10, armRId, 'base'),
            l_hip: createSocketLink(50, 50, 12, 12, legLId, 'base'),
            r_hip: createSocketLink(50, 50, 12, 12, legRId, 'base'),
          },
        },
        equip: {
          equipmentAreas: [
            { id: 'torso', name: 'Туловище', type: 'torso', space: 20, itemIds: [] },
          ],
        },
      },
      position
    );

    // Head (Мозг, Зрение, Слух)
    world.createEntity(headId);
    assembleBodyPart(
      world,
      physics,
      aiSystem,
      headId,
      {
        tag: { archetype: 'bodyPart', subType: 'head' },
        meta: { name: 'Голова' },
        physics: { radius: 8, weight: 5, size: 10 },
        vision: {
          fovAngle: BALANCE_CONFIG.senses.defaultFovAngle,
          clarity: BALANCE_CONFIG.senses.defaultVisionClarity,
          maxDistance: BALANCE_CONFIG.senses.defaultVisionMaxDistance,
        },
        hearing: {
          sensitivity: BALANCE_CONFIG.senses.defaultHearingSensitivity,
          maxDistance: BALANCE_CONFIG.senses.defaultHearingMaxDistance,
        },
        socketDef: { sockets: { base: { type: 'neck', size: 10, strength: 50 } } },
        socketLink: {
          links: {
            base: createSocketLink(50, 50, 10, 10, torsoId, 'neck'),
          },
        },
        bodyBrain: { power: 100, isActive: true, rootEntityId: rootId },
        equip: {
          equipmentAreas: [{ id: 'head', name: 'Голова', type: 'head', space: 10, itemIds: [] }],
        },
      },
      position
    );
    aiSystem.initBotBrain(world, headId, behavior);

    // Left Arm
    world.createEntity(armLId);
    assembleBodyPart(
      world,
      physics,
      aiSystem,
      armLId,
      {
        tag: { archetype: 'bodyPart', subType: 'arm' },
        meta: { name: 'Левая рука' },
        physics: { radius: 6, weight: 4, size: 10 },
        socketDef: { sockets: { base: { type: 'shoulder', size: 10, strength: 40 } } },
        socketLink: {
          links: {
            base: createSocketLink(40, 40, 10, 10, torsoId, 'l_shoulder'),
          },
        },
        interactionSlots: {
          id: 'hand_left',
          interactDist: 25,
          strength: 15,
          itemId: null,
        },
        equip: {
          equipmentAreas: [
            { id: 'hands_l', name: 'Левая рука', type: 'hands', space: 10, itemIds: [] },
          ],
        },
      },
      position
    );

    // Right Arm
    world.createEntity(armRId);
    assembleBodyPart(
      world,
      physics,
      aiSystem,
      armRId,
      {
        tag: { archetype: 'bodyPart', subType: 'arm' },
        meta: { name: 'Правая рука' },
        physics: { radius: 6, weight: 4, size: 10 },
        socketDef: { sockets: { base: { type: 'shoulder', size: 10, strength: 40 } } },
        socketLink: {
          links: {
            base: createSocketLink(40, 40, 10, 10, torsoId, 'r_shoulder'),
          },
        },
        interactionSlots: {
          id: 'hand_right',
          interactDist: 25,
          strength: 15,
          itemId: null,
        },
        equip: {
          equipmentAreas: [
            { id: 'hands_r', name: 'Правая рука', type: 'hands', space: 10, itemIds: [] },
          ],
        },
      },
      position
    );

    // Left Leg (Локомоция)
    world.createEntity(legLId);
    assembleBodyPart(
      world,
      physics,
      aiSystem,
      legLId,
      {
        tag: { archetype: 'bodyPart', subType: 'leg' },
        meta: { name: 'Левая нога' },
        physics: { radius: 7, weight: 6, size: 12 },
        locomotion: {},
        socketDef: { sockets: { base: { type: 'hip', size: 12, strength: 50 } } },
        socketLink: {
          links: {
            base: createSocketLink(50, 50, 12, 12, torsoId, 'l_hip'),
          },
        },
        equip: {
          equipmentAreas: [
            { id: 'legs_l', name: 'Левая нога', type: 'legs', space: 12, itemIds: [] },
          ],
        },
      },
      position
    );

    // Right Leg (Локомоция)
    world.createEntity(legRId);
    assembleBodyPart(
      world,
      physics,
      aiSystem,
      legRId,
      {
        tag: { archetype: 'bodyPart', subType: 'leg' },
        meta: { name: 'Правая нога' },
        physics: { radius: 7, weight: 6, size: 12 },
        locomotion: {},
        socketDef: { sockets: { base: { type: 'hip', size: 12, strength: 50 } } },
        socketLink: {
          links: {
            base: createSocketLink(50, 50, 12, 12, torsoId, 'r_hip'),
          },
        },
        equip: {
          equipmentAreas: [
            { id: 'legs_r', name: 'Правая нога', type: 'legs', space: 12, itemIds: [] },
          ],
        },
      },
      position
    );
    // Give the torso a bag by default
    const bagId = this.generateId('item_bag');
    world.createEntity(bagId);
    ARCHETYPE_ASSEMBLERS.item(
      world,
      physics,
      aiSystem,
      bagId,
      {
        tag: { archetype: 'item', subType: 'bag' },
        item: {
          name: 'Сумка',
          type: 'bag',
          maxStack: 1,
          count: 1,
          size: 10,
          equipTypes: ['torso'],
          equippable: true,
          equipTimeMultiplier: 1.0,
        },
        physics: { radius: 16, weight: 1, isSolid: true },
        ownership: { ownerId: torsoId, status: 'equipped' },
        inventory: { size: { width: 6, height: 4 } },
      },
      position
    );

    const torsoEquip = world.getComponent(torsoId, 'equip');
    if (torsoEquip) {
      torsoEquip.equipmentAreas.find((a) => a.type === 'torso')?.itemIds.push(bagId);
    }

    return rootId;
  }
}
