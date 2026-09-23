import * as THREE from 'three';
import { IProceduralBuilder } from './IProceduralBuilder';

export class QuadrupedProceduralBuilder implements IProceduralBuilder {
  private clipsCache: Map<string, THREE.AnimationClip> | null = null;

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
    frontLeftLegPivot.position.set(-0.16, 0.4, 0.22);
    root.add(frontLeftLegPivot);

    const frontRightLegPivot = new THREE.Group();
    frontRightLegPivot.name = 'FrontRightLegPivot';
    frontRightLegPivot.position.set(0.16, 0.4, 0.22);
    root.add(frontRightLegPivot);

    const backLeftLegPivot = new THREE.Group();
    backLeftLegPivot.name = 'BackLeftLegPivot';
    backLeftLegPivot.position.set(-0.16, 0.4, -0.22);
    root.add(backLeftLegPivot);

    const backRightLegPivot = new THREE.Group();
    backRightLegPivot.name = 'BackRightLegPivot';
    backRightLegPivot.position.set(0.16, 0.4, -0.22);
    root.add(backRightLegPivot);

    return root;
  }

  public createPartMesh(partKey: string): THREE.Object3D | null {
    const furMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.6 });
    const chestFurMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.6 });
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 });

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
        leftEye.position.set(-0.11, 0.08, 0.25);
        headGroup.add(leftEye);

        const rightEye = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.02), eyeMat);
        rightEye.position.set(0.11, 0.08, 0.25);
        headGroup.add(rightEye);

        const leftEar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), furMat);
        leftEar.position.set(-0.1, 0.24, 0.08);
        leftEar.castShadow = true;
        headGroup.add(leftEar);

        const rightEar = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.05), furMat);
        rightEar.position.set(0.1, 0.24, 0.08);
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
    const euler = new THREE.Euler();
    const quat = new THREE.Quaternion();

    for (let i = 0; i <= frames; i++) {
      const t = (i / frames) * duration;
      times.push(t);
      const cycle = (i / frames) * Math.PI * 2;

      const breatheY = Math.sin(cycle) * 0.008;
      torsoP.push(0, 0.48 + breatheY, 0);
      torsoQ.push(...idQ);

      headQ.push(...idQ);

      const tailWag = Math.sin(cycle * 2) * 0.24;
      euler.set(-0.7, tailWag, 0);
      quat.setFromEuler(euler);
      tailQ.push(quat.x, quat.y, quat.z, quat.w);

      fllP.push(-0.16, 0.4, 0.22);
      frlP.push(0.16, 0.4, 0.22);
      bllP.push(-0.16, 0.4, -0.22);
      brlP.push(0.16, 0.4, -0.22);
    }

    const legTrackTimes = [0.0, duration];
    const legTrackQ = [...idQ, ...idQ];

    const dogIdleClip = new THREE.AnimationClip('stand_idle', duration, [
      new THREE.VectorKeyframeTrack('Torso.position', times, torsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', times, torsoQ),
      new THREE.VectorKeyframeTrack(
        'HeadPivot.position',
        [0.0, duration],
        [0, 0.18, 0.3, 0, 0.18, 0.3]
      ),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', times, headQ),
      new THREE.QuaternionKeyframeTrack('TailPivot.quaternion', times, tailQ),
      new THREE.VectorKeyframeTrack('FrontLeftLegPivot.position', times, fllP),
      new THREE.QuaternionKeyframeTrack('FrontLeftLegPivot.quaternion', legTrackTimes, legTrackQ),
      new THREE.VectorKeyframeTrack('FrontRightLegPivot.position', times, frlP),
      new THREE.QuaternionKeyframeTrack('FrontRightLegPivot.quaternion', legTrackTimes, legTrackQ),
      new THREE.VectorKeyframeTrack('BackLeftLegPivot.position', times, bllP),
      new THREE.QuaternionKeyframeTrack('BackLeftLegPivot.quaternion', legTrackTimes, legTrackQ),
      new THREE.VectorKeyframeTrack('BackRightLegPivot.position', times, brlP),
      new THREE.QuaternionKeyframeTrack('BackRightLegPivot.quaternion', legTrackTimes, legTrackQ),
    ]);

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

        euler.set(torsoXRot, 0, 0);
        quat.setFromEuler(euler);
        cTorsoQ.push(quat.x, quat.y, quat.z, quat.w);

        cHeadP.push(0, headPosY, headPosZ);

        euler.set(-torsoXRot, 0, 0);
        quat.setFromEuler(euler);
        cHeadQ.push(quat.x, quat.y, quat.z, quat.w);

        euler.set(-0.75 + bounce * 1.5, Math.sin(cycle) * 0.18, 0);
        quat.setFromEuler(euler);
        cTailQ.push(quat.x, quat.y, quat.z, quat.w);

        cFllP.push(-0.16, 0.4 + bounce, 0.22);
        cFrlP.push(0.16, 0.4 + bounce, 0.22);
        cBllP.push(-0.16, 0.4 + bounce, -0.22);
        cBrlP.push(0.16, 0.4 + bounce, -0.22);

        euler.set(swing, 0, 0);
        quat.setFromEuler(euler);
        cPair1Q.push(quat.x, quat.y, quat.z, quat.w);

        euler.set(-swing, 0, 0);
        quat.setFromEuler(euler);
        cPair2Q.push(quat.x, quat.y, quat.z, quat.w);
      }

      return new THREE.AnimationClip(name, cycleDuration, [
        new THREE.VectorKeyframeTrack('Torso.position', cycleTimes, cTorsoP),
        new THREE.QuaternionKeyframeTrack('Torso.quaternion', cycleTimes, cTorsoQ),
        new THREE.VectorKeyframeTrack('HeadPivot.position', cycleTimes, cHeadP),
        new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', cycleTimes, cHeadQ),
        new THREE.QuaternionKeyframeTrack('TailPivot.quaternion', cycleTimes, cTailQ),
        new THREE.VectorKeyframeTrack('FrontLeftLegPivot.position', cycleTimes, cFllP),
        new THREE.QuaternionKeyframeTrack('FrontLeftLegPivot.quaternion', cycleTimes, cPair1Q),
        new THREE.VectorKeyframeTrack('BackRightLegPivot.position', cycleTimes, cBrlP),
        new THREE.QuaternionKeyframeTrack('BackRightLegPivot.quaternion', cycleTimes, cPair1Q),
        new THREE.VectorKeyframeTrack('FrontRightLegPivot.position', cycleTimes, cFrlP),
        new THREE.QuaternionKeyframeTrack('FrontRightLegPivot.quaternion', cycleTimes, cPair2Q),
        new THREE.VectorKeyframeTrack('BackLeftLegPivot.position', cycleTimes, cBllP),
        new THREE.QuaternionKeyframeTrack('BackLeftLegPivot.quaternion', cycleTimes, cPair2Q),
      ]);
    };

    const dogJoggingClip = createDogWalkCycleClip('stand_jog', 0.5, 0.7, 0.07, 0, 0.18, 0.3);
    const dogWalkClip = createDogWalkCycleClip('stand_walk', 0.8, 0.4, 0.03, 0, 0.18, 0.3);
    const dogSprintClip = createDogWalkCycleClip('stand_sprint', 0.35, 1.1, 0.03, 0, 0.11, 0.34);

    const attackTimes = [0.0, 0.1, 0.22, 0.35];
    const attackClip = new THREE.AnimationClip('attack', 0.35, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        attackTimes,
        [0, 0.48, 0, 0, 0.46, -0.04, 0, 0.52, 0.08, 0, 0.48, 0]
      ),
      new THREE.QuaternionKeyframeTrack(
        'HeadPivot.quaternion',
        attackTimes,
        [0, 0, 0, 1, -0.2, 0, 0, 0.98, 0.3, 0, 0, 0.95, 0, 0, 0, 1]
      ),
    ]);

    const deadTimes = [0.0, 0.3, 0.6];
    const deadClip = new THREE.AnimationClip('dead', 0.6, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        deadTimes,
        [0, 0.48, 0, 0, 0.3, 0, 0, 0.15, 0]
      ),
      new THREE.QuaternionKeyframeTrack(
        'Torso.quaternion',
        deadTimes,
        [0, 0, 0, 1, 0, 0, -0.5, 0.86, 0, 0, -0.707, 0.707]
      ),
    ]);

    // --- Анимация нахождения в воздухе для четвероногого (airborne) ---
    const durationDogAirborne = 0.8;
    const dogAirFrames = fps * durationDogAirborne;
    const dogAirTimes: number[] = [];
    const dogAirTorsoP: number[] = [];
    const dogAirTorsoQ: number[] = [];
    const dogAirHeadQ: number[] = [];
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

      // Голова держится прямо вперед
      dogAirHeadQ.push(...idQ);

      // Хвост приподнят и мягко покачивается для баланса
      euler.set(-0.5 + Math.sin(cycle) * 0.1, 0, 0);
      quat.setFromEuler(euler);
      dogAirTailQ.push(quat.x, quat.y, quat.z, quat.w);

      dogAirFllP.push(-0.16, 0.4, 0.22);
      dogAirFrlP.push(0.16, 0.4, 0.22);
      dogAirBllP.push(-0.16, 0.4, -0.22);
      dogAirBrlP.push(0.16, 0.4, -0.22);

      const drift = Math.sin(cycle) * 0.05;
      euler.set(drift, 0, -0.1);
      quat.setFromEuler(euler);
      dogAirFllQ.push(quat.x, quat.y, quat.z, quat.w);

      euler.set(-drift, 0, 0.1);
      quat.setFromEuler(euler);
      dogAirFrlQ.push(quat.x, quat.y, quat.z, quat.w);

      euler.set(-drift, 0, -0.1);
      quat.setFromEuler(euler);
      dogAirBllQ.push(quat.x, quat.y, quat.z, quat.w);

      euler.set(drift, 0, 0.1);
      quat.setFromEuler(euler);
      dogAirBrlQ.push(quat.x, quat.y, quat.z, quat.w);
    }

    const dogAirborneClip = new THREE.AnimationClip('airborne', durationDogAirborne, [
      new THREE.VectorKeyframeTrack('Torso.position', dogAirTimes, dogAirTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', dogAirTimes, dogAirTorsoQ),
      new THREE.VectorKeyframeTrack(
        'HeadPivot.position',
        [0.0, durationDogAirborne],
        [0, 0.18, 0.3, 0, 0.18, 0.3]
      ),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', dogAirTimes, dogAirHeadQ),
      new THREE.QuaternionKeyframeTrack('TailPivot.quaternion', dogAirTimes, dogAirTailQ),
      new THREE.VectorKeyframeTrack('FrontLeftLegPivot.position', dogAirTimes, dogAirFllP),
      new THREE.QuaternionKeyframeTrack('FrontLeftLegPivot.quaternion', dogAirTimes, dogAirFllQ),
      new THREE.VectorKeyframeTrack('FrontRightLegPivot.position', dogAirTimes, dogAirFrlP),
      new THREE.QuaternionKeyframeTrack('FrontRightLegPivot.quaternion', dogAirTimes, dogAirFrlQ),
      new THREE.VectorKeyframeTrack('BackLeftLegPivot.position', dogAirTimes, dogAirBllP),
      new THREE.QuaternionKeyframeTrack('BackLeftLegPivot.quaternion', dogAirTimes, dogAirBllQ),
      new THREE.VectorKeyframeTrack('BackRightLegPivot.position', dogAirTimes, dogAirBrlP),
      new THREE.QuaternionKeyframeTrack('BackRightLegPivot.quaternion', dogAirTimes, dogAirBrlQ),
    ]);

    const map = new Map<string, THREE.AnimationClip>();
    map.set('stand_idle', dogIdleClip);
    map.set('stand_walk', dogWalkClip);
    map.set('stand_jog', dogJoggingClip);
    map.set('stand_sprint', dogSprintClip);
    map.set('attack', attackClip);
    map.set('dead', deadClip);
    map.set('airborne', dogAirborneClip);

    this.clipsCache = map;
    return map;
  }
}
