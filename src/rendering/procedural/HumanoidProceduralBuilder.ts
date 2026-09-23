import * as THREE from 'three';
import { IProceduralBuilder } from './IProceduralBuilder';

export class HumanoidProceduralBuilder implements IProceduralBuilder {
  private clipsCache: Map<string, THREE.AnimationClip> | null = null;

  public createRigTemplate(): THREE.Group {
    const root = new THREE.Group();
    root.name = 'CharacterRoot';

    const torso = new THREE.Group();
    torso.name = 'Torso';
    torso.position.set(0, 1.1, 0);
    root.add(torso);

    const headPivot = new THREE.Group();
    headPivot.name = 'HeadPivot';
    headPivot.position.set(0, 0.35, 0);
    torso.add(headPivot);

    const rightArmPivot = new THREE.Group();
    rightArmPivot.name = 'RightArmPivot';
    rightArmPivot.position.set(0.35, 0.25, 0);
    const rightHandSocket = new THREE.Group();
    rightHandSocket.name = 'RightHandSocket';
    rightHandSocket.position.set(0, -0.6, 0);
    rightArmPivot.add(rightHandSocket);
    torso.add(rightArmPivot);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.name = 'LeftArmPivot';
    leftArmPivot.position.set(-0.35, 0.25, 0);
    const leftHandSocket = new THREE.Group();
    leftHandSocket.name = 'LeftHandSocket';
    leftHandSocket.position.set(0, -0.6, 0);
    leftArmPivot.add(leftHandSocket);
    torso.add(leftArmPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.name = 'RightLegPivot';
    rightLegPivot.position.set(0.15, 0.65, 0);
    root.add(rightLegPivot);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.name = 'LeftLegPivot';
    leftLegPivot.position.set(-0.15, 0.65, 0);
    root.add(leftLegPivot);

    return root;
  }

  public createPartMesh(partKey: string): THREE.Object3D | null {
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
    const pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xfdfeee, roughness: 0.5 });

    switch (partKey) {
      case 'torso': {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.25), bodyMat);
        mesh.name = 'TorsoMesh';
        mesh.castShadow = true;
        return mesh;
      }
      case 'head': {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;

        ctx.fillStyle = '#fdfeee';
        ctx.fillRect(0, 0, 128, 128);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(32, 45, 16, 20);
        ctx.fillRect(80, 45, 16, 20);

        ctx.fillStyle = '#1e293b';
        ctx.fillRect(48, 90, 32, 10);

        const faceTexture = new THREE.CanvasTexture(canvas);
        faceTexture.colorSpace = THREE.SRGBColorSpace;

        const faceMat = new THREE.MeshStandardMaterial({ map: faceTexture, roughness: 0.5 });
        const headMaterials = [skinMat, skinMat, skinMat, skinMat, faceMat, skinMat];

        const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), headMaterials);
        head.name = 'Head';
        head.position.y = 0.22;
        head.castShadow = true;
        return head;
      }
      case 'arm_l': {
        const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), bodyMat);
        leftArm.name = 'LeftArm';
        leftArm.position.y = -0.3;
        leftArm.castShadow = true;
        return leftArm;
      }
      case 'arm_r': {
        const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.18), bodyMat);
        rightArm.name = 'RightArm';
        rightArm.position.y = -0.3;
        rightArm.castShadow = true;
        return rightArm;
      }
      case 'leg_l': {
        const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), pantsMat);
        leftLeg.name = 'LeftLeg';
        leftLeg.position.y = -0.35;
        leftLeg.castShadow = true;
        return leftLeg;
      }
      case 'leg_r': {
        const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.8, 0.2), pantsMat);
        rightLeg.name = 'RightLeg';
        rightLeg.position.y = -0.35;
        rightLeg.castShadow = true;
        return rightLeg;
      }
      default:
        return null;
    }
  }

  public createAnimationClips(): Map<string, THREE.AnimationClip> {
    if (this.clipsCache) return this.clipsCache;

    const fps = 30;
    const euler = new THREE.Euler();
    const quat = new THREE.Quaternion();

    const torsoHalfHeight = 0.35;
    const torsoBaseBottomY = 0.75;
    const idQ = [0, 0, 0, 1];

    const getQuat = (x: number, y = 0, z = 0) => {
      euler.set(x, y, z);
      quat.setFromEuler(euler);
      return [quat.x, quat.y, quat.z, quat.w];
    };

    const createWalkCycleClip = (
      name: string,
      duration: number,
      swingAmount: number,
      bounceAmount: number,
      torsoXRot: number = 0
    ) => {
      const frames = Math.max(2, Math.round(fps * duration));
      const times: number[] = [];
      const lLegQ: number[] = [];
      const rLegQ: number[] = [];
      const lArmQ: number[] = [];
      const rArmQ: number[] = [];
      const torsoP: number[] = [];
      const torsoQ: number[] = [];
      const lLegP: number[] = [];
      const rLegP: number[] = [];
      const headQ: number[] = [];

      // Ноги стоят прямо на нормальной высоте таза (0.65) без проседания
      const legBaseY = 0.65;

      // Высота туловища опирается на прямые ноги с учётом тригонометрии наклона
      const fixedTorsoPosY = torsoBaseBottomY + torsoHalfHeight * Math.cos(torsoXRot);
      const fixedTorsoPosZ = torsoHalfHeight * Math.sin(torsoXRot);

      euler.set(torsoXRot, 0, 0);
      quat.setFromEuler(euler);
      const fixedTorsoQuat = [quat.x, quat.y, quat.z, quat.w];

      euler.set(-torsoXRot, 0, 0);
      quat.setFromEuler(euler);
      const fixedHeadQuat = [quat.x, quat.y, quat.z, quat.w];

      for (let i = 0; i <= frames; i++) {
        const progress = i / frames;
        const time = progress * duration;
        const cycle = progress * Math.PI * 2;
        times.push(time);

        const swing = Math.sin(cycle) * swingAmount;
        const bounce = bounceAmount > 0 ? Math.pow(Math.sin(cycle), 2) * bounceAmount : 0;

        lLegP.push(-0.15, legBaseY + bounce, 0);
        rLegP.push(0.15, legBaseY + bounce, 0);

        euler.set(swing, 0, 0);
        quat.setFromEuler(euler);
        lLegQ.push(quat.x, quat.y, quat.z, quat.w);

        euler.set(-swing, 0, 0);
        quat.setFromEuler(euler);
        rLegQ.push(quat.x, quat.y, quat.z, quat.w);

        euler.set(-swing * 0.9, 0, 0);
        quat.setFromEuler(euler);
        lArmQ.push(quat.x, quat.y, quat.z, quat.w);

        euler.set(swing * 0.9, 0, 0);
        quat.setFromEuler(euler);
        rArmQ.push(quat.x, quat.y, quat.z, quat.w);

        torsoP.push(0, fixedTorsoPosY + bounce, fixedTorsoPosZ);
        torsoQ.push(...fixedTorsoQuat);
        headQ.push(...fixedHeadQuat);
      }

      return new THREE.AnimationClip(name, duration, [
        new THREE.VectorKeyframeTrack('LeftLegPivot.position', times, lLegP),
        new THREE.VectorKeyframeTrack('RightLegPivot.position', times, rLegP),
        new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', times, lLegQ),
        new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', times, rLegQ),
        new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', times, lArmQ),
        new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', times, rArmQ),
        new THREE.VectorKeyframeTrack('Torso.position', times, torsoP),
        new THREE.QuaternionKeyframeTrack('Torso.quaternion', times, torsoQ),
        new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', times, headQ),
      ]);
    };

    const joggingClip = createWalkCycleClip('stand_jog', 0.5, 0.7, 0.07, 0);
    const walkClip = createWalkCycleClip('stand_walk', 0.8, 0.4, 0.02, 0);
    const sprintClip = createWalkCycleClip('stand_sprint', 0.35, 1.1, 0.03, 0);

    const durationIdle = 2.0;
    const idleFrames = fps * durationIdle;

    const createIdleVariant = (name: string, torsoXRot: number) => {
      const times: number[] = [];
      const torsoP: number[] = [];
      const torsoQ: number[] = [];
      const headQ: number[] = [];
      const lLegQ: number[] = [];
      const rLegQ: number[] = [];
      const lArmQ: number[] = [];
      const rArmQ: number[] = [];
      const lLegP: number[] = [];
      const rLegP: number[] = [];

      // Ноги не опускаются: высота сустава остаётся 0.65
      const legPosY = 0.65;

      const baseTorsoY = torsoBaseBottomY + torsoHalfHeight * Math.cos(torsoXRot);
      const fixedTorsoZ = torsoHalfHeight * Math.sin(torsoXRot);

      euler.set(torsoXRot, 0, 0);
      quat.setFromEuler(euler);
      const tQ = [quat.x, quat.y, quat.z, quat.w];

      euler.set(-torsoXRot, 0, 0);
      quat.setFromEuler(euler);
      const hQ = [quat.x, quat.y, quat.z, quat.w];

      const legRotQ = [...idQ];

      for (let i = 0; i <= idleFrames; i++) {
        const time = (i / idleFrames) * durationIdle;
        times.push(time);

        lLegP.push(-0.15, legPosY, 0);
        rLegP.push(0.15, legPosY, 0);

        const breathe = Math.sin((i / idleFrames) * Math.PI * 2) * 0.015;
        torsoP.push(0, baseTorsoY + breathe, fixedTorsoZ);
        torsoQ.push(...tQ);

        headQ.push(...hQ);

        lLegQ.push(...legRotQ);
        rLegQ.push(...legRotQ);
        lArmQ.push(...idQ);
        rArmQ.push(...idQ);
      }

      return new THREE.AnimationClip(name, durationIdle, [
        new THREE.VectorKeyframeTrack('LeftLegPivot.position', times, lLegP),
        new THREE.VectorKeyframeTrack('RightLegPivot.position', times, rLegP),
        new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', times, lLegQ),
        new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', times, rLegQ),
        new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', times, lArmQ),
        new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', times, rArmQ),
        new THREE.VectorKeyframeTrack('Torso.position', times, torsoP),
        new THREE.QuaternionKeyframeTrack('Torso.quaternion', times, torsoQ),
        new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', times, headQ),
      ]);
    };

    const idleClip = createIdleVariant('stand_idle', 0);
    const crouchingIdleClip = createIdleVariant('crouch_idle', 0.5);
    const crouchWalkClip = createWalkCycleClip('crouch_walk', 0.8, 0.4, 0.01, 0.45);
    const crouchJoggingClip = createWalkCycleClip('crouch_jog', 0.5, 0.7, 0.02, 0.45);
    const crouchSprintingClip = createWalkCycleClip('crouch_sprint', 0.35, 1.0, 0.03, 0.65);

    const pickupTimes = [0.0, 0.16, 0.32, 0.44, 0.58, 0.75];
    const pickupTiltDeep = 0.7;
    const pickupTiltPre = 0.35;
    const pickupTiltRec = 0.2;

    const pickupTorsoP = [
      0,
      1.1,
      0,
      0,
      torsoBaseBottomY + torsoHalfHeight * Math.cos(pickupTiltPre),
      torsoHalfHeight * Math.sin(pickupTiltPre),
      0,
      torsoBaseBottomY + torsoHalfHeight * Math.cos(pickupTiltDeep),
      torsoHalfHeight * Math.sin(pickupTiltDeep),
      0,
      torsoBaseBottomY + torsoHalfHeight * Math.cos(pickupTiltDeep),
      torsoHalfHeight * Math.sin(pickupTiltDeep),
      0,
      torsoBaseBottomY + torsoHalfHeight * Math.cos(pickupTiltRec),
      torsoHalfHeight * Math.sin(pickupTiltRec),
      0,
      1.1,
      0,
    ];
    const pickupTorsoQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(pickupTiltPre, -0.1, 0.03),
      ...getQuat(pickupTiltDeep, -0.18, 0.05),
      ...getQuat(pickupTiltDeep, -0.18, 0.05),
      ...getQuat(pickupTiltRec, -0.06, 0.02),
      ...getQuat(0, 0, 0),
    ];
    const pickupTorsoQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(pickupTiltPre, 0.1, -0.03),
      ...getQuat(pickupTiltDeep, 0.18, -0.05),
      ...getQuat(pickupTiltDeep, 0.18, -0.05),
      ...getQuat(pickupTiltRec, 0.06, -0.02),
      ...getQuat(0, 0, 0),
    ];
    const pickupHeadQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.2, 0.08, 0),
      ...getQuat(-0.35, 0.12, 0),
      ...getQuat(-0.35, 0.12, 0),
      ...getQuat(-0.15, 0.04, 0),
      ...getQuat(0, 0, 0),
    ];
    const pickupHeadQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.2, -0.08, 0),
      ...getQuat(-0.35, -0.12, 0),
      ...getQuat(-0.35, -0.12, 0),
      ...getQuat(-0.15, -0.04, 0),
      ...getQuat(0, 0, 0),
    ];
    const pickupActiveArmQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.85, 0.1, 0.12),
      ...getQuat(-1.42, 0.18, 0.25),
      ...getQuat(-1.2, -0.1, 0.15),
      ...getQuat(-0.5, -0.05, 0.1),
      ...getQuat(0, 0, 0),
    ];
    const pickupPassiveArmQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.12, -0.02, -0.08),
      ...getQuat(0.2, -0.04, -0.12),
      ...getQuat(0.2, -0.04, -0.12),
      ...getQuat(0.08, -0.02, -0.05),
      ...getQuat(0, 0, 0),
    ];
    const pickupActiveArmQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.85, -0.1, -0.12),
      ...getQuat(-1.42, -0.18, -0.25),
      ...getQuat(-1.2, 0.1, -0.15),
      ...getQuat(-0.5, 0.05, -0.1),
      ...getQuat(0, 0, 0),
    ];
    const pickupPassiveArmQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.12, 0.02, 0.08),
      ...getQuat(0.2, 0.04, 0.12),
      ...getQuat(0.2, 0.04, 0.12),
      ...getQuat(0.08, 0.02, 0.05),
      ...getQuat(0, 0, 0),
    ];
    const pickupLegTimes = [0.0, 0.75];
    const pickupLLegP = [-0.15, 0.65, 0, -0.15, 0.65, 0];
    const pickupRLegP = [0.15, 0.65, 0, 0.15, 0.65, 0];
    const pickupLegQ = [...idQ, ...idQ];

    const pickupLeftClip = new THREE.AnimationClip('pickup_left_hand', 0.75, [
      new THREE.VectorKeyframeTrack('Torso.position', pickupTimes, pickupTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', pickupTimes, pickupTorsoQLeft),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', pickupTimes, pickupHeadQLeft),
      new THREE.QuaternionKeyframeTrack(
        'LeftArmPivot.quaternion',
        pickupTimes,
        pickupActiveArmQLeft
      ),
      new THREE.QuaternionKeyframeTrack(
        'RightArmPivot.quaternion',
        pickupTimes,
        pickupPassiveArmQLeft
      ),
      new THREE.VectorKeyframeTrack('LeftLegPivot.position', pickupLegTimes, pickupLLegP),
      new THREE.VectorKeyframeTrack('RightLegPivot.position', pickupLegTimes, pickupRLegP),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', pickupLegTimes, pickupLegQ),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', pickupLegTimes, pickupLegQ),
    ]);

    const pickupRightClip = new THREE.AnimationClip('pickup_right_hand', 0.75, [
      new THREE.VectorKeyframeTrack('Torso.position', pickupTimes, pickupTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', pickupTimes, pickupTorsoQRight),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', pickupTimes, pickupHeadQRight),
      new THREE.QuaternionKeyframeTrack(
        'RightArmPivot.quaternion',
        pickupTimes,
        pickupActiveArmQRight
      ),
      new THREE.QuaternionKeyframeTrack(
        'LeftArmPivot.quaternion',
        pickupTimes,
        pickupPassiveArmQRight
      ),
      new THREE.VectorKeyframeTrack('LeftLegPivot.position', pickupLegTimes, pickupLLegP),
      new THREE.VectorKeyframeTrack('RightLegPivot.position', pickupLegTimes, pickupRLegP),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', pickupLegTimes, pickupLegQ),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', pickupLegTimes, pickupLegQ),
    ]);

    const dropItemTimes = [0.0, 0.1, 0.2, 0.32, 0.45];
    const dropItemTinyHop = 0.025;

    const dropItemTorsoP = [
      0,
      1.1,
      0,
      0,
      1.1,
      -0.01,
      0,
      1.1 + dropItemTinyHop,
      0.015,
      0,
      1.1,
      0,
      0,
      1.1,
      0,
    ];
    const dropItemTorsoQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.03, -0.05, 0),
      ...getQuat(0.06, 0.06, -0.02),
      ...getQuat(0.02, 0.02, 0),
      ...getQuat(0, 0, 0),
    ];
    const dropItemTorsoQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.03, 0.05, 0),
      ...getQuat(0.06, -0.06, 0.02),
      ...getQuat(0.02, -0.02, 0),
      ...getQuat(0, 0, 0),
    ];
    const dropItemHeadQ = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.05, 0, 0),
      ...getQuat(0.14, 0, 0),
      ...getQuat(0.04, 0, 0),
      ...getQuat(0, 0, 0),
    ];
    const dropItemActiveArmQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.3, -0.05, -0.05),
      ...getQuat(-1.2, -0.1, 0.1),
      ...getQuat(-0.4, -0.05, 0.05),
      ...getQuat(0, 0, 0),
    ];
    const dropItemPassiveArmQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(0, 0, 0.03),
      ...getQuat(0.05, 0, 0.06),
      ...getQuat(0.02, 0, 0.02),
      ...getQuat(0, 0, 0),
    ];
    const dropItemActiveArmQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.3, 0.05, 0.05),
      ...getQuat(-1.2, 0.1, -0.1),
      ...getQuat(-0.4, 0.05, -0.05),
      ...getQuat(0, 0, 0),
    ];
    const dropItemPassiveArmQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(0, 0, -0.03),
      ...getQuat(0.05, 0, -0.06),
      ...getQuat(0.02, 0, -0.02),
      ...getQuat(0, 0, 0),
    ];
    const dropItemLLegP = [
      -0.15,
      0.65,
      0,
      -0.15,
      0.65,
      -0.01,
      -0.15,
      0.65 + dropItemTinyHop,
      0.015,
      -0.15,
      0.65,
      0,
      -0.15,
      0.65,
      0,
    ];
    const dropItemRLegP = [
      0.15,
      0.65,
      0,
      0.15,
      0.65,
      -0.01,
      0.15,
      0.65 + dropItemTinyHop,
      0.015,
      0.15,
      0.65,
      0,
      0.15,
      0.65,
      0,
    ];
    const dropItemLegQ = [...idQ, ...idQ, ...idQ, ...idQ, ...idQ];

    const dropItemLeftClip = new THREE.AnimationClip('drop_item_left_hand', 0.45, [
      new THREE.VectorKeyframeTrack('Torso.position', dropItemTimes, dropItemTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', dropItemTimes, dropItemTorsoQLeft),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', dropItemTimes, dropItemHeadQ),
      new THREE.QuaternionKeyframeTrack(
        'LeftArmPivot.quaternion',
        dropItemTimes,
        dropItemActiveArmQLeft
      ),
      new THREE.QuaternionKeyframeTrack(
        'RightArmPivot.quaternion',
        dropItemTimes,
        dropItemPassiveArmQLeft
      ),
      new THREE.VectorKeyframeTrack('LeftLegPivot.position', dropItemTimes, dropItemLLegP),
      new THREE.VectorKeyframeTrack('RightLegPivot.position', dropItemTimes, dropItemRLegP),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', dropItemTimes, dropItemLegQ),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', dropItemTimes, dropItemLegQ),
    ]);

    const dropItemRightClip = new THREE.AnimationClip('drop_item_right_hand', 0.45, [
      new THREE.VectorKeyframeTrack('Torso.position', dropItemTimes, dropItemTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', dropItemTimes, dropItemTorsoQRight),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', dropItemTimes, dropItemHeadQ),
      new THREE.QuaternionKeyframeTrack(
        'RightArmPivot.quaternion',
        dropItemTimes,
        dropItemActiveArmQRight
      ),
      new THREE.QuaternionKeyframeTrack(
        'LeftArmPivot.quaternion',
        dropItemTimes,
        dropItemPassiveArmQRight
      ),
      new THREE.VectorKeyframeTrack('LeftLegPivot.position', dropItemTimes, dropItemLLegP),
      new THREE.VectorKeyframeTrack('RightLegPivot.position', dropItemTimes, dropItemRLegP),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', dropItemTimes, dropItemLegQ),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', dropItemTimes, dropItemLegQ),
    ]);

    // --- Анимация сильного броска вдаль (throw_item) ---
    const throwItemTimes = [0.0, 0.14, 0.26, 0.38, 0.55];
    const throwItemTorsoP = [0, 1.1, 0, 0, 1.09, -0.02, 0, 1.13, 0.03, 0, 1.11, 0.01, 0, 1.1, 0];

    const throwItemTorsoQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.12, -0.15, 0.04), // Замах назад с поворотом корпуса
      ...getQuat(0.2, 0.16, -0.05), // Мощный бросок вперед с доворотом
      ...getQuat(0.06, 0.04, -0.01),
      ...getQuat(0, 0, 0),
    ];
    const throwItemTorsoQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.12, 0.15, -0.04),
      ...getQuat(0.2, -0.16, 0.05),
      ...getQuat(0.06, -0.04, 0.01),
      ...getQuat(0, 0, 0),
    ];

    const throwItemHeadQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.1, 0.1, 0),
      ...getQuat(0.16, -0.08, 0),
      ...getQuat(0.05, 0, 0),
      ...getQuat(0, 0, 0),
    ];
    const throwItemHeadQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.1, -0.1, 0),
      ...getQuat(0.16, 0.08, 0),
      ...getQuat(0.05, 0, 0),
      ...getQuat(0, 0, 0),
    ];

    // Активная рука отводится далеко назад (+0.75) и выбрасывается далеко вперед (-1.85)
    const throwItemActiveArmQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.75, -0.12, -0.25),
      ...getQuat(-1.85, -0.15, 0.22),
      ...getQuat(-0.7, -0.05, 0.08),
      ...getQuat(0, 0, 0),
    ];
    const throwItemPassiveArmQLeft = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.5, 0.1, 0.15), // Противовес для баланса
      ...getQuat(0.35, -0.05, -0.1),
      ...getQuat(0.1, 0, -0.02),
      ...getQuat(0, 0, 0),
    ];

    const throwItemActiveArmQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.75, 0.12, 0.25),
      ...getQuat(-1.85, 0.15, -0.22),
      ...getQuat(-0.7, 0.05, -0.08),
      ...getQuat(0, 0, 0),
    ];
    const throwItemPassiveArmQRight = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.5, -0.1, -0.15),
      ...getQuat(0.35, 0.05, 0.1),
      ...getQuat(0.1, 0, 0.02),
      ...getQuat(0, 0, 0),
    ];

    const throwItemLLegP = [
      -0.15, 0.65, 0, -0.15, 0.65, -0.02, -0.15, 0.67, 0.04, -0.15, 0.65, 0.01, -0.15, 0.65, 0,
    ];
    const throwItemRLegP = [
      0.15, 0.65, 0, 0.15, 0.65, -0.02, 0.15, 0.67, 0.04, 0.15, 0.65, 0.01, 0.15, 0.65, 0,
    ];
    const throwItemLegQ = [...idQ, ...idQ, ...idQ, ...idQ, ...idQ];

    const throwItemLeftClip = new THREE.AnimationClip('throw_item_left_hand', 0.55, [
      new THREE.VectorKeyframeTrack('Torso.position', throwItemTimes, throwItemTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', throwItemTimes, throwItemTorsoQLeft),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', throwItemTimes, throwItemHeadQLeft),
      new THREE.QuaternionKeyframeTrack(
        'LeftArmPivot.quaternion',
        throwItemTimes,
        throwItemActiveArmQLeft
      ),
      new THREE.QuaternionKeyframeTrack(
        'RightArmPivot.quaternion',
        throwItemTimes,
        throwItemPassiveArmQLeft
      ),
      new THREE.VectorKeyframeTrack('LeftLegPivot.position', throwItemTimes, throwItemLLegP),
      new THREE.VectorKeyframeTrack('RightLegPivot.position', throwItemTimes, throwItemRLegP),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', throwItemTimes, throwItemLegQ),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', throwItemTimes, throwItemLegQ),
    ]);

    const throwItemRightClip = new THREE.AnimationClip('throw_item_right_hand', 0.55, [
      new THREE.VectorKeyframeTrack('Torso.position', throwItemTimes, throwItemTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', throwItemTimes, throwItemTorsoQRight),
      new THREE.QuaternionKeyframeTrack(
        'HeadPivot.quaternion',
        throwItemTimes,
        throwItemHeadQRight
      ),
      new THREE.QuaternionKeyframeTrack(
        'RightArmPivot.quaternion',
        throwItemTimes,
        throwItemActiveArmQRight
      ),
      new THREE.QuaternionKeyframeTrack(
        'LeftArmPivot.quaternion',
        throwItemTimes,
        throwItemPassiveArmQRight
      ),
      new THREE.VectorKeyframeTrack('LeftLegPivot.position', throwItemTimes, throwItemLLegP),
      new THREE.VectorKeyframeTrack('RightLegPivot.position', throwItemTimes, throwItemRLegP),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', throwItemTimes, throwItemLegQ),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', throwItemTimes, throwItemLegQ),
    ]);

    const storeTimes = [0.0, 0.15, 0.32, 0.45, 0.58, 0.75];
    const storeTorsoP = [0, 1.1, 0, 0, 1.1, 0, 0, 1.1, -0.01, 0, 1.1, -0.01, 0, 1.1, 0, 0, 1.1, 0];
    const storeTorsoQ = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.02, -0.1, 0.02),
      ...getQuat(-0.03, -0.2, 0.02),
      ...getQuat(-0.03, -0.2, 0.02),
      ...getQuat(0.01, -0.08, 0.01),
      ...getQuat(0, 0, 0),
    ];
    const storeHeadQ = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.08, -0.15, 0),
      ...getQuat(0.16, -0.28, 0.05),
      ...getQuat(0.16, -0.28, 0.05),
      ...getQuat(0.06, -0.1, 0),
      ...getQuat(0, 0, 0),
    ];
    const storeRArmQ = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.12, 0.02, 0.22),
      ...getQuat(0.38, -0.1, 0.14),
      ...getQuat(0.44, -0.2, -0.08),
      ...getQuat(0.22, -0.04, 0.18),
      ...getQuat(0, 0, 0),
    ];
    const storeLArmQ = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.08, 0.02, -0.08),
      ...getQuat(-0.15, 0.08, -0.12),
      ...getQuat(-0.15, 0.08, -0.12),
      ...getQuat(-0.05, 0.02, -0.05),
      ...getQuat(0, 0, 0),
    ];
    const storeLegTimes = [0.0, 0.75];
    const storeClip = new THREE.AnimationClip('store_inv', 0.75, [
      new THREE.VectorKeyframeTrack('Torso.position', storeTimes, storeTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', storeTimes, storeTorsoQ),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', storeTimes, storeHeadQ),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', storeTimes, storeRArmQ),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', storeTimes, storeLArmQ),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        storeLegTimes,
        [-0.15, 0.65, 0, -0.15, 0.65, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        storeLegTimes,
        [0.15, 0.65, 0, 0.15, 0.65, 0]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', storeLegTimes, [...idQ, ...idQ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', storeLegTimes, [
        ...idQ,
        ...idQ,
      ]),
    ]);

    const retrieveTimes = [0.0, 0.18, 0.34, 0.5, 0.68, 0.85];
    const retrieveTorsoP = [
      0, 1.1, 0, 0, 1.1, -0.01, 0, 1.1, -0.01, 0, 1.1, 0, 0, 1.1, 0.01, 0, 1.1, 0,
    ];
    const retrieveTorsoQ = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.02, -0.16, 0.02),
      ...getQuat(-0.03, -0.2, 0.02),
      ...getQuat(0.01, -0.08, 0.01),
      ...getQuat(0.04, 0.04, 0),
      ...getQuat(0, 0, 0),
    ];
    const retrieveHeadQ = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.15, -0.25, 0.04),
      ...getQuat(0.16, -0.28, 0.05),
      ...getQuat(0.08, -0.12, 0),
      ...getQuat(0.18, 0, 0),
      ...getQuat(0, 0, 0),
    ];
    const retrieveRArmQ = [
      ...getQuat(0, 0, 0),
      ...getQuat(0.22, -0.04, 0.18),
      ...getQuat(0.44, -0.2, -0.08),
      ...getQuat(0.28, -0.06, 0.2),
      ...getQuat(-0.85, 0.15, -0.15),
      ...getQuat(0, 0, 0),
    ];
    const retrieveLArmQ = [
      ...getQuat(0, 0, 0),
      ...getQuat(-0.12, 0.05, -0.1),
      ...getQuat(-0.15, 0.08, -0.12),
      ...getQuat(-0.1, 0.04, -0.06),
      ...getQuat(-0.15, 0, -0.1),
      ...getQuat(0, 0, 0),
    ];
    const retrieveClip = new THREE.AnimationClip('retrieve_inv', 0.85, [
      new THREE.VectorKeyframeTrack('Torso.position', retrieveTimes, retrieveTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', retrieveTimes, retrieveTorsoQ),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', retrieveTimes, retrieveHeadQ),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', retrieveTimes, retrieveRArmQ),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', retrieveTimes, retrieveLArmQ),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        [0.0, 0.85],
        [-0.15, 0.65, 0, -0.15, 0.65, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        [0.0, 0.85],
        [0.15, 0.65, 0, 0.15, 0.65, 0]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', [0.0, 0.85], [...idQ, ...idQ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', [0.0, 0.85], [...idQ, ...idQ]),
    ]);

    const putOnTimes = [0.0, 0.25, 0.5, 0.75, 1.05];
    const putOnClip = new THREE.AnimationClip('put_on', 1.05, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        putOnTimes,
        [0, 1.1, 0, 0, 1.105, -0.01, 0, 1.09, 0.02, 0, 1.1, 0, 0, 1.1, 0]
      ),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', putOnTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.08, 0, 0),
        ...getQuat(0.08, 0, 0),
        ...getQuat(-0.05, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', putOnTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(0.2, 0, 0),
        ...getQuat(0.08, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', putOnTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-2.15, 0.25, -0.3),
        ...getQuat(-1.4, 0.15, -0.25),
        ...getQuat(-0.85, 0.1, -0.2),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', putOnTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-2.15, -0.25, 0.3),
        ...getQuat(-1.4, -0.15, 0.25),
        ...getQuat(-0.85, -0.1, 0.2),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        [0.0, 1.05],
        [-0.15, 0.65, 0, -0.15, 0.65, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        [0.0, 1.05],
        [0.15, 0.65, 0, 0.15, 0.65, 0]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', [0.0, 1.05], [...idQ, ...idQ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', [0.0, 1.05], [...idQ, ...idQ]),
    ]);

    const takeOffTimes = [0.0, 0.25, 0.55, 0.8, 1.05];
    const takeOffClip = new THREE.AnimationClip('take_off', 1.05, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        takeOffTimes,
        [0, 1.1, 0, 0, 1.095, 0.01, 0, 1.105, -0.01, 0, 1.1, 0.01, 0, 1.1, 0]
      ),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', takeOffTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.05, 0, 0),
        ...getQuat(-0.08, 0, 0),
        ...getQuat(0.04, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', takeOffTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.15, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(0.15, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', takeOffTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.85, 0.1, -0.2),
        ...getQuat(-2.2, 0.25, -0.3),
        ...getQuat(-1.0, 0.1, -0.15),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', takeOffTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.85, -0.1, 0.2),
        ...getQuat(-2.2, -0.25, 0.3),
        ...getQuat(-1.0, -0.1, 0.15),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        [0.0, 1.05],
        [-0.15, 0.65, 0, -0.15, 0.65, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        [0.0, 1.05],
        [0.15, 0.65, 0, 0.15, 0.65, 0]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', [0.0, 1.05], [...idQ, ...idQ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', [0.0, 1.05], [...idQ, ...idQ]),
    ]);

    const durationProne = 2.0;
    const proneFrames = fps * durationProne;
    const proneTimes: number[] = [];
    const proneTorsoP: number[] = [];
    const proneTorsoQ: number[] = [];
    const proneHeadQ: number[] = [];
    const proneRArmQ: number[] = [];
    const proneLArmQ: number[] = [];
    const proneLLegP: number[] = [];
    const proneRLegP: number[] = [];
    const proneLegQ: number[] = [];
    const proneLegRot = getQuat(1.57, 0, 0);
    const proneRArmP: number[] = [];
    const proneLArmP: number[] = [];

    for (let i = 0; i <= proneFrames; i++) {
      const time = (i / proneFrames) * durationProne;
      proneTimes.push(time);
      const cycle = (i / proneFrames) * Math.PI * 2;
      const breathe = Math.sin(cycle) * 0.008;

      proneTorsoP.push(0, 0.25 + breathe, 0.33);
      euler.set(1.25 + Math.sin(cycle) * 0.015, 0, 0);
      quat.setFromEuler(euler);
      proneTorsoQ.push(quat.x, quat.y, quat.z, quat.w);

      euler.set(-1.15 + Math.sin(cycle) * 0.02, 0, 0);
      quat.setFromEuler(euler);
      proneHeadQ.push(quat.x, quat.y, quat.z, quat.w);

      proneRArmP.push(0.35, 0.25, 0);
      proneLArmP.push(-0.35, 0.25, 0);

      euler.set(-2.38, 0.15, -0.22);
      quat.setFromEuler(euler);
      proneRArmQ.push(quat.x, quat.y, quat.z, quat.w);

      euler.set(-2.38, -0.15, 0.22);
      quat.setFromEuler(euler);
      proneLArmQ.push(quat.x, quat.y, quat.z, quat.w);

      proneLLegP.push(-0.15, 0.14, -0.05);
      proneRLegP.push(0.15, 0.14, -0.05);
      proneLegQ.push(...proneLegRot);
    }

    const proneIdleClip = new THREE.AnimationClip('prone_idle', durationProne, [
      new THREE.VectorKeyframeTrack('Torso.position', proneTimes, proneTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', proneTimes, proneTorsoQ),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', proneTimes, proneHeadQ),
      new THREE.VectorKeyframeTrack('RightArmPivot.position', proneTimes, proneRArmP),
      new THREE.VectorKeyframeTrack('LeftArmPivot.position', proneTimes, proneLArmP),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', proneTimes, proneRArmQ),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', proneTimes, proneLArmQ),
      new THREE.VectorKeyframeTrack('LeftLegPivot.position', proneTimes, proneLLegP),
      new THREE.VectorKeyframeTrack('RightLegPivot.position', proneTimes, proneRLegP),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', proneTimes, proneLegQ),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', proneTimes, proneLegQ),
    ]);

    const standToProneTimes = [0.0, 0.35, 0.6, 0.9, 1.3];
    const standToProneClip = new THREE.AnimationClip('stand_to_prone', 1.3, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        standToProneTimes,
        [0, 1.1, 0, 0, 0.97, 0.27, 0, 0.74, 0.54, 0, 0.36, 0.36, 0, 0.25, 0.33]
      ),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', standToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.9, 0, 0),
        ...getQuat(1.15, 0, 0),
        ...getQuat(1.22, 0, 0),
        ...getQuat(1.25, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', standToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.4, 0, 0),
        ...getQuat(-0.65, 0, 0),
        ...getQuat(-0.95, 0, 0),
        ...getQuat(-1.15, 0, 0),
      ]),
      new THREE.VectorKeyframeTrack(
        'RightArmPivot.position',
        [0.0, 1.3],
        [0.35, 0.25, 0, 0.35, 0.25, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'LeftArmPivot.position',
        [0.0, 1.3],
        [-0.35, 0.25, 0, -0.35, 0.25, 0]
      ),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', standToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-1.45, 0, -0.1),
        ...getQuat(-1.95, 0.1, -0.2),
        ...getQuat(-2.25, 0.15, -0.22),
        ...getQuat(-2.38, 0.15, -0.22),
      ]),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', standToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-1.45, 0, 0.1),
        ...getQuat(-1.95, -0.1, 0.2),
        ...getQuat(-2.25, -0.15, 0.22),
        ...getQuat(-2.38, -0.15, 0.22),
      ]),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        standToProneTimes,
        [-0.15, 0.65, 0, -0.15, 0.65, 0, -0.15, 0.56, 0.23, -0.15, 0.2, -0.02, -0.15, 0.14, -0.05]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        standToProneTimes,
        [0.15, 0.65, 0, 0.15, 0.65, 0, 0.15, 0.56, 0.23, 0.15, 0.2, -0.02, 0.15, 0.14, -0.05]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', standToProneTimes, [
        ...idQ,
        ...idQ,
        ...getQuat(0.45, 0, 0),
        ...getQuat(1.45, 0, 0),
        ...getQuat(1.57, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', standToProneTimes, [
        ...idQ,
        ...idQ,
        ...getQuat(0.45, 0, 0),
        ...getQuat(1.45, 0, 0),
        ...getQuat(1.57, 0, 0),
      ]),
    ]);

    const proneToStandTimes = [0.0, 0.35, 0.7, 1.05, 1.35];
    const proneToStandClip = new THREE.AnimationClip('prone_to_stand', 1.35, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        proneToStandTimes,
        [0, 0.25, 0.33, 0, 0.45, 0.3, 0, 0.78, 0.24, 0, 1.06, 0.07, 0, 1.1, 0]
      ),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', proneToStandTimes, [
        ...getQuat(1.25, 0, 0),
        ...getQuat(1.1, 0, 0),
        ...getQuat(0.75, 0, 0),
        ...getQuat(0.2, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', proneToStandTimes, [
        ...getQuat(-1.15, 0, 0),
        ...getQuat(-0.6, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(0, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.VectorKeyframeTrack(
        'RightArmPivot.position',
        [0.0, 1.35],
        [0.35, 0.25, 0, 0.35, 0.25, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'LeftArmPivot.position',
        [0.0, 1.35],
        [-0.35, 0.25, 0, -0.35, 0.25, 0]
      ),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', proneToStandTimes, [
        ...getQuat(-2.38, 0.15, -0.22),
        ...getQuat(-1.85, 0.12, -0.2),
        ...getQuat(-1.0, 0, -0.1),
        ...getQuat(-0.2, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', proneToStandTimes, [
        ...getQuat(-2.38, -0.15, 0.22),
        ...getQuat(-1.85, -0.12, 0.2),
        ...getQuat(-1.0, 0, 0.1),
        ...getQuat(-0.2, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        proneToStandTimes,
        [-0.15, 0.14, -0.05, -0.15, 0.24, -0.05, -0.15, 0.48, -0.02, -0.15, 0.67, 0, -0.15, 0.65, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        proneToStandTimes,
        [0.15, 0.14, -0.05, 0.15, 0.24, -0.05, 0.15, 0.48, -0.02, 0.15, 0.67, 0, 0.15, 0.65, 0]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', proneToStandTimes, [
        ...getQuat(1.57, 0, 0),
        ...getQuat(1.3, 0, 0),
        ...getQuat(0.45, 0, 0),
        ...getQuat(0.1, 0, 0),
        ...idQ,
      ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', proneToStandTimes, [
        ...getQuat(1.57, 0, 0),
        ...getQuat(1.3, 0, 0),
        ...getQuat(0.45, 0, 0),
        ...getQuat(0.1, 0, 0),
        ...idQ,
      ]),
    ]);

    const crouchToProneTimes = [0.0, 0.25, 0.5, 0.75, 1.15];
    const crouchToProneClip = new THREE.AnimationClip('crouch_to_prone', 1.15, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        crouchToProneTimes,
        [0, 1.065, 0.152, 0, 0.85, 0.29, 0, 0.52, 0.33, 0, 0.32, 0.34, 0, 0.25, 0.33]
      ),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', crouchToProneTimes, [
        ...getQuat(0.45, 0, 0),
        ...getQuat(0.95, 0, 0),
        ...getQuat(1.15, 0, 0),
        ...getQuat(1.22, 0, 0),
        ...getQuat(1.25, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', crouchToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.35, 0, 0),
        ...getQuat(-0.65, 0, 0),
        ...getQuat(-0.95, 0, 0),
        ...getQuat(-1.15, 0, 0),
      ]),
      new THREE.VectorKeyframeTrack(
        'RightArmPivot.position',
        [0.0, 1.15],
        [0.35, 0.25, 0, 0.35, 0.25, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'LeftArmPivot.position',
        [0.0, 1.15],
        [-0.35, 0.25, 0, -0.35, 0.25, 0]
      ),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', crouchToProneTimes, [
        ...idQ,
        ...getQuat(-1.5, 0, -0.12),
        ...getQuat(-1.95, 0.1, -0.2),
        ...getQuat(-2.3, 0.15, -0.22),
        ...getQuat(-2.38, 0.15, -0.22),
      ]),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', crouchToProneTimes, [
        ...idQ,
        ...getQuat(-1.5, 0, 0.12),
        ...getQuat(-1.95, -0.1, 0.2),
        ...getQuat(-2.3, -0.15, 0.22),
        ...getQuat(-2.38, -0.15, 0.22),
      ]),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        crouchToProneTimes,
        [
          -0.15, 0.65, 0, -0.15, 0.6, -0.01, -0.15, 0.36, -0.04, -0.15, 0.18, -0.05, -0.15, 0.14,
          -0.05,
        ]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        crouchToProneTimes,
        [0.15, 0.65, 0, 0.15, 0.6, -0.01, 0.15, 0.36, -0.04, 0.15, 0.18, -0.05, 0.15, 0.14, -0.05]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', crouchToProneTimes, [
        ...idQ,
        ...getQuat(0.15, 0, 0),
        ...getQuat(0.8, 0, 0),
        ...getQuat(1.5, 0, 0),
        ...getQuat(1.57, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', crouchToProneTimes, [
        ...idQ,
        ...getQuat(0.15, 0, 0),
        ...getQuat(0.8, 0, 0),
        ...getQuat(1.5, 0, 0),
        ...getQuat(1.57, 0, 0),
      ]),
    ]);

    const proneToCrouchTimes = [0.0, 0.3, 0.6, 0.85, 1.15];
    const proneToCrouchClip = new THREE.AnimationClip('prone_to_crouch', 1.15, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        proneToCrouchTimes,
        [0, 0.25, 0.33, 0, 0.48, 0.32, 0, 0.79, 0.25, 0, 1.03, 0.17, 0, 1.065, 0.152]
      ),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', proneToCrouchTimes, [
        ...getQuat(1.25, 0, 0),
        ...getQuat(1.1, 0, 0),
        ...getQuat(0.8, 0, 0),
        ...getQuat(0.5, 0, 0),
        ...getQuat(0.45, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', proneToCrouchTimes, [
        ...getQuat(-1.15, 0, 0),
        ...getQuat(-0.6, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(-0.05, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.VectorKeyframeTrack(
        'RightArmPivot.position',
        [0.0, 1.15],
        [0.35, 0.25, 0, 0.35, 0.25, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'LeftArmPivot.position',
        [0.0, 1.15],
        [-0.35, 0.25, 0, -0.35, 0.25, 0]
      ),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', proneToCrouchTimes, [
        ...getQuat(-2.38, 0.15, -0.22),
        ...getQuat(-1.85, 0.12, -0.2),
        ...getQuat(-1.1, 0, -0.1),
        ...getQuat(-0.25, 0, 0),
        ...idQ,
      ]),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', proneToCrouchTimes, [
        ...getQuat(-2.38, -0.15, 0.22),
        ...getQuat(-1.85, -0.12, 0.2),
        ...getQuat(-1.1, 0, 0.1),
        ...getQuat(-0.25, 0, 0),
        ...idQ,
      ]),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        proneToCrouchTimes,
        [-0.15, 0.14, -0.05, -0.15, 0.3, -0.05, -0.15, 0.5, -0.02, -0.15, 0.67, 0, -0.15, 0.65, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        proneToCrouchTimes,
        [0.15, 0.14, -0.05, 0.15, 0.3, -0.05, 0.15, 0.5, -0.02, 0.15, 0.67, 0, 0.15, 0.65, 0]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', proneToCrouchTimes, [
        ...getQuat(1.57, 0, 0),
        ...getQuat(1.2, 0, 0),
        ...getQuat(0.4, 0, 0),
        ...getQuat(0.05, 0, 0),
        ...idQ,
      ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', proneToCrouchTimes, [
        ...getQuat(1.57, 0, 0),
        ...getQuat(1.2, 0, 0),
        ...getQuat(0.4, 0, 0),
        ...getQuat(0.05, 0, 0),
        ...idQ,
      ]),
    ]);

    const attackTimes = [0.0, 0.08, 0.18, 0.28, 0.4];
    const attackLeftClip = new THREE.AnimationClip('attack_left_hand', 0.4, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        attackTimes,
        [0, 1.1, 0, 0, 1.11, 0, 0, 1.08, 0.03, 0, 1.1, 0.01, 0, 1.1, 0]
      ),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.06, -0.15, 0.02),
        ...getQuat(0.14, 0.12, -0.04),
        ...getQuat(0.04, 0.02, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.05, 0.08, 0),
        ...getQuat(0.18, -0.05, 0),
        ...getQuat(0.05, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(1.1, -0.15, -0.2),
        ...getQuat(-1.45, 0.1, 0.15),
        ...getQuat(-0.75, 0, 0.05),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.15, 0, 0.15),
        ...getQuat(0.3, 0.08, 0.15),
        ...getQuat(0.1, 0, 0.05),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        [0.0, 0.4],
        [-0.15, 0.65, 0, -0.15, 0.65, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        [0.0, 0.4],
        [0.15, 0.65, 0, 0.15, 0.65, 0]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', [0.0, 0.4], [...idQ, ...idQ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', [0.0, 0.4], [...idQ, ...idQ]),
    ]);

    const attackRightClip = new THREE.AnimationClip('attack_right_hand', 0.4, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        attackTimes,
        [0, 1.1, 0, 0, 1.11, 0, 0, 1.08, 0.03, 0, 1.1, 0.01, 0, 1.1, 0]
      ),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.06, 0.15, -0.02),
        ...getQuat(0.14, -0.12, 0.04),
        ...getQuat(0.04, -0.02, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.05, -0.08, 0),
        ...getQuat(0.18, 0.05, 0),
        ...getQuat(0.05, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(1.1, 0.15, 0.2),
        ...getQuat(-1.45, -0.1, -0.15),
        ...getQuat(-0.75, 0, -0.05),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.15, 0, -0.15),
        ...getQuat(0.3, -0.08, -0.15),
        ...getQuat(0.1, 0, -0.05),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        [0.0, 0.4],
        [-0.15, 0.65, 0, -0.15, 0.65, 0]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        [0.0, 0.4],
        [0.15, 0.65, 0, 0.15, 0.65, 0]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', [0.0, 0.4], [...idQ, ...idQ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', [0.0, 0.4], [...idQ, ...idQ]),
    ]);

    const fallTimes = [0.0, 0.18, 0.4, 0.65, 0.9];
    const fallBackClip = new THREE.AnimationClip('fall_back', 0.9, [
      new THREE.VectorKeyframeTrack(
        'Torso.position',
        fallTimes,
        [0, 1.1, 0, 0, 0.85, -0.12, 0, 0.4, -0.28, 0, 0.16, -0.35, 0, 0.14, -0.35]
      ),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', fallTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.4, 0, 0),
        ...getQuat(-1.2, 0, 0),
        ...getQuat(-1.57, 0, 0),
        ...getQuat(-1.57, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', fallTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.3, 0, 0),
        ...getQuat(0.35, 0, 0),
        ...getQuat(-0.15, 0, 0),
        ...getQuat(0, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', fallTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-1.7, 0.3, 0.45),
        ...getQuat(-1.1, 0.15, 0.35),
        ...getQuat(0.1, 0, 0.3),
        ...getQuat(0.05, 0.02, 0.18),
      ]),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', fallTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-1.7, -0.3, -0.45),
        ...getQuat(-1.1, -0.15, -0.35),
        ...getQuat(0.1, 0, -0.3),
        ...getQuat(0.05, -0.02, -0.18),
      ]),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        fallTimes,
        [-0.15, 0.65, 0, -0.15, 0.5, 0.15, -0.15, 0.3, 0.1, -0.15, 0.2, 0.05, -0.15, 0.14, 0.05]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        fallTimes,
        [0.15, 0.65, 0, 0.15, 0.5, 0.15, 0.15, 0.3, 0.1, 0.15, 0.2, 0.05, 0.15, 0.14, 0.05]
      ),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', fallTimes, [
        ...idQ,
        ...getQuat(-0.45, 0, 0),
        ...getQuat(-1.2, 0, 0),
        ...getQuat(-1.7, 0, 0),
        ...getQuat(-1.57, 0, 0),
      ]),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', fallTimes, [
        ...idQ,
        ...getQuat(-0.45, 0, 0),
        ...getQuat(-1.2, 0, 0),
        ...getQuat(-1.7, 0, 0),
        ...getQuat(-1.57, 0, 0),
      ]),
    ]);

    const deadClip = new THREE.AnimationClip('dead', 1.0, [
      new THREE.VectorKeyframeTrack('Torso.position', [0.0, 1.0], [0, 0.14, -0.35, 0, 0.14, -0.35]),
      new THREE.QuaternionKeyframeTrack(
        'Torso.quaternion',
        [0.0, 1.0],
        [...getQuat(-1.57, 0, 0), ...getQuat(-1.57, 0, 0)]
      ),
      new THREE.QuaternionKeyframeTrack(
        'HeadPivot.quaternion',
        [0.0, 1.0],
        [...getQuat(-0.05, 0.12, 0.22), ...getQuat(-0.05, 0.12, 0.22)]
      ),
      new THREE.QuaternionKeyframeTrack(
        'RightArmPivot.quaternion',
        [0.0, 1.0],
        [...getQuat(0.08, 0.05, 0.28), ...getQuat(0.08, 0.05, 0.28)]
      ),
      new THREE.QuaternionKeyframeTrack(
        'LeftArmPivot.quaternion',
        [0.0, 1.0],
        [...getQuat(0.08, -0.05, -0.24), ...getQuat(0.08, -0.05, -0.24)]
      ),
      new THREE.VectorKeyframeTrack(
        'LeftLegPivot.position',
        [0.0, 1.0],
        [-0.15, 0.14, 0.05, -0.15, 0.14, 0.05]
      ),
      new THREE.VectorKeyframeTrack(
        'RightLegPivot.position',
        [0.0, 1.0],
        [0.15, 0.14, 0.05, 0.15, 0.14, 0.05]
      ),
      new THREE.QuaternionKeyframeTrack(
        'LeftLegPivot.quaternion',
        [0.0, 1.0],
        [...getQuat(-1.57, 0, -0.1), ...getQuat(-1.57, 0, -0.1)]
      ),
      new THREE.QuaternionKeyframeTrack(
        'RightLegPivot.quaternion',
        [0.0, 1.0],
        [...getQuat(-1.57, 0, 0.12), ...getQuat(-1.57, 0, 0.12)]
      ),
    ]);

    const durationCrawl = 1.2;
    const crawlFrames = fps * durationCrawl;
    const crawlTimes: number[] = [];
    const crawlTorsoP: number[] = [];
    const crawlTorsoQ: number[] = [];
    const crawlHeadQ: number[] = [];
    const crawlRArmP: number[] = [];
    const crawlLArmP: number[] = [];
    const crawlRArmQ: number[] = [];
    const crawlLArmQ: number[] = [];
    const crawlLLegP: number[] = [];
    const crawlRLegP: number[] = [];
    const crawlLegQ: number[] = [];

    for (let i = 0; i <= crawlFrames; i++) {
      const time = (i / crawlFrames) * durationCrawl;
      crawlTimes.push(time);
      const cycle = (i / crawlFrames) * Math.PI * 2;

      const torsoY = 0.25 + Math.pow(Math.sin(cycle), 2) * 0.015;
      const bodyRollZ = Math.sin(cycle) * 0.04;
      const bodyTwistY = Math.cos(cycle) * 0.04;

      crawlTorsoP.push(0, torsoY, 0.33);
      euler.set(1.25 + Math.sin(cycle * 2) * 0.02, bodyTwistY, bodyRollZ);
      quat.setFromEuler(euler);
      crawlTorsoQ.push(quat.x, quat.y, quat.z, quat.w);

      euler.set(-1.15 + Math.sin(cycle * 2) * 0.02, -bodyTwistY * 0.5, 0);
      quat.setFromEuler(euler);
      crawlHeadQ.push(quat.x, quat.y, quat.z, quat.w);

      const armReach = Math.sin(cycle) * 0.12;
      crawlRArmP.push(0.35, 0.25 + armReach, 0);
      crawlLArmP.push(-0.35, 0.25 - armReach, 0);

      euler.set(-2.38 + armReach * 1.5, 0.15, -0.22);
      quat.setFromEuler(euler);
      crawlRArmQ.push(quat.x, quat.y, quat.z, quat.w);

      euler.set(-2.38 - armReach * 1.5, -0.15, 0.22);
      quat.setFromEuler(euler);
      crawlLArmQ.push(quat.x, quat.y, quat.z, quat.w);

      const legSlide = Math.sin(cycle) * 0.08;
      crawlLLegP.push(-0.15, 0.14, -0.05 - legSlide);
      crawlRLegP.push(0.15, 0.14, -0.05 + legSlide);
      crawlLegQ.push(...proneLegRot);
    }

    const proneCrawlClip = new THREE.AnimationClip('prone_crawl', durationCrawl, [
      new THREE.VectorKeyframeTrack('Torso.position', crawlTimes, crawlTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', crawlTimes, crawlTorsoQ),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', crawlTimes, crawlHeadQ),
      new THREE.VectorKeyframeTrack('RightArmPivot.position', crawlTimes, crawlRArmP),
      new THREE.VectorKeyframeTrack('LeftArmPivot.position', crawlTimes, crawlLArmP),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', crawlTimes, crawlRArmQ),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', crawlTimes, crawlLArmQ),
      new THREE.VectorKeyframeTrack('LeftLegPivot.position', crawlTimes, crawlLLegP),
      new THREE.VectorKeyframeTrack('RightLegPivot.position', crawlTimes, crawlRLegP),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', crawlTimes, crawlLegQ),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', crawlTimes, crawlLegQ),
    ]);

    const createStanceTransitionClip = (name: string, fromCrouch: boolean) => {
      const duration = 0.15;
      const times = [0.0, duration];

      // Высота и Z-вынос туловища в положении crouch (при угле наклона 0.45)
      const crouchTorsoY = torsoBaseBottomY + torsoHalfHeight * Math.cos(0.45);
      const crouchTorsoZ = torsoHalfHeight * Math.sin(0.45);

      const startTorsoY = fromCrouch ? crouchTorsoY : 1.1;
      const endTorsoY = fromCrouch ? 1.1 : crouchTorsoY;
      const startTorsoZ = fromCrouch ? crouchTorsoZ : 0;
      const endTorsoZ = fromCrouch ? 0 : crouchTorsoZ;

      // Ноги не смещаются по вертикали — всегда 0.65
      const legY = 0.65;

      const startRot = fromCrouch ? 0.45 : 0;
      const endRot = fromCrouch ? 0 : 0.45;

      const q1 = getQuat(startRot, 0, 0);
      const q2 = getQuat(endRot, 0, 0);
      const hq1 = getQuat(-startRot, 0, 0);
      const hq2 = getQuat(-endRot, 0, 0);

      return new THREE.AnimationClip(name, duration, [
        new THREE.VectorKeyframeTrack('Torso.position', times, [
          0,
          startTorsoY,
          startTorsoZ,
          0,
          endTorsoY,
          endTorsoZ,
        ]),
        new THREE.QuaternionKeyframeTrack('Torso.quaternion', times, [...q1, ...q2]),
        new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', times, [...hq1, ...hq2]),
        new THREE.VectorKeyframeTrack('LeftLegPivot.position', times, [
          -0.15,
          legY,
          0,
          -0.15,
          legY,
          0,
        ]),
        new THREE.VectorKeyframeTrack('RightLegPivot.position', times, [
          0.15,
          legY,
          0,
          0.15,
          legY,
          0,
        ]),
        new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', times, [...idQ, ...idQ]),
        new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', times, [...idQ, ...idQ]),
      ]);
    };

    const standToCrouchClip = createStanceTransitionClip('stand_to_crouch', false);
    const crouchToStandClip = createStanceTransitionClip('crouch_to_stand', true);

    // --- Анимация невесомости / падения в воздухе (airborne) ---
    const durationAirborne = 1.0;
    const airborneFrames = fps * durationAirborne;
    const airborneTimes: number[] = [];
    const airborneTorsoP: number[] = [];
    const airborneTorsoQ: number[] = [];
    const airborneHeadQ: number[] = [];
    const airborneLArmQ: number[] = [];
    const airborneRArmQ: number[] = [];
    const airborneLLegP: number[] = [];
    const airborneRLegP: number[] = [];
    const airborneLLegQ: number[] = [];
    const airborneRLegQ: number[] = [];

    const torsoPitchBase = 0.08; // Легкий наклон корпуса вперед (~4.5°)

    for (let i = 0; i <= airborneFrames; i++) {
      const time = (i / airborneFrames) * durationAirborne;
      airborneTimes.push(time);
      const cycle = (i / airborneFrames) * Math.PI * 2;

      // Плавное парение корпуса по высоте
      const floatY = Math.sin(cycle) * 0.015;
      const torsoSwayPitch = torsoPitchBase + Math.sin(cycle) * 0.02;
      const torsoRoll = Math.sin(cycle) * 0.015;

      airborneTorsoP.push(0, 1.1 + floatY, 0);

      euler.set(torsoSwayPitch, 0, torsoRoll);
      quat.setFromEuler(euler);
      airborneTorsoQ.push(quat.x, quat.y, quat.z, quat.w);

      // Голова держится строго прямо по горизонту (полная компенсация наклона корпуса)
      euler.set(-torsoSwayPitch, 0, -torsoRoll);
      quat.setFromEuler(euler);
      airborneHeadQ.push(quat.x, quat.y, quat.z, quat.w);

      // Руки разведены в стороны (Z) и слегка вперед (X) для удержания баланса
      const armWave = Math.sin(cycle) * 0.06;
      euler.set(-0.28 + Math.cos(cycle) * 0.05, 0.1, -0.55 - armWave);
      quat.setFromEuler(euler);
      airborneLArmQ.push(quat.x, quat.y, quat.z, quat.w);

      euler.set(-0.28 + Math.cos(cycle) * 0.05, -0.1, 0.55 + armWave);
      quat.setFromEuler(euler);
      airborneRArmQ.push(quat.x, quat.y, quat.z, quat.w);

      // Ноги не подгибаются к корпусу: суставы на базовой высоте 0.65
      airborneLLegP.push(-0.15, 0.65, 0);
      airborneRLegP.push(0.15, 0.65, 0);

      // Ноги слегка разведены в стороны (отведение ~7°) с плавным покачиванием вперед-назад в противофазе
      const legDrift = Math.sin(cycle) * 0.07;
      euler.set(legDrift, 0.04, -0.12);
      quat.setFromEuler(euler);
      airborneLLegQ.push(quat.x, quat.y, quat.z, quat.w);

      euler.set(-legDrift, -0.04, 0.12);
      quat.setFromEuler(euler);
      airborneRLegQ.push(quat.x, quat.y, quat.z, quat.w);
    }

    const airborneClip = new THREE.AnimationClip('airborne', durationAirborne, [
      new THREE.VectorKeyframeTrack('Torso.position', airborneTimes, airborneTorsoP),
      new THREE.QuaternionKeyframeTrack('Torso.quaternion', airborneTimes, airborneTorsoQ),
      new THREE.QuaternionKeyframeTrack('HeadPivot.quaternion', airborneTimes, airborneHeadQ),
      new THREE.QuaternionKeyframeTrack('LeftArmPivot.quaternion', airborneTimes, airborneLArmQ),
      new THREE.QuaternionKeyframeTrack('RightArmPivot.quaternion', airborneTimes, airborneRArmQ),
      new THREE.VectorKeyframeTrack('LeftLegPivot.position', airborneTimes, airborneLLegP),
      new THREE.VectorKeyframeTrack('RightLegPivot.position', airborneTimes, airborneRLegP),
      new THREE.QuaternionKeyframeTrack('LeftLegPivot.quaternion', airborneTimes, airborneLLegQ),
      new THREE.QuaternionKeyframeTrack('RightLegPivot.quaternion', airborneTimes, airborneRLegQ),
    ]);

    const map = new Map<string, THREE.AnimationClip>();
    map.set('stand_idle', idleClip);
    map.set('stand_walk', walkClip);
    map.set('stand_jog', joggingClip);
    map.set('stand_sprint', sprintClip);
    map.set('crouch_idle', crouchingIdleClip);
    map.set('crouch_walk', crouchWalkClip);
    map.set('crouch_jog', crouchJoggingClip);
    map.set('crouch_sprint', crouchSprintingClip);
    map.set('prone_idle', proneIdleClip);
    map.set('prone_crawl', proneCrawlClip);
    map.set('stand_to_crouch', standToCrouchClip);
    map.set('crouch_to_stand', crouchToStandClip);
    map.set('stand_to_prone', standToProneClip);
    map.set('prone_to_stand', proneToStandClip);
    map.set('crouch_to_prone', crouchToProneClip);
    map.set('prone_to_crouch', proneToCrouchClip);
    map.set('attack', attackLeftClip);
    map.set('attack_left_hand', attackLeftClip);
    map.set('attack_right_hand', attackRightClip);
    map.set('pickup', pickupLeftClip);
    map.set('pickup_left_hand', pickupLeftClip);
    map.set('pickup_right_hand', pickupRightClip);
    map.set('drop_item', dropItemLeftClip);
    map.set('drop_item_left_hand', dropItemLeftClip);
    map.set('drop_item_right_hand', dropItemRightClip);
    map.set('throw_item', throwItemLeftClip);
    map.set('throw_item_left_hand', throwItemLeftClip);
    map.set('throw_item_right_hand', throwItemRightClip);
    map.set('throw', dropItemLeftClip);
    map.set('store_inv', storeClip);
    map.set('retrieve_inv', retrieveClip);
    map.set('put_on', putOnClip);
    map.set('take_off', takeOffClip);
    map.set('dead', deadClip);
    map.set('fall_back', fallBackClip);
    map.set('airborne', airborneClip);

    this.clipsCache = map;
    return map;
  }
}
