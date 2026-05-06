document.addEventListener("DOMContentLoaded", run);

//@ts-ignore
const multiplyVector4 = function (mat: Matrix4, v: Coord4) {
  const e = mat.elements;

  return new Vector4([
    (e[0] as number) * v[0] +
      (e[4] as number) * v[1] +
      (e[8] as number) * v[2] +
      (e[12] as number) * v[3],
    (e[1] as number) * v[0] +
      (e[5] as number) * v[1] +
      (e[9] as number) * v[2] +
      (e[13] as number) * v[3],
    (e[2] as number) * v[0] +
      (e[6] as number) * v[1] +
      (e[10] as number) * v[2] +
      (e[14] as number) * v[3],
    (e[3] as number) * v[0] +
      (e[7] as number) * v[1] +
      (e[11] as number) * v[2] +
      (e[15] as number) * v[3],
  ]);
};

interface LookAtStruct {
  eyeX: number;
  eyeY: number;
  eyeZ: number;
  atX: number;
  atY: number;
  atZ: number;
  upX: number;
  upY: number;
  upZ: number;
}

type Coord4 = [number, number, number, number];
type Coord3 = [number, number, number];

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

function initShaders(
  gl: WebGLRenderingContext,
  vertexShaderSource: string,
  fragmentShaderSource: string
): boolean {
  if (!vertexShaderSource || !fragmentShaderSource) {
    console.error("Invalid shader source");
    return false;
  }
  let success = false;

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

  if (!vertexShader || !fragmentShader) {
    console.error("Failed to create shader");
    return false;
  }

  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.compileShader(vertexShader);
  success = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
  if (!success) {
    console.error(
      "Failed to compile vertex shader: " + gl.getShaderInfoLog(vertexShader)
    );
    gl.deleteShader(vertexShader);
    return false;
  }

  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.compileShader(fragmentShader);
  success = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
  if (!success) {
    console.error(
      "Failed to compile fragment shader: " +
        gl.getShaderInfoLog(fragmentShader)
    );
    gl.deleteShader(fragmentShader);
    return false;
  }

  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    console.error("Failed to link program: " + gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return false;
  }

  gl.useProgram(program);
  //@ts-ignore
  gl.program = program;

  return true;
}

function initArrayBuffer(
  gl: WebGLRenderingContext,
  data: Float32Array,
  num: number,
  type: number,
  attribLocation: number
): boolean {
  //prettier-ignore
  const buffer = gl.createBuffer();

  //prettier-ignore
  if (!buffer) { console.error("webgl couldn't create buffer!"); return false; }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);

  gl.enableVertexAttribArray(attribLocation);
  // console.log("number is ", num);
  gl.vertexAttribPointer(attribLocation, num, type, false, 0, 0);

  return true;
}

function draw(
  gl: WebGLRenderingContext,
  n: number,
  u_viewModelMat: WebGLUniformLocation,
  u_Proj: WebGLUniformLocation,
  viewModelMat: Matrix4,
  projMat: Matrix4,
  lookAtObj: LookAtStruct,
  canvas: HTMLCanvasElement
) {
  const { atX, atY, atZ, eyeX, eyeY, eyeZ, upX, upY, upZ } = lookAtObj;

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  viewModelMat.setLookAt(eyeX, eyeY, eyeZ, atX, atY, atZ, upX, upY, upZ);
  projMat.setPerspective(45, canvas.width / canvas.height, 1.0, 90.0);
  gl.uniformMatrix4fv(u_viewModelMat, false, viewModelMat.elements);
  gl.uniformMatrix4fv(u_Proj, false, projMat.elements);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  gl.polygonOffset(1.0, 1.0);

  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0);
}

function handleMouseDownRender(
  gl: WebGLRenderingContext,
  n: number,
  u_viewModelMat: WebGLUniformLocation,
  u_Proj: WebGLUniformLocation,
  viewModelMat: Matrix4,
  projMat: Matrix4,
  lookAtObj: LookAtStruct,
  e: MouseEvent,
  canvas: HTMLCanvasElement
) {
  const { clientLeft: left, clientTop: top, height, width } = canvas;
  let x = e.clientX - left - width / 2;
  let y = e.clientY - top - height / 2;

  x /= canvas.width / 4;
  y /= -canvas.height / 2;

  lookAtObj.eyeX = x;
  lookAtObj.eyeY = y;

  draw(
    gl,
    36,
    u_viewModelMat,
    u_Proj,
    viewModelMat,
    projMat,
    lookAtObj,
    canvas
  );
}

function run3dCubeViewRender(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext
): boolean {
  resizeCanvasToDisplaySize(canvas);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const colorsRaw = [
    0.4, 0.4, 1.0, 0.4, 0.4, 1.0, 0.4, 0.4, 1.0, 0.4, 0.4, 1.0, 0.4, 1.0, 0.4,
    0.4, 1.0, 0.4, 0.4, 1.0, 0.4, 0.4, 1.0, 0.4, 1.0, 0.4, 0.4, 1.0, 0.4, 0.4,
    1.0, 0.4, 0.4, 1.0, 0.4, 0.4, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0,
    0.0, 0.0, 1.0, 1.0, 0.4, 1.0, 1.0, 0.4, 1.0, 1.0, 0.4, 1.0, 1.0, 0.4, 1.0,
    0.4, 1.0, 1.0, 0.4, 1.0, 1.0, 0.4, 1.0, 1.0, 0.4, 1.0, 1.0,
  ];

  const colorsWhiteRaw = Array.from(
    colorsRaw,
    (_, i) => {
      if (i % 3 === 0) return 1.0;
      return 1.0;
    },
    { length: 24 }
  );

  //prettier-ignore
  let colors = new Float32Array(colorsRaw);

  colors = new Float32Array(colorsWhiteRaw);

  //prettier-ignore
  const vertices = new Float32Array([
    // Front
    -0.5, -0.5, 0.5, 1.0,   0.5, -0.5, 0.5, 1.0,    0.5, 0.5, 0.5, 1.0,   -0.5, 0.5, 0.5, 1.0,

    // Back
    -0.5, -0.5, -0.5, 1.0,    -0.5, 0.5, -0.5, 1.0,   0.5, 0.5, -0.5, 1.0,    0.5, -0.5, -0.5, 1.0,

    // Left
    -0.5, -0.5, -0.5, 1.0,    -0.5, -0.5, 0.5, 1.0,   -0.5, 0.5, 0.5, 1.0,    -0.5, 0.5, -0.5, 1.0,

    // Right
    0.5, -0.5, -0.5, 1.0,   0.5, 0.5, -0.5, 1.0,    0.5, 0.5, 0.5, 1.0,   0.5, -0.5, 0.5, 1.0,

    // Top
    -0.5, 0.5, -0.5, 1.0,   -0.5, 0.5, 0.5, 1.0,    0.5, 0.5, 0.5, 1.0,   0.5, 0.5, -0.5, 1.0,

    // Bottom
    -0.5, -0.5, -0.5, 1.0,    0.5, -0.5, -0.5, 1.0,   0.5, -0.5, 0.5, 1.0,    -0.5, -0.5, 0.5, 1.0,
  ]);

  //prettier-ignore
  const normals = new Float32Array([
    0.0, 0.0, 1.0, 1.0,       0.0, 0.0, 1.0, 1.0,     0.0, 0.0, 1.0, 1.0,     0.0, 0.0, 1.0, 1.0,
    0.0, 0.0, -1.0, 1.0,      0.0, 0.0, -1.0, 1.0,     0.0, 0.0, -1.0, 1.0,      0.0, 0.0, -1.0, 1.0,

    -1.0, 0.0, 0.0, 1.0,      -1.0, 0.0, 0.0, 1.0,     -1.0, 0.0, 0.0, 1.0,      -1.0, 0.0, 0.0, 1.0,
    1.0, 0.0, 0.0, 1.0,      1.0, 0.0, 0.0, 1.0,     1.0, 0.0, 0.0, 1.0,      1.0, 0.0, 0.0, 1.0,

    0.0, 1.0, 0.0, 1.0,      0.0, 1.0, 0.0, 1.0,     0.0, 1.0, 0.0, 1.0,      0.0, 1.0, 0.0, 1.0,
    0.0, -1.0, 0.0, 1.0,      0.0, -1.0, 0.0, 1.0,     0.0, -1.0, 0.0, 1.0,      0.0, -1.0, 0.0, 1.0,
  ])

  //prettier-ignore
  const indices = new Uint8Array([
    0, 1, 2,        0, 2, 3,
    4, 5, 6,        4, 6, 7,
    8, 9, 10,        8, 10, 11,
    12, 13, 14,        12, 14, 15,
    16, 17, 18,        16, 18, 19,
    20, 21, 22,        20, 22, 23,
  ]);

  const lightColor: Coord4 = [1.0, 0.0, 0.0, 1.0];
  const ambientLightColor: Vector3 = new Vector3([0.2, 0.0, 0.0]);
  // const lightDirection: Vector3 = new Vector3([2.0, 4.0, 5.0, 1.0]); // world coordinates
  const lightPosition: Vector3 = new Vector3([1.0, 3.0, 5.0]); // world coordinates

  // lightDirection.normalize();

  const indexBuffer = gl.createBuffer();
  //prettier-ignore
  if (!indexBuffer) { console.error("webgl couldn't create buffer!"); return false; }
  //prettier-ignore
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  //prettier-ignore
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const a_color = gl.getAttribLocation((gl as any).program, "a_color");
  const a_norm = gl.getAttribLocation((gl as any).program, "a_norm");
  const a_position = gl.getAttribLocation((gl as any).program, "a_position");

  //prettier-ignore
  const u_viewModelMat = gl.getUniformLocation( (gl as any).program, "u_viewModelMat");
  //prettier-ignore
  const u_LightColor = gl.getUniformLocation( (gl as any).program, "u_LightColor");
  //prettier-ignore
  const u_AmbientColor = gl.getUniformLocation( (gl as any).program, "u_AmbientColor");
  //prettier-ignore
  // const u_LightDirection = gl.getUniformLocation( (gl as any).program, "u_LightDirection");
  const u_LightPosition = gl.getUniformLocation( (gl as any).program, "u_LightPosition");
  const u_ProjMat = gl.getUniformLocation((gl as any).program, "u_Proj");
  const viewModelMat = new Matrix4();
  const projMat = new Matrix4();

  //prettier-ignore
  if (a_color < 0) { console.error("invalid location for a_color returned"); return false; }
  //prettier-ignore
  if (a_position < 0) { console.error("invalid location for a_position returned"); return false; }
  //prettier-ignore
  if (!u_viewModelMat) { console.error("invalid location for u_viewModelMat returned"); return false;}
  //prettier-ignore
  if (!u_ProjMat) { console.error("invalid location for u_Proj returned"); return false;}
  //prettier-ignore
  if (!u_LightColor) { console.error("invalid location for u_LightColor returned"); return false; }
  //prettier-ignore
  if (!u_AmbientColor) { console.error("invalid location for u_AmbientColor returned"); return false; }
  //prettier-ignore
  if (!u_LightPosition) { console.error("invalid location for u_LightPosition returned"); return false; }

  // projMat.setOrtho(-1.0, 1.0, -1.0, 1.0, 1.0, 9);

  //prettier-ignore
  if (!initArrayBuffer(gl, vertices, 4, gl.FLOAT, a_position)) { return false; }
  //prettier-ignore
  if (!initArrayBuffer(gl, colors, 3, gl.FLOAT, a_color)) { return false; }
  //prettier-ignore
  if (!initArrayBuffer(gl, normals, 4, gl.FLOAT, a_norm)) { return false; }

  gl.uniformMatrix4fv(u_ProjMat, false, projMat.elements);
  gl.uniform4f(u_LightColor, ...lightColor);
  // gl.uniform3fv(u_LightDirection, lightDirection.elements);
  gl.uniform3fv(u_LightPosition, lightPosition.elements);
  gl.uniform3fv(u_AmbientColor, ambientLightColor.elements);

  const lightPosView = [1.0, 3.0, 5.0, 1.0];
  let lightPosViewVec: Vector4;
  lightPosViewVec = multiplyVector4(viewModelMat, lightPosView as Coord4);
  gl.uniform3f(
    u_LightPosition,
    lightPosViewVec.elements[0] as number,
    lightPosViewVec.elements[1] as number,
    lightPosViewVec.elements[2] as number
  );

  const globalLookAtObject: LookAtStruct = {
    eyeX: 0.25,
    eyeY: 0.25,
    eyeZ: 3.1,
    atX: 0.0,
    atY: 0.0,
    atZ: 0.0,
    upX: 0.0,
    upY: 0.1,
    upZ: 0.0,
  };

  document.addEventListener("mousemove", (e) => {
    handleMouseDownRender(
      gl,
      24,
      u_viewModelMat,
      u_ProjMat,
      viewModelMat,
      projMat,
      globalLookAtObject,
      e,
      canvas
    );
  });

  return true;
}

function run() {
  const canvas = document.getElementById("webgl-canvas")! as HTMLCanvasElement;
  const gl = canvas.getContext("webgl");
  const fragmentShaderSource =
    document.getElementById("fragment-source")!.textContent ?? "";
  const vertexShaderSource =
    document.getElementById("vertex-source")!.textContent ?? "";
  let renderStatus = false;
  //prettier-ignore
  if (!gl) { console.error("your web browser does not support webgl"); return; }

  const shaderInitSuccess = initShaders(
    gl,
    vertexShaderSource,
    fragmentShaderSource
  );

  if (!shaderInitSuccess) return;

  // renderStatus = runTriangleRender(canvas, gl);
  renderStatus = run3dCubeViewRender(canvas, gl);
  if (!renderStatus) return;
}
