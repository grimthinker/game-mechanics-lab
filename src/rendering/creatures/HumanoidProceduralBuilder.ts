import * as THREE from 'three';
import { IProceduralCreatureBuilder } from './IProceduralBuilder';
import { AnimationTrackBuilder } from './AnimationTrackBuilder';

export class HumanoidProceduralBuilder implements IProceduralCreatureBuilder {
  private clipsCache: Map<string, THREE.AnimationClip> | null = null;

  // Кэшированные материалы и текстуры для предотвращения утечек памяти
  private static cachedFaceTexture: THREE.CanvasTexture | null = null;
  private static bodyMat = new THREE.MeshStandardMaterial({ color: 0x3b82f6, roughness: 0.3 });
  private static pantsMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4 });
  private static skinMat = new THREE.MeshStandardMaterial({ color: 0xfdfeee, roughness: 0.5 });
  private static headMaterials: THREE.Material[] | null = null;

  private static getFaceTexture(): THREE.CanvasTexture {
    if (!HumanoidProceduralBuilder.cachedFaceTexture) {
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

      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      HumanoidProceduralBuilder.cachedFaceTexture = texture;
    }
    return HumanoidProceduralBuilder.cachedFaceTexture;
  }

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
    rightArmPivot.position.set(-0.35, 0.25, 0);
    const rightHandSocket = new THREE.Group();
    rightHandSocket.name = 'RightHandSocket';
    rightHandSocket.position.set(0, -0.6, 0);
    rightArmPivot.add(rightHandSocket);
    torso.add(rightArmPivot);

    const leftArmPivot = new THREE.Group();
    leftArmPivot.name = 'LeftArmPivot';
    leftArmPivot.position.set(0.35, 0.25, 0);
    const leftHandSocket = new THREE.Group();
    leftHandSocket.name = 'LeftHandSocket';
    leftHandSocket.position.set(0, -0.6, 0);
    leftArmPivot.add(leftHandSocket);
    torso.add(leftArmPivot);

    const rightLegPivot = new THREE.Group();
    rightLegPivot.name = 'RightLegPivot';
    rightLegPivot.position.set(-0.15, 0.65, 0);
    root.add(rightLegPivot);

    const leftLegPivot = new THREE.Group();
    leftLegPivot.name = 'LeftLegPivot';
    leftLegPivot.position.set(0.15, 0.65, 0);
    root.add(leftLegPivot);

    return root;
  }

  public createPartMesh(partKey: string): THREE.Object3D | null {
    switch (partKey) {
      case 'torso': {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.7, 0.25),
          HumanoidProceduralBuilder.bodyMat
        );
        mesh.name = 'TorsoMesh';
        mesh.castShadow = true;
        return mesh;
      }
      case 'head': {
        if (!HumanoidProceduralBuilder.headMaterials) {
          const faceMat = new THREE.MeshStandardMaterial({
            map: HumanoidProceduralBuilder.getFaceTexture(),
            roughness: 0.5,
          });
          const skin = HumanoidProceduralBuilder.skinMat;
          HumanoidProceduralBuilder.headMaterials = [skin, skin, skin, skin, faceMat, skin];
        }
        const head = new THREE.Mesh(
          new THREE.BoxGeometry(0.35, 0.35, 0.35),
          HumanoidProceduralBuilder.headMaterials
        );
        head.name = 'Head';
        head.position.y = 0.22;
        head.castShadow = true;
        return head;
      }
      case 'arm_l': {
        const leftArm = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.7, 0.18),
          HumanoidProceduralBuilder.bodyMat
        );
        leftArm.name = 'LeftArm';
        leftArm.position.y = -0.3;
        leftArm.castShadow = true;
        return leftArm;
      }
      case 'arm_r': {
        const rightArm = new THREE.Mesh(
          new THREE.BoxGeometry(0.18, 0.7, 0.18),
          HumanoidProceduralBuilder.bodyMat
        );
        rightArm.name = 'RightArm';
        rightArm.position.y = -0.3;
        rightArm.castShadow = true;
        return rightArm;
      }
      case 'leg_l': {
        const leftLeg = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.8, 0.2),
          HumanoidProceduralBuilder.pantsMat
        );
        leftLeg.name = 'LeftLeg';
        leftLeg.position.y = -0.35;
        leftLeg.castShadow = true;
        return leftLeg;
      }
      case 'leg_r': {
        const rightLeg = new THREE.Mesh(
          new THREE.BoxGeometry(0.2, 0.8, 0.2),
          HumanoidProceduralBuilder.pantsMat
        );
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
    const torsoHalfHeight = 0.35;
    const torsoBaseBottomY = 0.75;
    const idQ = [0, 0, 0, 1];
    const getQuat = AnimationTrackBuilder.eulerToQuat;

    // --- Параметрический генератор локомоции (Ходьба / Бег / Спринт) ---
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

      const legBaseY = 0.65;
      const fixedTorsoPosY = torsoBaseBottomY + torsoHalfHeight * Math.cos(torsoXRot);
      const fixedTorsoPosZ = torsoHalfHeight * Math.sin(torsoXRot);

      const fixedTorsoQuat = getQuat(torsoXRot, 0, 0);
      const fixedHeadQuat = getQuat(-torsoXRot, 0, 0);

      for (let i = 0; i <= frames; i++) {
        const progress = i / frames;
        const time = progress * duration;
        const cycle = progress * Math.PI * 2;
        times.push(time);

        const swing = Math.sin(cycle) * swingAmount;
        const bounce = bounceAmount > 0 ? Math.pow(Math.sin(cycle), 2) * bounceAmount : 0;

        lLegP.push(0.15, legBaseY + bounce, 0);
        rLegP.push(-0.15, legBaseY + bounce, 0);

        lLegQ.push(...getQuat(swing, 0, 0));
        rLegQ.push(...getQuat(-swing, 0, 0));
        lArmQ.push(...getQuat(-swing * 0.9, 0, 0));
        rArmQ.push(...getQuat(swing * 0.9, 0, 0));

        torsoP.push(0, fixedTorsoPosY + bounce, fixedTorsoPosZ);
        torsoQ.push(...fixedTorsoQuat);
        headQ.push(...fixedHeadQuat);
      }

      return new AnimationTrackBuilder()
        .addPosTrack('LeftLegPivot', times, lLegP)
        .addPosTrack('RightLegPivot', times, rLegP)
        .addQuatTrack('LeftLegPivot', times, lLegQ)
        .addQuatTrack('RightLegPivot', times, rLegQ)
        .addQuatTrack('LeftArmPivot', times, lArmQ)
        .addQuatTrack('RightArmPivot', times, rArmQ)
        .addPosTrack('Torso', times, torsoP)
        .addQuatTrack('Torso', times, torsoQ)
        .addQuatTrack('HeadPivot', times, headQ)
        .build(name, duration);
    };

    // --- Параметрический генератор покоя (Idle) ---
    const createIdleVariant = (name: string, torsoXRot: number) => {
      const durationIdle = 2.0;
      const idleFrames = fps * durationIdle;
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

      const legPosY = 0.65;
      const baseTorsoY = torsoBaseBottomY + torsoHalfHeight * Math.cos(torsoXRot);
      const fixedTorsoZ = torsoHalfHeight * Math.sin(torsoXRot);
      const tQ = getQuat(torsoXRot, 0, 0);
      const hQ = getQuat(-torsoXRot, 0, 0);

      for (let i = 0; i <= idleFrames; i++) {
        const time = (i / idleFrames) * durationIdle;
        times.push(time);

        lLegP.push(0.15, legPosY, 0);
        rLegP.push(-0.15, legPosY, 0);

        const breathe = Math.sin((i / idleFrames) * Math.PI * 2) * 0.015;
        torsoP.push(0, baseTorsoY + breathe, fixedTorsoZ);
        torsoQ.push(...tQ);
        headQ.push(...hQ);

        lLegQ.push(...idQ);
        rLegQ.push(...idQ);
        lArmQ.push(...idQ);
        rArmQ.push(...idQ);
      }

      return new AnimationTrackBuilder()
        .addPosTrack('LeftLegPivot', times, lLegP)
        .addPosTrack('RightLegPivot', times, rLegP)
        .addQuatTrack('LeftLegPivot', times, lLegQ)
        .addQuatTrack('RightLegPivot', times, rLegQ)
        .addQuatTrack('LeftArmPivot', times, lArmQ)
        .addQuatTrack('RightArmPivot', times, rArmQ)
        .addPosTrack('Torso', times, torsoP)
        .addQuatTrack('Torso', times, torsoQ)
        .addQuatTrack('HeadPivot', times, headQ)
        .build(name, durationIdle);
    };

    // 1. Циклы локомоции
    const joggingClip = createWalkCycleClip('stand_jog', 0.5, 0.7, 0.07, 0);
    const walkClip = createWalkCycleClip('stand_walk', 0.8, 0.4, 0.02, 0);
    const sprintClip = createWalkCycleClip('stand_sprint', 0.35, 1.1, 0.03, 0);
    const idleClip = createIdleVariant('stand_idle', 0);

    const crouchingIdleClip = createIdleVariant('crouch_idle', 0.5);
    const crouchWalkClip = createWalkCycleClip('crouch_walk', 0.8, 0.4, 0.01, 0.45);
    const crouchJoggingClip = createWalkCycleClip('crouch_jog', 0.5, 0.7, 0.02, 0.45);
    const crouchSprintingClip = createWalkCycleClip('crouch_sprint', 0.35, 1.0, 0.03, 0.65);

    // 2. Подбор предметов (Левая рука + автозеркалирование на правую)
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

    const pickupLeftClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', pickupTimes, pickupTorsoP)
      .addQuatTrack('Torso', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(pickupTiltPre, 0.1, -0.03),
        ...getQuat(pickupTiltDeep, 0.18, -0.05),
        ...getQuat(pickupTiltDeep, 0.18, -0.05),
        ...getQuat(pickupTiltRec, 0.06, -0.02),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('HeadPivot', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.2, -0.08, 0),
        ...getQuat(-0.35, -0.12, 0),
        ...getQuat(-0.35, -0.12, 0),
        ...getQuat(-0.15, -0.04, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('LeftArmPivot', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.85, -0.1, -0.12),
        ...getQuat(-1.42, -0.18, -0.25),
        ...getQuat(-1.2, 0.1, -0.15),
        ...getQuat(-0.5, 0.05, -0.1),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('RightArmPivot', pickupTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.12, 0.02, 0.08),
        ...getQuat(0.2, 0.04, 0.12),
        ...getQuat(0.2, 0.04, 0.12),
        ...getQuat(0.08, 0.02, 0.05),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack('LeftLegPivot', [0.0, 0.75], [0.15, 0.65, 0, 0.15, 0.65, 0])
      .addPosTrack('RightLegPivot', [0.0, 0.75], [-0.15, 0.65, 0, -0.15, 0.65, 0])
      .addQuatTrack('LeftLegPivot', [0.0, 0.75], [...idQ, ...idQ])
      .addQuatTrack('RightLegPivot', [0.0, 0.75], [...idQ, ...idQ])
      .build('pickup_left_hand', 0.75);

    const pickupRightClip = AnimationTrackBuilder.mirrorClip(pickupLeftClip, 'pickup_right_hand');

    // 3. Сброс предметов под ноги (Левая рука + автозеркалирование)
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

    const dropItemLeftClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', dropItemTimes, dropItemTorsoP)
      .addQuatTrack('Torso', dropItemTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.03, 0.05, 0),
        ...getQuat(0.06, -0.06, 0.02),
        ...getQuat(0.02, -0.02, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('HeadPivot', dropItemTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.05, 0, 0),
        ...getQuat(0.14, 0, 0),
        ...getQuat(0.04, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('LeftArmPivot', dropItemTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.3, 0.05, 0.05),
        ...getQuat(-1.2, 0.1, -0.1),
        ...getQuat(-0.4, 0.05, -0.05),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('RightArmPivot', dropItemTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0, 0, -0.03),
        ...getQuat(0.05, 0, -0.06),
        ...getQuat(0.02, 0, -0.02),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack('LeftLegPivot', dropItemTimes, [
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
      ])
      .addPosTrack('RightLegPivot', dropItemTimes, [
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
      ])
      .addQuatTrack('LeftLegPivot', dropItemTimes, [...idQ, ...idQ, ...idQ, ...idQ, ...idQ])
      .addQuatTrack('RightLegPivot', dropItemTimes, [...idQ, ...idQ, ...idQ, ...idQ, ...idQ])
      .build('drop_item_left_hand', 0.45);

    const dropItemRightClip = AnimationTrackBuilder.mirrorClip(
      dropItemLeftClip,
      'drop_item_right_hand'
    );

    // 4. Бросок предметов (Левая рука + автозеркалирование)
    const throwItemTimes = [0.0, 0.14, 0.26, 0.38, 0.55];
    const throwItemTorsoP = [0, 1.1, 0, 0, 1.09, -0.02, 0, 1.13, 0.03, 0, 1.11, 0.01, 0, 1.1, 0];

    const throwItemLeftClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', throwItemTimes, throwItemTorsoP)
      .addQuatTrack('Torso', throwItemTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.12, 0.15, -0.04),
        ...getQuat(0.2, -0.16, 0.05),
        ...getQuat(0.06, -0.04, 0.01),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('HeadPivot', throwItemTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.1, -0.1, 0),
        ...getQuat(0.16, 0.08, 0),
        ...getQuat(0.05, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('LeftArmPivot', throwItemTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.75, 0.12, 0.25),
        ...getQuat(-1.85, 0.15, -0.22),
        ...getQuat(-0.7, 0.05, -0.08),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('RightArmPivot', throwItemTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.5, -0.1, -0.15),
        ...getQuat(0.35, 0.05, 0.1),
        ...getQuat(0.1, 0, 0.02),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack(
        'LeftLegPivot',
        throwItemTimes,
        [0.15, 0.65, 0, 0.15, 0.65, -0.02, 0.15, 0.67, 0.04, 0.15, 0.65, 0.01, 0.15, 0.65, 0]
      )
      .addPosTrack(
        'RightLegPivot',
        throwItemTimes,
        [-0.15, 0.65, 0, -0.15, 0.65, -0.02, -0.15, 0.67, 0.04, -0.15, 0.65, 0.01, -0.15, 0.65, 0]
      )
      .addQuatTrack('LeftLegPivot', throwItemTimes, [...idQ, ...idQ, ...idQ, ...idQ, ...idQ])
      .addQuatTrack('RightLegPivot', throwItemTimes, [...idQ, ...idQ, ...idQ, ...idQ, ...idQ])
      .build('throw_item_left_hand', 0.55);

    const throwItemRightClip = AnimationTrackBuilder.mirrorClip(
      throwItemLeftClip,
      'throw_item_right_hand'
    );

    // 5. Атака оружием (Левая рука + автозеркалирование)
    const attackTimes = [0.0, 0.08, 0.18, 0.28, 0.4];
    const attackLeftClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        attackTimes,
        [0, 1.1, 0, 0, 1.11, 0, 0, 1.08, 0.03, 0, 1.1, 0.01, 0, 1.1, 0]
      )
      .addQuatTrack('Torso', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.06, 0.15, -0.02),
        ...getQuat(0.14, -0.12, 0.04),
        ...getQuat(0.04, -0.02, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('HeadPivot', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.05, -0.08, 0),
        ...getQuat(0.18, 0.05, 0),
        ...getQuat(0.05, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('LeftArmPivot', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(1.1, 0.15, 0.2),
        ...getQuat(-1.45, -0.1, -0.15),
        ...getQuat(-0.75, 0, -0.05),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('RightArmPivot', attackTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.15, 0, -0.15),
        ...getQuat(0.3, -0.08, -0.15),
        ...getQuat(0.1, 0, -0.05),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack('LeftLegPivot', [0.0, 0.4], [0.15, 0.65, 0, 0.15, 0.65, 0])
      .addPosTrack('RightLegPivot', [0.0, 0.4], [-0.15, 0.65, 0, -0.15, 0.65, 0])
      .addQuatTrack('LeftLegPivot', [0.0, 0.4], [...idQ, ...idQ])
      .addQuatTrack('RightLegPivot', [0.0, 0.4], [...idQ, ...idQ])
      .build('attack_left_hand', 0.4);

    const attackRightClip = AnimationTrackBuilder.mirrorClip(attackLeftClip, 'attack_right_hand');

    // 6. Хранение и извлечение из инвентаря
    const storeTimes = [0.0, 0.15, 0.32, 0.45, 0.58, 0.75];
    const storeClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        storeTimes,
        [0, 1.1, 0, 0, 1.1, 0, 0, 1.1, -0.01, 0, 1.1, -0.01, 0, 1.1, 0, 0, 1.1, 0]
      )
      .addQuatTrack('Torso', storeTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.02, -0.1, 0.02),
        ...getQuat(-0.03, -0.2, 0.02),
        ...getQuat(-0.03, -0.2, 0.02),
        ...getQuat(0.01, -0.08, 0.01),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('HeadPivot', storeTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.08, -0.15, 0),
        ...getQuat(0.16, -0.28, 0.05),
        ...getQuat(0.16, -0.28, 0.05),
        ...getQuat(0.06, -0.1, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('RightArmPivot', storeTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.12, -0.02, -0.22),
        ...getQuat(0.38, 0.1, -0.14),
        ...getQuat(0.44, 0.2, 0.08),
        ...getQuat(0.22, 0.04, -0.18),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('LeftArmPivot', storeTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.08, -0.02, 0.08),
        ...getQuat(-0.15, -0.08, 0.12),
        ...getQuat(-0.15, -0.08, 0.12),
        ...getQuat(-0.05, -0.02, 0.05),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack('LeftLegPivot', [0.0, 0.75], [0.15, 0.65, 0, 0.15, 0.65, 0])
      .addPosTrack('RightLegPivot', [0.0, 0.75], [-0.15, 0.65, 0, -0.15, 0.65, 0])
      .addQuatTrack('LeftLegPivot', [0.0, 0.75], [...idQ, ...idQ])
      .addQuatTrack('RightLegPivot', [0.0, 0.75], [...idQ, ...idQ])
      .build('store_inv', 0.75);

    const retrieveTimes = [0.0, 0.18, 0.34, 0.5, 0.68, 0.85];
    const retrieveClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        retrieveTimes,
        [0, 1.1, 0, 0, 1.1, -0.01, 0, 1.1, -0.01, 0, 1.1, 0, 0, 1.1, 0.01, 0, 1.1, 0]
      )
      .addQuatTrack('Torso', retrieveTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.02, -0.16, 0.02),
        ...getQuat(-0.03, -0.2, 0.02),
        ...getQuat(0.01, -0.08, 0.01),
        ...getQuat(0.04, 0.04, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('HeadPivot', retrieveTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.15, -0.25, 0.04),
        ...getQuat(0.16, -0.28, 0.05),
        ...getQuat(0.08, -0.12, 0),
        ...getQuat(0.18, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('RightArmPivot', retrieveTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.22, 0.04, -0.18),
        ...getQuat(0.44, 0.2, 0.08),
        ...getQuat(0.28, 0.06, -0.2),
        ...getQuat(-0.85, -0.15, 0.15),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('LeftArmPivot', retrieveTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.12, -0.05, 0.1),
        ...getQuat(-0.15, -0.08, 0.12),
        ...getQuat(-0.1, -0.04, 0.06),
        ...getQuat(-0.15, 0, 0.1),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack('LeftLegPivot', [0.0, 0.85], [0.15, 0.65, 0, 0.15, 0.65, 0])
      .addPosTrack('RightLegPivot', [0.0, 0.85], [-0.15, 0.65, 0, -0.15, 0.65, 0])
      .addQuatTrack('LeftLegPivot', [0.0, 0.85], [...idQ, ...idQ])
      .addQuatTrack('RightLegPivot', [0.0, 0.85], [...idQ, ...idQ])
      .build('retrieve_inv', 0.85);

    // 7. Надевание и снятие экипировки
    const putOnTimes = [0.0, 0.25, 0.5, 0.75, 1.05];
    const putOnClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        putOnTimes,
        [0, 1.1, 0, 0, 1.105, -0.01, 0, 1.09, 0.02, 0, 1.1, 0, 0, 1.1, 0]
      )
      .addQuatTrack('Torso', putOnTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.08, 0, 0),
        ...getQuat(0.08, 0, 0),
        ...getQuat(-0.05, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('HeadPivot', putOnTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(0.2, 0, 0),
        ...getQuat(0.08, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('RightArmPivot', putOnTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-2.15, -0.25, 0.3),
        ...getQuat(-1.4, -0.15, 0.25),
        ...getQuat(-0.85, -0.1, 0.2),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('LeftArmPivot', putOnTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-2.15, 0.25, -0.3),
        ...getQuat(-1.4, 0.15, -0.25),
        ...getQuat(-0.85, 0.1, -0.2),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack('LeftLegPivot', [0.0, 1.05], [0.15, 0.65, 0, 0.15, 0.65, 0])
      .addPosTrack('RightLegPivot', [0.0, 1.05], [-0.15, 0.65, 0, -0.15, 0.65, 0])
      .addQuatTrack('LeftLegPivot', [0.0, 1.05], [...idQ, ...idQ])
      .addQuatTrack('RightLegPivot', [0.0, 1.05], [...idQ, ...idQ])
      .build('put_on', 1.05);

    const takeOffTimes = [0.0, 0.25, 0.55, 0.8, 1.05];
    const takeOffClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        takeOffTimes,
        [0, 1.1, 0, 0, 1.095, 0.01, 0, 1.105, -0.01, 0, 1.1, 0.01, 0, 1.1, 0]
      )
      .addQuatTrack('Torso', takeOffTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.05, 0, 0),
        ...getQuat(-0.08, 0, 0),
        ...getQuat(0.04, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('HeadPivot', takeOffTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.15, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(0.15, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('RightArmPivot', takeOffTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.85, -0.1, 0.2),
        ...getQuat(-2.2, -0.25, 0.3),
        ...getQuat(-1.0, -0.1, 0.15),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('LeftArmPivot', takeOffTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.85, 0.1, -0.2),
        ...getQuat(-2.2, 0.25, -0.3),
        ...getQuat(-1.0, 0.1, -0.15),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack('LeftLegPivot', [0.0, 1.05], [0.15, 0.65, 0, 0.15, 0.65, 0])
      .addPosTrack('RightLegPivot', [0.0, 1.05], [-0.15, 0.65, 0, -0.15, 0.65, 0])
      .addQuatTrack('LeftLegPivot', [0.0, 1.05], [...idQ, ...idQ])
      .addQuatTrack('RightLegPivot', [0.0, 1.05], [...idQ, ...idQ])
      .build('take_off', 1.05);

    // 8. Переходы стоек
    const createStanceTransitionClip = (name: string, fromCrouch: boolean) => {
      const duration = 0.15;
      const times = [0.0, duration];
      const crouchTorsoY = torsoBaseBottomY + torsoHalfHeight * Math.cos(0.45);
      const crouchTorsoZ = torsoHalfHeight * Math.sin(0.45);
      const startTorsoY = fromCrouch ? crouchTorsoY : 1.1;
      const endTorsoY = fromCrouch ? 1.1 : crouchTorsoY;
      const startTorsoZ = fromCrouch ? crouchTorsoZ : 0;
      const endTorsoZ = fromCrouch ? 0 : crouchTorsoZ;
      const startRot = fromCrouch ? 0.45 : 0;
      const endRot = fromCrouch ? 0 : 0.45;

      return new AnimationTrackBuilder()
        .addPosTrack('Torso', times, [0, startTorsoY, startTorsoZ, 0, endTorsoY, endTorsoZ])
        .addQuatTrack('Torso', times, [...getQuat(startRot, 0, 0), ...getQuat(endRot, 0, 0)])
        .addQuatTrack('HeadPivot', times, [...getQuat(-startRot, 0, 0), ...getQuat(-endRot, 0, 0)])
        .addPosTrack('LeftLegPivot', times, [0.15, 0.65, 0, 0.15, 0.65, 0])
        .addPosTrack('RightLegPivot', times, [-0.15, 0.65, 0, -0.15, 0.65, 0])
        .addQuatTrack('LeftLegPivot', times, [...idQ, ...idQ])
        .addQuatTrack('RightLegPivot', times, [...idQ, ...idQ])
        .build(name, duration);
    };

    const standToCrouchClip = createStanceTransitionClip('stand_to_crouch', false);
    const crouchToStandClip = createStanceTransitionClip('crouch_to_stand', true);

    const standToProneTimes = [0.0, 0.35, 0.6, 0.9, 1.3];
    const standToProneClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        standToProneTimes,
        [0, 1.1, 0, 0, 0.97, 0.27, 0, 0.74, 0.54, 0, 0.36, 0.36, 0, 0.25, 0.33]
      )
      .addQuatTrack('Torso', standToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(0.9, 0, 0),
        ...getQuat(1.15, 0, 0),
        ...getQuat(1.22, 0, 0),
        ...getQuat(1.25, 0, 0),
      ])
      .addQuatTrack('HeadPivot', standToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.4, 0, 0),
        ...getQuat(-0.65, 0, 0),
        ...getQuat(-0.95, 0, 0),
        ...getQuat(-1.15, 0, 0),
      ])
      .addPosTrack('RightArmPivot', [0.0, 1.3], [-0.35, 0.25, 0, -0.35, 0.25, 0])
      .addPosTrack('LeftArmPivot', [0.0, 1.3], [0.35, 0.25, 0, 0.35, 0.25, 0])
      .addQuatTrack('RightArmPivot', standToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-1.45, 0, 0.1),
        ...getQuat(-1.95, -0.1, 0.2),
        ...getQuat(-2.25, -0.15, 0.22),
        ...getQuat(-2.38, -0.15, 0.22),
      ])
      .addQuatTrack('LeftArmPivot', standToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-1.45, 0, -0.1),
        ...getQuat(-1.95, 0.1, -0.2),
        ...getQuat(-2.25, 0.15, -0.22),
        ...getQuat(-2.38, 0.15, -0.22),
      ])
      .addPosTrack(
        'LeftLegPivot',
        standToProneTimes,
        [0.15, 0.65, 0, 0.15, 0.65, 0, 0.15, 0.56, 0.23, 0.15, 0.2, -0.02, 0.15, 0.14, -0.05]
      )
      .addPosTrack(
        'RightLegPivot',
        standToProneTimes,
        [-0.15, 0.65, 0, -0.15, 0.65, 0, -0.15, 0.56, 0.23, -0.15, 0.2, -0.02, -0.15, 0.14, -0.05]
      )
      .addQuatTrack('LeftLegPivot', standToProneTimes, [
        ...idQ,
        ...idQ,
        ...getQuat(0.45, 0, 0),
        ...getQuat(1.5, 0, 0),
        ...getQuat(1.57, 0, 0),
      ])
      .addQuatTrack('RightLegPivot', standToProneTimes, [
        ...idQ,
        ...idQ,
        ...getQuat(0.45, 0, 0),
        ...getQuat(1.5, 0, 0),
        ...getQuat(1.57, 0, 0),
      ])
      .build('stand_to_prone', 1.3);

    const proneToStandTimes = [0.0, 0.35, 0.7, 1.05, 1.35];
    const proneToStandClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        proneToStandTimes,
        [0, 0.25, 0.33, 0, 0.45, 0.3, 0, 0.78, 0.24, 0, 1.06, 0.07, 0, 1.1, 0]
      )
      .addQuatTrack('Torso', proneToStandTimes, [
        ...getQuat(1.25, 0, 0),
        ...getQuat(1.1, 0, 0),
        ...getQuat(0.75, 0, 0),
        ...getQuat(0.2, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('HeadPivot', proneToStandTimes, [
        ...getQuat(-1.15, 0, 0),
        ...getQuat(-0.6, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(0, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack('RightArmPivot', [0.0, 1.35], [-0.35, 0.25, 0, -0.35, 0.25, 0])
      .addPosTrack('LeftArmPivot', [0.0, 1.35], [0.35, 0.25, 0, 0.35, 0.25, 0])
      .addQuatTrack('RightArmPivot', proneToStandTimes, [
        ...getQuat(-2.38, -0.15, 0.22),
        ...getQuat(-1.85, -0.12, 0.2),
        ...getQuat(-1.0, 0, 0.1),
        ...getQuat(-0.2, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('LeftArmPivot', proneToStandTimes, [
        ...getQuat(-2.38, 0.15, -0.22),
        ...getQuat(-1.85, 0.12, -0.2),
        ...getQuat(-1.0, 0, -0.1),
        ...getQuat(-0.2, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack(
        'LeftLegPivot',
        proneToStandTimes,
        [0.15, 0.14, -0.05, 0.15, 0.24, -0.05, 0.15, 0.48, -0.02, 0.15, 0.67, 0, 0.15, 0.65, 0]
      )
      .addPosTrack(
        'RightLegPivot',
        proneToStandTimes,
        [-0.15, 0.14, -0.05, -0.15, 0.24, -0.05, -0.15, 0.48, -0.02, -0.15, 0.67, 0, -0.15, 0.65, 0]
      )
      .addQuatTrack('LeftLegPivot', proneToStandTimes, [
        ...getQuat(1.57, 0, 0),
        ...getQuat(1.3, 0, 0),
        ...getQuat(0.45, 0, 0),
        ...getQuat(0.1, 0, 0),
        ...idQ,
      ])
      .addQuatTrack('RightLegPivot', proneToStandTimes, [
        ...getQuat(1.57, 0, 0),
        ...getQuat(1.3, 0, 0),
        ...getQuat(0.45, 0, 0),
        ...getQuat(0.1, 0, 0),
        ...idQ,
      ])
      .build('prone_to_stand', 1.35);

    const crouchToProneTimes = [0.0, 0.25, 0.5, 0.75, 1.15];
    const crouchToProneClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        crouchToProneTimes,
        [0, 1.065, 0.152, 0, 0.85, 0.29, 0, 0.52, 0.33, 0, 0.32, 0.34, 0, 0.25, 0.33]
      )
      .addQuatTrack('Torso', crouchToProneTimes, [
        ...getQuat(0.45, 0, 0),
        ...getQuat(0.95, 0, 0),
        ...getQuat(1.15, 0, 0),
        ...getQuat(1.22, 0, 0),
        ...getQuat(1.25, 0, 0),
      ])
      .addQuatTrack('HeadPivot', crouchToProneTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.35, 0, 0),
        ...getQuat(-0.65, 0, 0),
        ...getQuat(-0.95, 0, 0),
        ...getQuat(-1.15, 0, 0),
      ])
      .addPosTrack('RightArmPivot', [0.0, 1.15], [-0.35, 0.25, 0, -0.35, 0.25, 0])
      .addPosTrack('LeftArmPivot', [0.0, 1.15], [0.35, 0.25, 0, 0.35, 0.25, 0])
      .addQuatTrack('RightArmPivot', crouchToProneTimes, [
        ...idQ,
        ...getQuat(-1.5, 0, 0.12),
        ...getQuat(-1.95, -0.1, 0.2),
        ...getQuat(-2.3, -0.15, 0.22),
        ...getQuat(-2.38, -0.15, 0.22),
      ])
      .addQuatTrack('LeftArmPivot', crouchToProneTimes, [
        ...idQ,
        ...getQuat(-1.5, 0, -0.12),
        ...getQuat(-1.95, 0.1, -0.2),
        ...getQuat(-2.3, 0.15, -0.22),
        ...getQuat(-2.38, 0.15, -0.22),
      ])
      .addPosTrack(
        'LeftLegPivot',
        crouchToProneTimes,
        [0.15, 0.65, 0, 0.15, 0.6, -0.01, 0.15, 0.36, -0.04, 0.15, 0.18, -0.05, 0.15, 0.14, -0.05]
      )
      .addPosTrack(
        'RightLegPivot',
        crouchToProneTimes,
        [
          -0.15, 0.65, 0, -0.15, 0.6, -0.01, -0.15, 0.36, -0.04, -0.15, 0.18, -0.05, -0.15, 0.14,
          -0.05,
        ]
      )
      .addQuatTrack('LeftLegPivot', crouchToProneTimes, [
        ...idQ,
        ...getQuat(0.15, 0, 0),
        ...getQuat(0.8, 0, 0),
        ...getQuat(1.5, 0, 0),
        ...getQuat(1.57, 0, 0),
      ])
      .addQuatTrack('RightLegPivot', crouchToProneTimes, [
        ...idQ,
        ...getQuat(0.15, 0, 0),
        ...getQuat(0.8, 0, 0),
        ...getQuat(1.5, 0, 0),
        ...getQuat(1.57, 0, 0),
      ])
      .build('crouch_to_prone', 1.15);

    const proneToCrouchTimes = [0.0, 0.3, 0.6, 0.85, 1.15];
    const proneToCrouchClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        proneToCrouchTimes,
        [0, 0.25, 0.33, 0, 0.48, 0.32, 0, 0.79, 0.25, 0, 1.03, 0.17, 0, 1.065, 0.152]
      )
      .addQuatTrack('Torso', proneToCrouchTimes, [
        ...getQuat(1.25, 0, 0),
        ...getQuat(1.1, 0, 0),
        ...getQuat(0.8, 0, 0),
        ...getQuat(0.5, 0, 0),
        ...getQuat(0.45, 0, 0),
      ])
      .addQuatTrack('HeadPivot', proneToCrouchTimes, [
        ...getQuat(-1.15, 0, 0),
        ...getQuat(-0.6, 0, 0),
        ...getQuat(-0.25, 0, 0),
        ...getQuat(-0.05, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addPosTrack('RightArmPivot', [0.0, 1.15], [-0.35, 0.25, 0, -0.35, 0.25, 0])
      .addPosTrack('LeftArmPivot', [0.0, 1.15], [0.35, 0.25, 0, 0.35, 0.25, 0])
      .addQuatTrack('RightArmPivot', proneToCrouchTimes, [
        ...getQuat(-2.38, -0.15, 0.22),
        ...getQuat(-1.85, -0.12, 0.2),
        ...getQuat(-1.1, 0, 0.1),
        ...getQuat(-0.25, 0, 0),
        ...idQ,
      ])
      .addQuatTrack('LeftArmPivot', proneToCrouchTimes, [
        ...getQuat(-2.38, 0.15, -0.22),
        ...getQuat(-1.85, 0.12, -0.2),
        ...getQuat(-1.1, 0, -0.1),
        ...getQuat(-0.25, 0, 0),
        ...idQ,
      ])
      .addPosTrack(
        'LeftLegPivot',
        proneToCrouchTimes,
        [0.15, 0.14, -0.05, 0.15, 0.3, -0.05, 0.15, 0.5, -0.02, 0.15, 0.67, 0, 0.15, 0.65, 0]
      )
      .addPosTrack(
        'RightLegPivot',
        proneToCrouchTimes,
        [-0.15, 0.14, -0.05, -0.15, 0.3, -0.05, -0.15, 0.5, -0.02, -0.15, 0.67, 0, -0.15, 0.65, 0]
      )
      .addQuatTrack('LeftLegPivot', proneToCrouchTimes, [
        ...getQuat(1.57, 0, 0),
        ...getQuat(1.2, 0, 0),
        ...getQuat(0.4, 0, 0),
        ...getQuat(0.05, 0, 0),
        ...idQ,
      ])
      .addQuatTrack('RightLegPivot', proneToCrouchTimes, [
        ...getQuat(1.57, 0, 0),
        ...getQuat(1.2, 0, 0),
        ...getQuat(0.4, 0, 0),
        ...getQuat(0.05, 0, 0),
        ...idQ,
      ])
      .build('prone_to_crouch', 1.15);

    // 9. Падение, смерть и ползание
    const fallTimes = [0.0, 0.18, 0.4, 0.65, 0.9];
    const fallBackClip = new AnimationTrackBuilder()
      .addPosTrack(
        'Torso',
        fallTimes,
        [0, 1.1, 0, 0, 0.85, -0.12, 0, 0.4, -0.28, 0, 0.16, -0.35, 0, 0.14, -0.35]
      )
      .addQuatTrack('Torso', fallTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.4, 0, 0),
        ...getQuat(-1.2, 0, 0),
        ...getQuat(-1.57, 0, 0),
        ...getQuat(-1.57, 0, 0),
      ])
      .addQuatTrack('HeadPivot', fallTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-0.3, 0, 0),
        ...getQuat(0.35, 0, 0),
        ...getQuat(-0.15, 0, 0),
        ...getQuat(0, 0, 0),
      ])
      .addQuatTrack('RightArmPivot', fallTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-1.7, -0.3, -0.45),
        ...getQuat(-1.1, -0.15, -0.35),
        ...getQuat(0.1, 0, -0.3),
        ...getQuat(0.05, -0.02, -0.18),
      ])
      .addQuatTrack('LeftArmPivot', fallTimes, [
        ...getQuat(0, 0, 0),
        ...getQuat(-1.7, 0.3, 0.45),
        ...getQuat(-1.1, 0.15, 0.35),
        ...getQuat(0.1, 0, 0.3),
        ...getQuat(0.05, 0.02, 0.18),
      ])
      .addPosTrack(
        'LeftLegPivot',
        fallTimes,
        [0.15, 0.65, 0, 0.15, 0.5, 0.15, 0.15, 0.3, 0.1, 0.15, 0.2, 0.05, 0.15, 0.14, 0.05]
      )
      .addPosTrack(
        'RightLegPivot',
        fallTimes,
        [-0.15, 0.65, 0, -0.15, 0.5, 0.15, -0.15, 0.3, 0.1, -0.15, 0.2, 0.05, -0.15, 0.14, 0.05]
      )
      .addQuatTrack('LeftLegPivot', fallTimes, [
        ...idQ,
        ...getQuat(-0.45, 0, 0),
        ...getQuat(-1.2, 0, 0),
        ...getQuat(-1.7, 0, 0),
        ...getQuat(-1.57, 0, 0),
      ])
      .addQuatTrack('RightLegPivot', fallTimes, [
        ...idQ,
        ...getQuat(-0.45, 0, 0),
        ...getQuat(-1.2, 0, 0),
        ...getQuat(-1.7, 0, 0),
        ...getQuat(-1.57, 0, 0),
      ])
      .build('fall_back', 0.9);

    const deadClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', [0.0, 1.0], [0, 0.14, -0.35, 0, 0.14, -0.35])
      .addQuatTrack('Torso', [0.0, 1.0], [...getQuat(-1.57, 0, 0), ...getQuat(-1.57, 0, 0)])
      .addQuatTrack(
        'HeadPivot',
        [0.0, 1.0],
        [...getQuat(-0.05, -0.12, -0.22), ...getQuat(-0.05, -0.12, -0.22)]
      )
      .addQuatTrack(
        'RightArmPivot',
        [0.0, 1.0],
        [...getQuat(0.08, -0.05, -0.28), ...getQuat(0.08, -0.05, -0.28)]
      )
      .addQuatTrack(
        'LeftArmPivot',
        [0.0, 1.0],
        [...getQuat(0.08, 0.05, 0.24), ...getQuat(0.08, 0.05, 0.24)]
      )
      .addPosTrack('LeftLegPivot', [0.0, 1.0], [0.15, 0.14, 0.05, 0.15, 0.14, 0.05])
      .addPosTrack('RightLegPivot', [0.0, 1.0], [-0.15, 0.14, 0.05, -0.15, 0.14, 0.05])
      .addQuatTrack(
        'LeftLegPivot',
        [0.0, 1.0],
        [...getQuat(-1.57, 0, 0.1), ...getQuat(-1.57, 0, 0.1)]
      )
      .addQuatTrack(
        'RightLegPivot',
        [0.0, 1.0],
        [...getQuat(-1.57, 0, -0.12), ...getQuat(-1.57, 0, -0.12)]
      )
      .build('dead', 1.0);

    // 10. Ползание по-пластунски (Prone crawl)
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
    const proneLegRot = getQuat(1.57, 0, 0);

    for (let i = 0; i <= crawlFrames; i++) {
      const time = (i / crawlFrames) * durationCrawl;
      crawlTimes.push(time);
      const cycle = (i / crawlFrames) * Math.PI * 2;

      const torsoY = 0.25 + Math.pow(Math.sin(cycle), 2) * 0.015;
      const bodyRollZ = -Math.sin(cycle) * 0.04;
      const bodyTwistY = -Math.cos(cycle) * 0.04;

      crawlTorsoP.push(0, torsoY, 0.33);
      crawlTorsoQ.push(...getQuat(1.25 + Math.sin(cycle * 2) * 0.02, bodyTwistY, bodyRollZ));
      crawlHeadQ.push(...getQuat(-1.15 + Math.sin(cycle * 2) * 0.02, -bodyTwistY * 0.5, 0));

      const armReach = Math.sin(cycle) * 0.12;
      crawlRArmP.push(-0.35, 0.25 + armReach, 0);
      crawlLArmP.push(0.35, 0.25 - armReach, 0);
      crawlRArmQ.push(...getQuat(-2.38 + armReach * 1.5, -0.15, 0.22));
      crawlLArmQ.push(...getQuat(-2.38 - armReach * 1.5, 0.15, -0.22));

      const legSlide = Math.sin(cycle) * 0.08;
      crawlLLegP.push(0.15, 0.14, -0.05 - legSlide);
      crawlRLegP.push(-0.15, 0.14, -0.05 + legSlide);
      crawlLegQ.push(...proneLegRot);
    }

    const proneCrawlClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', crawlTimes, crawlTorsoP)
      .addQuatTrack('Torso', crawlTimes, crawlTorsoQ)
      .addQuatTrack('HeadPivot', crawlTimes, crawlHeadQ)
      .addPosTrack('RightArmPivot', crawlTimes, crawlRArmP)
      .addPosTrack('LeftArmPivot', crawlTimes, crawlLArmP)
      .addQuatTrack('RightArmPivot', crawlTimes, crawlRArmQ)
      .addQuatTrack('LeftArmPivot', crawlTimes, crawlLArmQ)
      .addPosTrack('LeftLegPivot', crawlTimes, crawlLLegP)
      .addPosTrack('RightLegPivot', crawlTimes, crawlRLegP)
      .addQuatTrack('LeftLegPivot', crawlTimes, crawlLegQ)
      .addQuatTrack('RightLegPivot', crawlTimes, crawlLegQ)
      .build('prone_crawl', durationCrawl);

    // 11. Лежа (Prone idle)
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
    const proneLegQAll: number[] = [];
    const proneArmP: number[] = [-0.35, 0.25, 0];

    for (let i = 0; i <= proneFrames; i++) {
      const time = (i / proneFrames) * durationProne;
      proneTimes.push(time);
      const cycle = (i / proneFrames) * Math.PI * 2;
      const breathe = Math.sin(cycle) * 0.008;

      proneTorsoP.push(0, 0.25 + breathe, 0.33);
      proneTorsoQ.push(...getQuat(1.25 + Math.sin(cycle) * 0.015, 0, 0));
      proneHeadQ.push(...getQuat(-1.15 + Math.sin(cycle) * 0.02, 0, 0));
      proneRArmQ.push(...getQuat(-2.38, -0.15, 0.22));
      proneLArmQ.push(...getQuat(-2.38, 0.15, -0.22));
      proneLLegP.push(0.15, 0.14, -0.05);
      proneRLegP.push(-0.15, 0.14, -0.05);
      proneLegQAll.push(...proneLegRot);
    }

    const proneIdleClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', proneTimes, proneTorsoP)
      .addQuatTrack('Torso', proneTimes, proneTorsoQ)
      .addQuatTrack('HeadPivot', proneTimes, proneHeadQ)
      .addPosTrack('RightArmPivot', [0.0, durationProne], [...proneArmP, ...proneArmP])
      .addPosTrack('LeftArmPivot', [0.0, durationProne], [0.35, 0.25, 0, 0.35, 0.25, 0])
      .addQuatTrack('RightArmPivot', proneTimes, proneRArmQ)
      .addQuatTrack('LeftArmPivot', proneTimes, proneLArmQ)
      .addPosTrack('LeftLegPivot', proneTimes, proneLLegP)
      .addPosTrack('RightLegPivot', proneTimes, proneRLegP)
      .addQuatTrack('LeftLegPivot', proneTimes, proneLegQAll)
      .addQuatTrack('RightLegPivot', proneTimes, proneLegQAll)
      .build('prone_idle', durationProne);

    // 12. Прыжок и свободный полет в воздухе (Airborne)
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
    const torsoPitchBase = 0.08;

    for (let i = 0; i <= airborneFrames; i++) {
      const time = (i / airborneFrames) * durationAirborne;
      airborneTimes.push(time);
      const cycle = (i / airborneFrames) * Math.PI * 2;
      const floatY = Math.sin(cycle) * 0.015;
      const torsoSwayPitch = torsoPitchBase + Math.sin(cycle) * 0.02;
      const torsoRoll = Math.sin(cycle) * 0.015;

      airborneTorsoP.push(0, 1.1 + floatY, 0);
      airborneTorsoQ.push(...getQuat(torsoSwayPitch, 0, torsoRoll));
      airborneHeadQ.push(...getQuat(-torsoSwayPitch, 0, -torsoRoll));

      const armWave = Math.sin(cycle) * 0.06;
      airborneLArmQ.push(...getQuat(-0.28 + Math.cos(cycle) * 0.05, -0.1, 0.55 + armWave));
      airborneRArmQ.push(...getQuat(-0.28 + Math.cos(cycle) * 0.05, 0.1, -0.55 - armWave));

      airborneLLegP.push(0.15, 0.65, 0);
      airborneRLegP.push(-0.15, 0.65, 0);

      const legDrift = Math.sin(cycle) * 0.07;
      airborneLLegQ.push(...getQuat(legDrift, -0.04, 0.12));
      airborneRLegQ.push(...getQuat(-legDrift, 0.04, -0.12));
    }

    const airborneClip = new AnimationTrackBuilder()
      .addPosTrack('Torso', airborneTimes, airborneTorsoP)
      .addQuatTrack('Torso', airborneTimes, airborneTorsoQ)
      .addQuatTrack('HeadPivot', airborneTimes, airborneHeadQ)
      .addQuatTrack('LeftArmPivot', airborneTimes, airborneLArmQ)
      .addQuatTrack('RightArmPivot', airborneTimes, airborneRArmQ)
      .addPosTrack('LeftLegPivot', airborneTimes, airborneLLegP)
      .addPosTrack('RightLegPivot', airborneTimes, airborneRLegP)
      .addQuatTrack('LeftLegPivot', airborneTimes, airborneLLegQ)
      .addQuatTrack('RightLegPivot', airborneTimes, airborneRLegQ)
      .build('airborne', durationAirborne);

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
