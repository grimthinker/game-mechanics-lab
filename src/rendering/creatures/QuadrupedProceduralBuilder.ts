import * as THREE from 'three';
import { IProceduralCreatureBuilder } from './IProceduralBuilder';
import { AnimationTrackBuilder } from './AnimationTrackBuilder';

export class QuadrupedProceduralBuilder implements IProceduralCreatureBuilder {
  private clipsCache: Map<string, THREE.AnimationClip> | null = null;

  // Кэшированные материалы собаки для исключения утечек памяти
  private static furMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.6 });
  private static chestFurMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.6 });
  private static collarMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
  private static noseMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
  private static eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

  public createRigTemplate(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'DogRoot';

    const torso = new THREE.Group();
    torso.name = 'Torso';
    torso.position.set(0, 0.48, 0);
    root.add(torso);

    const headPivot = new THREE.Group();
    headPivot.name = 'HeadPivot';
    headPivot.position.set(0, 0.18, 0.3);

    const jawsSocket = new THREE.Group();
    jawsSocket.name = 'JawsSocket';
    jawsSocket.position.set(0, -0.02, 0.38);
    headPivot.add(jawsSocket);

    torso.add(headPivot);

    const tailPivot = new THREE.Group();
    tailPivot.name = 'TailPivot';
    tailPivot.position.set(0, 0.08, -0.36);
    torso.add(tailPivot);

    const frontLeftLegPivot = new THREE.Group();
    frontLeftLegPivot.name = 'FrontLeftLegPivot';
    frontLeftLegPivot.position.set(0.16, 0.4, 0.22);
    root.add(frontLeftLegPivot);

    const frontRightLegPivot = new THREE.Group();
    frontRightLegPivot.name = 'FrontRightLegPivot';
    frontRightLegPivot.position.set(-0.16, 0.4, 0.22);
    root.add(frontRightLegPivot);

    const backLeftLegPivot = new THREE.Group();
    backLeftLegPivot.name = 'BackLeftLegPivot';
    backLeftLegPivot.position.set(0.16, 0.4, -0.22);
    root.add(backLeftLegPivot);

    const backRightLegPivot = new THREE.Group();
    backRightLegPivot.name = 'BackRightLegPivot';
    backRightLegPivot.position.set(-0.16, 0.4, -0.22);
    root.add(backRightLegPivot);

    return root;
  }

  public createPartMesh(partKey: string): THREE.Object3D | null {
    const { furMat, chestFurMat, collarMat, noseMat, eyeMat } = QuadrupedProceduralBuilder;

    switch (partKey) {
      case 'torso': {
        const torsoMesh = new THREE.Group();
        torsoMesh.name = 'TorsoMesh';

        const mane = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.32), chestFurMat);
        mane.position.set(0, 0.01, 0.12);
        mane.castShadow = true;
        torsoMesh.add(mane);

        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.385, 0.385, 0.05), collarMat);
        collar.position.set(0, 0.01, 0.27);
        collar.castShadow = true;
        torsoMesh.add(collar);

        const hindBody = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.38), furMat);
        hindBody.position.set(0, -0.01, -0.18);
        hindBody.castShadow = true;
        torsoMesh.add(hindBody);

        return torsoMesh;
      }
      case 'head': {
        const headGroup = new THREE.Group();
        headGroup.name = 'Head';

        const headBox = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.3), furMat);
        headBox.position.set(0, 0.06, 0.1);
        headBox.castShadow = true;
        headGroup.add(headBox);

        const muzzle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.18), furMat);
        muzzle.position.set(0, 0.0, 0.28);
        muzzle.castShadow = true;
        headGroup.add(muzzle);

        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.03), noseMat);
        nose.position.set(0, 0.04, 0.375);
        nose.castShadow = true;
        headGroup.add(nose);

        const leftEye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
        leftEye.position.set(0.11, 0.08, 0.25);
        headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
        rightEye.position.set(-0.11, 0.08, 0.25);
        headGroup.add(rightEye);

        const leftEar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), furMat);
        leftEar.position.set(0.1, 0.24, 0.08);
        leftEar.castShadow = true;
        headGroup.add(leftEar);

        const rightEar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), furMat);
        rightEar.position.set(-0.1, 0.24, 0.08);
        rightEar.castShadow = true;
        headGroup.add(rightEar);

        return headGroup;
      }
      case 'tail': {
        const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.32), furMat);
        tailMesh.name = 'Tail';
        tailMesh.position.set(0, -0.02, -0.14);
        tailMesh.castShadow = true;
        return tailMesh;
      }
      case 'front_leg_l':
      case 'front_leg_r':
      case 'rear_leg_l':
      case 'rear_leg_r': {
        const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.12), furMat);
        legMesh.position.set(0, -0.2, 0);
        legMesh.castShadow = true;
        return legMesh;
      }
      default:
        return null;
    }
  }

  public createAnimationClips(): Map<string, THREE.AnimationClip> {
    if (this.clipsCache) return this.clipsCache;

    const fps = 30;
    const duration = 0.6;
    const frames = fps * duration;
    const times: number[] = [];
    const torsoP: number[] = [];
    const torsoQ: number[] = [];
    const headQ: number[] = [];
    const tailQ: number[] = [];
    const fllP: number[] = [];
    const frlP: number[] = [];
    const bllP: number[] = [];
    const brlP: number[] = [];
    const idQ = [0, 0, 0, 1];
    const getQuat = AnimationTrackBuilder.eulerToQuat;

    for (let i = 0; i <= frames; i++) {
      const t = (i / frames) * duration;
      times.push(t);
      const cycle = (i / frames) * Math.PI * 2;

      const breatheY = Math.sin(cycle) * 0.008;
      torsoP.push(0, 0.48 + breatheY, 0);
      torsoQ.push(...idQ);
      headQ.push(...idQ);

      const tailWag = Math.sin(cycle * 2) * 0.24;
      tailQ.push(...getQuat(-0.7, tailWag, 0));

      fllP.push(0.16, 0.4, 0.22);
      frlP.push(-0.16, 0.4, 0.22);
      bllP.push(0.16, 0.4, -0.22);
      brlP.push(-0.16, 0.4, -0.22);
    }

    const legTrackTimes = [0.0, duration];
    const legTrackQ = [...idQ, ...idQ];

    const dogIdleClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', times, torsoP)
      .addQuatTrack('Torso', times, torsoQ)
      .addPosTrack('HeadPivot', [0.0, duration], [0, 0.18, 0.3, 0, 0.18, 0.3])
      .addQuatTrack('HeadPivot', times, headQ)
      .addQuatTrack('TailPivot', times, tailQ)
      .addPosTrack('FrontLeftLegPivot', times, fllP)
      .addQuatTrack('FrontLeftLegPivot', legTrackTimes, legTrackQ)
      .addPosTrack('FrontRightLegPivot', times, frlP)
      .addQuatTrack('FrontRightLegPivot', legTrackTimes, legTrackQ)
      .addPosTrack('BackLeftLegPivot', times, bllP)
      .addQuatTrack('BackLeftLegPivot', legTrackTimes, legTrackQ)
      .addPosTrack('BackRightLegPivot', times, brlP)
      .addQuatTrack('BackRightLegPivot', legTrackTimes, legTrackQ)
      .build('stand_idle', duration);

    // --- Параметрический генератор локомоции собаки ---
    const createDogWalkCycleClip = (
      name: string,
      cycleDuration: number,
      swingAmount: number,
      bounceAmount: number,
      torsoXRot = 0,
      headPosY = 0.18,
      headPosZ = 0.3
    ) => {
      const cycleFrames = Math.max(2, Math.round(fps * cycleDuration));
      const cycleTimes: number[] = [];
      const cTorsoP: number[] = [];
      const cTorsoQ: number[] = [];
      const cHeadP: number[] = [];
      const cHeadQ: number[] = [];
      const cTailQ: number[] = [];
      const cFllP: number[] = [];
      const cFrlP: number[] = [];
      const cBllP: number[] = [];
      const cBrlP: number[] = [];
      const cPair1Q: number[] = [];
      const cPair2Q: number[] = [];

      for (let i = 0; i <= cycleFrames; i++) {
        const progress = i / cycleFrames;
        const time = progress * cycleDuration;
        cycleTimes.push(time);
        const cycle = progress * Math.PI * 2;

        const swing = Math.sin(cycle) * swingAmount;
        const bounce = bounceAmount > 0 ? Math.pow(Math.sin(cycle), 2) * bounceAmount : 0;

        cTorsoP.push(0, 0.48 + bounce, 0);
        cTorsoQ.push(...getQuat(torsoXRot, 0, 0));
        cHeadP.push(0, headPosY, headPosZ);
        cHeadQ.push(...getQuat(-torsoXRot, 0, 0));

        cTailQ.push(...getQuat(-0.75 + bounce * 1.5, Math.sin(cycle) * 0.18, 0));

        cFllP.push(0.16, 0.4 + bounce, 0.22);
        cFrlP.push(-0.16, 0.4 + bounce, 0.22);
        cBllP.push(0.16, 0.4 + bounce, -0.22);
        cBrlP.push(-0.16, 0.4 + bounce, -0.22);

        cPair1Q.push(...getQuat(swing, 0, 0));
        cPair2Q.push(...getQuat(-swing, 0, 0));
      }

      return new AnimationTrackBuilder()
        .addPosTrack('Torso', cycleTimes, cTorsoP)
        .addQuatTrack('Torso', cycleTimes, cTorsoQ)
        .addPosTrack('HeadPivot', cycleTimes, cHeadP)
        .addQuatTrack('HeadPivot', cycleTimes, cHeadQ)
        .addQuatTrack('TailPivot', cycleTimes, cTailQ)
        .addPosTrack('FrontLeftLegPivot', cycleTimes, cFllP)
        .addQuatTrack('FrontLeftLegPivot', cycleTimes, cPair1Q)
        .addPosTrack('BackRightLegPivot', cycleTimes, cBrlP)
        .addQuatTrack('BackRightLegPivot', cycleTimes, cPair1Q)
        .addPosTrack('FrontRightLegPivot', cycleTimes, cFrlP)
        .addQuatTrack('FrontRightLegPivot', cycleTimes, cPair2Q)
        .addPosTrack('BackLeftLegPivot', cycleTimes, cBllP)
        .addQuatTrack('BackLeftLegPivot', cycleTimes, cPair2Q)
        .build(name, cycleDuration);
    };

    const dogJoggingClip = createDogWalkCycleClip('stand_jog', 0.5, 0.7, 0.07, 0, 0.18, 0.3);
    const dogWalkClip = createDogWalkCycleClip('stand_walk', 0.8, 0.4, 0.03, 0, 0.18, 0.3);
    const dogSprintClip = createDogWalkCycleClip('stand_sprint', 0.35, 1.1, 0.03, 0, 0.11, 0.34);

    // Атака пастью
    const attackTimes = [0.0, 0.1, 0.22, 0.35];
    const attackClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', attackTimes, [0, 0.48, 0, 0, 0.46, -0.04, 0, 0.52, 0.08, 0, 0.48, 0])
      .addQuatTrack(
        'HeadPivot',
        attackTimes,
        [0, 0, 0, 1, -0.2, 0, 0, 0.98, 0.3, 0, 0, 0.95, 0, 0, 0, 1]
      )
      .build('attack', 0.35);

    // Смерть собаки
    const deadTimes = [0.0, 0.3, 0.6];
    const deadClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', deadTimes, [0, 0.48, 0, 0, 0.3, 0, 0, 0.15, 0])
      .addQuatTrack('Torso', deadTimes, [0, 0, 0, 1, 0, 0, -0.5, 0.86, 0, 0, -0.707, 0.707])
      .build('dead', 0.6);

    // Подбор мяча/палки пастью
    const pickupTimes = [0.0, 0.18, 0.35, 0.48, 0.65];
    const dogPickupClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        pickupTimes,
        [0, 0.48, 0, 0, 0.44, 0.03, 0, 0.4, 0.05, 0, 0.45, 0.02, 0, 0.48, 0]
      )
      .addQuatTrack('Torso', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.12, 0, 0),
        ...getQuat(0.22, 0, 0),
        ...getQuat(0.1, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack(
        'HeadPivot',
        pickupTimes,
        [0, 0.18, 0.3, 0, 0.1, 0.34, 0, 0.02, 0.38, 0, 0.14, 0.33, 0, 0.18, 0.3]
      )
      .addQuatTrack('HeadPivot', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.35, 0, 0),
        ...getQuat(0.68, 0, 0),
        ...getQuat(0.22, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('TailPivot', pickupTimes, [
        ...getQuat(-0.7, 0, 0),
        ...getQuat(-0.4, 0.18, 0),
        ...getQuat(-0.3, -0.18, 0),
        ...getQuat(-0.5, 0.12, 0),
        ...getQuat(-0.7, 0, 0),
      ])
      .addPosTrack(
        'FrontLeftLegPivot',
        pickupTimes,
        [0.16, 0.4, 0.22, 0.16, 0.38, 0.23, 0.16, 0.35, 0.25, 0.16, 0.38, 0.23, 0.16, 0.4, 0.22]
      )
      .addQuatTrack('FrontLeftLegPivot', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.12, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(-0.1, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack(
        'FrontRightLegPivot',
        pickupTimes,
        [
          -0.16, 0.4, 0.22, -0.16, 0.38, 0.23, -0.16, 0.35, 0.25, -0.16, 0.38, 0.23, -0.16, 0.4,
          0.22,
        ]
      )
      .addQuatTrack('FrontRightLegPivot', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.12, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(-0.1, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack(
        'BackLeftLegPivot',
        pickupTimes,
        [0.16, 0.4, -0.22, 0.16, 0.4, -0.22, 0.16, 0.4, -0.22, 0.16, 0.4, -0.22, 0.16, 0.4, -0.22]
      )
      .addQuatTrack('BackLeftLegPivot', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.08, 0, 0),
        ...getQuat(0.15, 0, 0),
        ...getQuat(0.06, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack(
        'BackRightLegPivot',
        pickupTimes,
        [
          -0.16, 0.4, -0.22, -0.16, 0.4, -0.22, -0.16, 0.4, -0.22, -0.16, 0.4, -0.22, -0.16, 0.4,
          -0.22,
        ]
      )
      .addQuatTrack('BackRightLegPivot', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.08, 0, 0),
        ...getQuat(0.15, 0, 0),
        ...getQuat(0.06, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .build('pickup_jaws', 0.65);

    // Сброс мяча/палки пастью
    const dropTimes = [0.0, 0.12, 0.24, 0.38];
    const dogDropClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', dropTimes, [0, 0.48, 0, 0, 0.46, 0.02, 0, 0.44, 0.03, 0, 0.48, 0])
      .addQuatTrack('Torso', dropTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.08, 0, 0),
        ...getQuat(0.14, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack(
        'HeadPivot',
        dropTimes,
        [0, 0.18, 0.3, 0, 0.11, 0.33, 0, 0.06, 0.36, 0, 0.18, 0.3]
      )
      .addQuatTrack('HeadPivot', dropTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.28, 0, 0),
        ...getQuat(0.52, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('TailPivot', dropTimes, [
        ...getQuat(-0.7, 0, 0),
        ...getQuat(-0.55, 0.1, 0),
        ...getQuat(-0.5, -0.1, 0),
        ...getQuat(-0.7, 0, 0),
      ])
      .addPosTrack('FrontLeftLegPivot', [0.0, 0.38], [0.16, 0.4, 0.22, 0.16, 0.4, 0.22])
      .addQuatTrack('FrontLeftLegPivot', [0.0, 0.38], [...idQ, ...idQ])
      .addPosTrack('FrontRightLegPivot', [0.0, 0.38], [-0.16, 0.4, 0.22, -0.16, 0.4, 0.22])
      .addQuatTrack('FrontRightLegPivot', [0.0, 0.38], [...idQ, ...idQ])
      .addPosTrack('BackLeftLegPivot', [0.0, 0.38], [0.16, 0.4, -0.22, 0.16, 0.4, -0.22])
      .addQuatTrack('BackLeftLegPivot', [0.0, 0.38], [...idQ, ...idQ])
      .addPosTrack('BackRightLegPivot', [0.0, 0.38], [-0.16, 0.4, -0.22, -0.16, 0.4, -0.22])
      .addQuatTrack('BackRightLegPivot', [0.0, 0.38], [...idQ, ...idQ])
      .build('drop_item_jaws', 0.38);

    // Прыжок и свободный полет собаки (Airborne)
    const durationDogAirborne = 0.8;
    const dogAirFrames = fps * durationDogAirborne;
    const dogAirTimes: number[] = [];
    const dogAirTorsoP: number[] = [];
    const dogAirTorsoQ: number[] = [];
    const dogAirTailQ: number[] = [];
    const dogAirFllP: number[] = [];
    const dogAirFrlP: number[] = [];
    const dogAirBllP: number[] = [];
    const dogAirBrlP: number[] = [];
    const dogAirFllQ: number[] = [];
    const dogAirFrlQ: number[] = [];
    const dogAirBllQ: number[] = [];
    const dogAirBrlQ: number[] = [];

    for (let i = 0; i <= dogAirFrames; i++) {
      const time = (i / dogAirFrames) * durationDogAirborne;
      dogAirTimes.push(time);
      const cycle = (i / dogAirFrames) * Math.PI * 2;
      const floatY = Math.sin(cycle) * 0.01;

      dogAirTorsoP.push(0, 0.48 + floatY, 0);
      dogAirTorsoQ.push(...idQ);
      dogAirTailQ.push(...getQuat(-0.5 + Math.sin(cycle) * 0.1, 0, 0));

      dogAirFllP.push(0.16, 0.4, 0.22);
      dogAirFrlP.push(-0.16, 0.4, 0.22);
      dogAirBllP.push(0.16, 0.4, -0.22);
      dogAirBrlP.push(-0.16, 0.4, -0.22);

      const drift = Math.sin(cycle) * 0.05;
      dogAirFllQ.push(...getQuat(drift, 0, 0.1));
      dogAirFrlQ.push(...getQuat(-drift, 0, -0.1));
      dogAirBllQ.push(...getQuat(-drift, 0, 0.1));
      dogAirBrlQ.push(...getQuat(drift, 0, -0.1));
    }

    const dogAirborneClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', dogAirTimes, dogAirTorsoP)
      .addQuatTrack('Torso', dogAirTimes, dogAirTorsoQ)
      .addPosTrack('HeadPivot', [0.0, durationDogAirborne], [0, 0.18, 0.3, 0, 0.18, 0.3])
      .addQuatTrack('HeadPivot', [0.0, durationDogAirborne], [...idQ, ...idQ])
      .addQuatTrack('TailPivot', dogAirTimes, dogAirTailQ)
      .addPosTrack('FrontLeftLegPivot', dogAirTimes, dogAirFllP)
      .addQuatTrack('FrontLeftLegPivot', dogAirTimes, dogAirFllQ)
      .addPosTrack('FrontRightLegPivot', dogAirTimes, dogAirFrlP)
      .addQuatTrack('FrontRightLegPivot', dogAirTimes, dogAirFrlQ)
      .addPosTrack('BackLeftLegPivot', dogAirTimes, dogAirBllP)
      .addQuatTrack('BackLeftLegPivot', dogAirTimes, dogAirBllQ)
      .addPosTrack('BackRightLegPivot', dogAirTimes, dogAirBrlP)
      .addQuatTrack('BackRightLegPivot', dogAirTimes, dogAirBrlQ)
      .build('airborne', durationDogAirborne);

    const map = new Map<string, THREE.AnimationClip>();
    map.set('stand_idle', dogIdleClip);
    map.set('stand_walk', dogWalkClip);
    map.set('stand_jog', dogJoggingClip);
    map.set('stand_sprint', dogSprintClip);
    map.set('attack', attackClip);
    map.set('pickup', dogPickupClip);
    map.set('pickup_jaws', dogPickupClip);
    map.set('drop_item', dogDropClip);
    map.set('drop_item_jaws', dogDropClip);
    map.set('dead', deadClip);
    map.set('airborne', dogAirborneClip);

    this.clipsCache = map;
    return map;
  }
}
