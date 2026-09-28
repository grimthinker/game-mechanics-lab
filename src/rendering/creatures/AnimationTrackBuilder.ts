import * as THREE from 'three';

export class AnimationTrackBuilder {
  private tracks: THREE.KeyframeTrack[] = [];
  private static tempEuler = new THREE.Euler();
  private static tempQuat = new THREE.Quaternion();

  public static eulerToQuat(
    x: number,
    y: number = 0,
    z: number = 0
  ): [number, number, number, number] {
    AnimationTrackBuilder.tempEuler.set(x, y, z);
    AnimationTrackBuilder.tempQuat.setFromEuler(AnimationTrackBuilder.tempEuler);
    return [
      AnimationTrackBuilder.tempQuat.x,
      AnimationTrackBuilder.tempQuat.y,
      AnimationTrackBuilder.tempQuat.z,
      AnimationTrackBuilder.tempQuat.w,
    ];
  }

  public addPosTrack(boneName: string, times: number[], values: number[]): this {
    this.tracks.push(new THREE.VectorKeyframeTrack(`${boneName}.position`, times, values));
    return this;
  }

  public addQuatTrack(boneName: string, times: number[], values: number[]): this {
    this.tracks.push(new THREE.QuaternionKeyframeTrack(`${boneName}.quaternion`, times, values));
    return this;
  }

  public addEulerTrack(
    boneName: string,
    times: number[],
    eulers: Array<[number, number, number]>
  ): this {
    const quats: number[] = [];
    for (const [x, y, z] of eulers) {
      const [qx, qy, qz, qw] = AnimationTrackBuilder.eulerToQuat(x, y, z);
      quats.push(qx, qy, qz, qw);
    }
    return this.addQuatTrack(boneName, times, quats);
  }

  public build(name: string, duration: number): THREE.AnimationClip {
    return new THREE.AnimationClip(name, duration, this.tracks);
  }

  /**
   * Создает идеальную зеркальную копию клипа относительно сагиттальной плоскости (X = 0).
   * Автоматически меняет кости Left <-> Right, инвертирует положение по X и повороты по Y/Z.
   */
  public static mirrorClip(
    clip: THREE.AnimationClip,
    newName: string,
    leftPrefix: string = 'Left',
    rightPrefix: string = 'Right'
  ): THREE.AnimationClip {
    const mirroredTracks: THREE.KeyframeTrack[] = [];

    for (const track of clip.tracks) {
      // Подмена имени кости Left <-> Right
      let newTrackName = track.name;
      if (track.name.includes(leftPrefix)) {
        newTrackName = track.name.replace(leftPrefix, '__TEMP_PREFIX__');
        newTrackName = newTrackName.replace(rightPrefix, leftPrefix);
        newTrackName = newTrackName.replace('__TEMP_PREFIX__', rightPrefix);
      } else if (track.name.includes(rightPrefix)) {
        newTrackName = track.name.replace(rightPrefix, leftPrefix);
      }

      if (track instanceof THREE.VectorKeyframeTrack) {
        const mirroredValues = new Float32Array(track.values.length);
        for (let i = 0; i < track.values.length; i += 3) {
          mirroredValues[i] = -track.values[i]; // Инверсия координаты X
          mirroredValues[i + 1] = track.values[i + 1];
          mirroredValues[i + 2] = track.values[i + 2];
        }
        mirroredTracks.push(
          new THREE.VectorKeyframeTrack(newTrackName, track.times, mirroredValues)
        );
      } else if (track instanceof THREE.QuaternionKeyframeTrack) {
        const mirroredValues = new Float32Array(track.values.length);
        for (let i = 0; i < track.values.length; i += 4) {
          mirroredValues[i] = track.values[i]; // qx сохраняется
          mirroredValues[i + 1] = -track.values[i + 1]; // qy инвертируется
          mirroredValues[i + 2] = -track.values[i + 2]; // qz инвертируется
          mirroredValues[i + 3] = track.values[i + 3]; // qw сохраняется
        }
        mirroredTracks.push(
          new THREE.QuaternionKeyframeTrack(newTrackName, track.times, mirroredValues)
        );
      } else {
        mirroredTracks.push(track.clone());
      }
    }

    return new THREE.AnimationClip(newName, clip.duration, mirroredTracks);
  }
}
