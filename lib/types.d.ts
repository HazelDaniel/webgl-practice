// types/cuon-matrix.d.ts

declare class Matrix4 {
  elements: Float32Array;

  constructor(src?: Matrix4);

  setIdentity(): Matrix4;
  set(src: Matrix4): Matrix4;

  concat(other: Matrix4): Matrix4;
  multiply(other: Matrix4): Matrix4;

  setTranslate(x: number, y: number, z: number): Matrix4;
  translate(x: number, y: number, z: number): Matrix4;

  setScale(x: number, y: number, z: number): Matrix4;
  scale(x: number, y: number, z: number): Matrix4;

  setRotate(angle: number, x: number, y: number, z: number): Matrix4;
  rotate(angle: number, x: number, y: number, z: number): Matrix4;

  setPerspective(fovy: number, aspect: number, near: number, far: number): Matrix4;
  perspective(fovy: number, aspect: number, near: number, far: number): Matrix4;

  setOrtho(left: number, right: number, bottom: number, top: number, near: number, far: number): Matrix4;
  ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Matrix4;

  setLookAt(
    eyeX: number, eyeY: number, eyeZ: number,
    centerX: number, centerY: number, centerZ: number,
    upX: number, upY: number, upZ: number
  ): Matrix4;

  lookAt(
    eyeX: number, eyeY: number, eyeZ: number,
    centerX: number, centerY: number, centerZ: number,
    upX: number, upY: number, upZ: number
  ): Matrix4;

  setInverseOf(other: Matrix4): Matrix4;
  invert(): Matrix4;

  transpose(): Matrix4;
}

declare class Vector3 {
  elements: Float32Array;

  constructor(src?: number[] | Float32Array);

  normalize(): Vector3;
}

declare class Vector4 {
  elements: Float32Array;

  constructor(src?: number[] | Float32Array);
}