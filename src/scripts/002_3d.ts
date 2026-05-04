document.addEventListener("DOMContentLoaded", run);

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

  //prettier-ignore
  const colors = new Float32Array([
    0.4, 0.4, 1.0,    0.4, 0.4, 1.0,    0.4, 0.4, 1.0,    0.4, 0.4, 1.0,
    0.4, 1.0, 0.4,    0.4, 1.0, 0.4,    0.4, 1.0, 0.4,    0.4, 1.0, 0.4,
    1.0, 0.4, 0.4,    1.0, 0.4, 0.4,    1.0, 0.4, 0.4,    1.0, 0.4, 0.4,
    1.0, 1.0, 0.4,    1.0, 1.0, 0.4,    1.0, 1.0, 0.4,    1.0, 1.0, 0.4,
    1.0, 0.4, 1.0,    1.0, 0.4, 1.0,    1.0, 0.4, 1.0,    1.0, 0.4, 1.0,
    0.4, 1.0, 1.0,    0.4, 1.0, 1.0,    0.4, 1.0, 1.0,    0.4, 1.0, 1.0
    
  ]);

  const vertices = new Float32Array([
    // Front
    -0.5, -0.5, 0.5, 1.0, 0.5, -0.5, 0.5, 1.0, 0.5, 0.5, 0.5, 1.0, -0.5, 0.5,
    0.5, 1.0,

    // Back
    -0.5, -0.5, -0.5, 1.0, -0.5, 0.5, -0.5, 1.0, 0.5, 0.5, -0.5, 1.0, 0.5, -0.5,
    -0.5, 1.0,

    // Left
    -0.5, -0.5, -0.5, 1.0, -0.5, -0.5, 0.5, 1.0, -0.5, 0.5, 0.5, 1.0, -0.5, 0.5,
    -0.5, 1.0,

    // Right
    0.5, -0.5, -0.5, 1.0, 0.5, 0.5, -0.5, 1.0, 0.5, 0.5, 0.5, 1.0, 0.5, -0.5,
    0.5, 1.0,

    // Top
    -0.5, 0.5, -0.5, 1.0, -0.5, 0.5, 0.5, 1.0, 0.5, 0.5, 0.5, 1.0, 0.5, 0.5,
    -0.5, 1.0,

    // Bottom
    -0.5, -0.5, -0.5, 1.0, 0.5, -0.5, -0.5, 1.0, 0.5, -0.5, 0.5, 1.0, -0.5,
    -0.5, 0.5, 1.0,
  ]);

  //prettier-ignore
  // const vertices = new Float32Array([
  //   -0.5, 0.5, 0.5, 1.0,          0.5, 0.5, 0.5, 1.0,
  //   -0.5, -0.5, 0.5, 1.0,         0.5, -0.5, 0.5, 1.0,

  //   0.5, 0.5, 0.5, 1.0,          0.5, 0.5, -0.5, 1.0,
  //   0.5, -0.5, -0.5, 1.0,          0.5, -0.5, 0.5, 1.0,

  //   -0.5, 0.5, -0.5, 1.0,          0.5, 0.5, -0.5, 1.0,
  //   -0.5, -0.5, -0.5, 1.0,         0.5, -0.5, -0.5, 1.0,

  //   -0.5, 0.5, 0.5, 1.0,          -0.5, 0.5, -0.5, 1.0,
  //   -0.5, -0.5, -0.5, 1.0,          -0.5, -0.5, 0.5, 1.0,

  //   -0.5, 0.5, 0.5, 1.0,          0.5, 0.5, 0.5, 1.0,
  //   0.5, 0.5, -0.5, 1.0,          -0.5, 0.5, -0.5, 1.0,

  //   -0.5, -0.5, 0.5, 1.0,          0.5, 0.5, 0.5, 1.0,
  //   0.5, -0.5, -0.5, 1.0,          -0.5, -0.5, -0.5, 1.0,

  // ]);

  //prettier-ignore
  const indices = new Uint8Array([
    0, 1, 2,        0, 2, 3,
    4, 5, 6,        4, 6, 7,
    8, 9, 10,        8, 10, 11,
    12, 13, 14,        12, 14, 15,
    16, 17, 18,        16, 18, 19,
    20, 21, 22,        20, 22, 23,
  ]);

  const indexBuffer = gl.createBuffer();
  //prettier-ignore
  if (!indexBuffer) { console.error("webgl couldn't create buffer!"); return false; }
  //prettier-ignore
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  //prettier-ignore
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  const a_color = gl.getAttribLocation((gl as any).program, "a_color");
  const a_position = gl.getAttribLocation((gl as any).program, "a_position");

  //prettier-ignore
  if (!initArrayBuffer(gl, vertices, 4, gl.FLOAT, a_position)) { return false; }
  //prettier-ignore
  if (!initArrayBuffer(gl, colors, 3, gl.FLOAT, a_color)) { return false; }

  //prettier-ignore
  const u_viewModelMat = gl.getUniformLocation( (gl as any).program, "u_viewModelMat");
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
  // projMat.setOrtho(-1.0, 1.0, -1.0, 1.0, 1.0, 9);

  gl.uniformMatrix4fv(u_ProjMat, false, projMat.elements);

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
