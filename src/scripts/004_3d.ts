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

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
}

function initVertexBuffers(
  gl: WebGLRenderingContext,
  positionLocation: number,
  colorLocation: number,
  NormLocation: number
) {
  // Vertex coordinates（a cuboid 3.0 in width, 10.0 in height, and 3.0 in length with its origin at the center of its bottom)
  //prettier-ignore
  const vertices = new Float32Array([
    1.5, 10.0, 1.5, 		-1.5, 10.0, 1.5, 		-1.5,  0.0, 1.5,  		1.5,  0.0, 1.5, 		// v0-v1-v2-v3 front
    1.5, 10.0, 1.5,  		1.5,  0.0, 1.5,  		1.5,  0.0,-1.5,  		1.5, 10.0,-1.5, 		// v0-v3-v4-v5 right
    1.5, 10.0, 1.5,  		1.5, 10.0,-1.5, 		-1.5, 10.0,-1.5, 		-1.5, 10.0, 1.5, 		// v0-v5-v6-v1 up
   -1.5, 10.0, 1.5, 		-1.5, 10.0,-1.5, 		-1.5,  0.0,-1.5, 		-1.5,  0.0, 1.5, 		// v1-v6-v7-v2 left
   -1.5,  0.0,-1.5,  		1.5,  0.0,-1.5,  		1.5,  0.0, 1.5, 		-1.5,  0.0, 1.5, 		// v7-v4-v3-v2 down
    1.5,  0.0,-1.5, 		-1.5,  0.0,-1.5, 		-1.5, 10.0,-1.5,  		1.5, 10.0,-1.5  // v4-v7-v6-v5 back
  ]);

  // Normal
  //prettier-ignore
  const normals = new Float32Array([
    0.0, 0.0, 1.0,  		0.0, 0.0, 1.0,  		0.0, 0.0, 1.0,  		0.0, 0.0, 1.0, 		// v0-v1-v2-v3 front
    1.0, 0.0, 0.0,  		1.0, 0.0, 0.0,  		1.0, 0.0, 0.0,  		1.0, 0.0, 0.0, 		// v0-v3-v4-v5 right
    0.0, 1.0, 0.0,  		0.0, 1.0, 0.0,  		0.0, 1.0, 0.0,  		0.0, 1.0, 0.0, 		// v0-v5-v6-v1 up
   -1.0, 0.0, 0.0, 		-1.0, 0.0, 0.0, 		-1.0, 0.0, 0.0, 		-1.0, 0.0, 0.0, 		// v1-v6-v7-v2 left
    0.0,-1.0, 0.0,  		0.0,-1.0, 0.0,  		0.0,-1.0, 0.0,  		0.0,-1.0, 0.0, 		// v7-v4-v3-v2 down
    0.0, 0.0,-1.0,  		0.0, 0.0,-1.0,  		0.0, 0.0,-1.0,  		0.0, 0.0,-1.0  // v4-v7-v6-v5 back
  ]);

  // Colors
  //prettier-ignore
  const colors = new Float32Array([
    0.0, 0.0, 1.0,  		0.0, 0.0, 1.0,  		0.0, 0.0, 1.0,  		0.0, 0.0, 1.0, 		// v0-v1-v2-v3 front
    1.0, 0.0, 0.0,  		1.0, 0.0, 0.0,  		1.0, 0.0, 0.0,  		1.0, 0.0, 0.0, 		// v0-v3-v4-v5 right
    0.0, 1.0, 0.0,  		0.0, 1.0, 0.0,  		0.0, 1.0, 0.0,  		0.0, 1.0, 0.0, 		// v0-v5-v6-v1 up
   1.0, 0.0, 0.0, 		1.0, 0.0, 0.0, 		1.0, 0.0, 0.0, 		1.0, 0.0, 0.0, 		// v1-v6-v7-v2 left
    0.0,1.0, 0.0,  		0.0,1.0, 0.0,  		0.0,1.0, 0.0,  		0.0,1.0, 0.0, 		// v7-v4-v3-v2 down
    0.0, 0.0,1.0,  		0.0, 0.0,1.0,  		0.0, 0.0,1.0,  		0.0, 0.0,1.0  // v4-v7-v6-v5 back
  ]);

  // Indices of the vertices
  //prettier-ignore
  const indices = new Uint8Array([
    0, 1, 2,      0, 2, 3, // front
    4, 5, 6,      4, 6, 7, // right
    8, 9, 10,     8, 10, 11, // up
    12, 13, 14,   12, 14, 15, // left
    16, 17, 18,   16, 18, 19, // down
    20, 21, 22,   20, 22, 23, // back
  ]);

  // Write the vertex property to buffers (coordinates and normals)
  if (!initArrayBuffer(gl, vertices, 3, gl.FLOAT, positionLocation)) return -1;
  if (!initArrayBuffer(gl, colors, 3, gl.FLOAT, colorLocation)) return -1;
  if (!initArrayBuffer(gl, normals, 3, gl.FLOAT, NormLocation)) return -1;

  // Unbind the buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // Write the indices to the buffer object
  const indexBuffer = gl.createBuffer();
  if (!indexBuffer) {
    console.log("Failed to create the buffer object");
    return -1;
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

  return indices.length;
}

function handleKeyDown(
  ev: KeyboardEvent,
  gl: WebGLRenderingContext,
  n: number,
  ViewProjMatrix: Matrix4,
  MVPMatrixLocation: WebGLUniformLocation,
  NormalMatrixLocation: WebGLUniformLocation
) {
  // console.log(+ev.keyCode);
  switch (+ev.keyCode) {
    // up arrow = 38, down arrow = 40, left arrow = 37, right arrow = 39
    case 38: {
      if (gJoint1Angle < 135) {
        gJoint1Angle += ANGLE_STEP;
        break;
      }
    }
    case 40: {
      if (gJoint1Angle > -135) {
        gJoint1Angle -= ANGLE_STEP;
        break;
      }
    }
    case 37: {
      gArm1Angle = (gArm1Angle - ANGLE_STEP) % 360;
      break;
    }
    case 39: {
      gArm1Angle = (gArm1Angle + ANGLE_STEP) % 360;
      break;
    }
    default:
      return;
  }

  draw(gl, n, ViewProjMatrix, MVPMatrixLocation, NormalMatrixLocation);
}

function draw(
  gl: WebGLRenderingContext,
  n: number,
  ViewProjMatrix: Matrix4,
  MVPMatrixLocation: WebGLUniformLocation,
  NormalMatrixLocation: WebGLUniformLocation
) {
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // ARM1
  /**
   *  set height to 10 units
   *  translate -12 units
   *  rotateY by gArm1Angle
   *  drawBox
   */
  const arm1Length = 10;
  gModelMatrix.setTranslate(0.0, -12.0, 0.0);
  gModelMatrix.rotate(gArm1Angle, 0.0, 1.0, 0.0);
  drawBox(gl, n, ViewProjMatrix, MVPMatrixLocation, NormalMatrixLocation);

  // ARM2
  /**
   *  translateY by height units
   *  rotateZ by gJoint1angleUnits
   *  scale along x-z plane by 0.3 units each
   *  drawBox
   */

  gModelMatrix.translate(0.0, arm1Length, 0.0);
  gModelMatrix.rotate(gJoint1Angle, 0.0, 0.0, 1.0);
  gModelMatrix.scale(1.3, 1.0, 1.3);

  drawBox(gl, n, ViewProjMatrix, MVPMatrixLocation, NormalMatrixLocation);
}

function drawBox(
  gl: WebGLRenderingContext,
  n: number,
  ViewProjMatrix: Matrix4,
  MVPMatrixLocation: WebGLUniformLocation,
  NormalMatrixLocation: WebGLUniformLocation
) {
  gMVPMatrix.set(ViewProjMatrix);
  gMVPMatrix.multiply(gModelMatrix);

  gNormalMatrix.setInverseOf(gModelMatrix);
  gNormalMatrix.transpose();

  gl.uniformMatrix4fv(MVPMatrixLocation, false, gMVPMatrix.elements);
  gl.uniformMatrix4fv(NormalMatrixLocation, false, gNormalMatrix.elements);

  gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_BYTE, 0.0);
}

const gModelMatrix = new Matrix4(),
  gNormalMatrix = new Matrix4(),
  gMVPMatrix = new Matrix4();

let gJoint1Angle = -90.0;
let gArm1Angle = 0.0;
const ANGLE_STEP = 3.0;

//prettier-ignore
function runRobotArmRender(canvas: HTMLCanvasElement, gl: WebGLRenderingContext): boolean {
  const u_MVPMat = gl.getUniformLocation((gl as any).program, "u_MVPMat");
  const u_NormalMat = gl.getUniformLocation((gl as any).program, "u_NormalMat"); // the normal matrix is re-calculated on every draw
  const u_LightColor = gl.getUniformLocation((gl as any).program, "u_LightColor");
  const u_LightDirection = gl.getUniformLocation((gl as any).program, "u_LightDirection");

  const lightColor = new Vector3([1.0, 1.0, 1.0]);
  const lightDirection = new Vector3([1.0, 3.0, 5.0]);

  const a_Color = gl.getAttribLocation((gl as any).program, "a_Color");
  const a_Position = gl.getAttribLocation((gl as any).program, "a_Position");
  const a_Norm = gl.getAttribLocation((gl as any).program, "a_Norm");

  if (a_Color < 0) { console.error("invalid location for a_Color returned"); return false; }
  //prettier-ignore
  if (a_Position < 0) { console.error("invalid location for a_Position returned"); return false; }
  if (a_Norm < 0) { console.error("invalid location for a_Norm returned"); return false; }
  //prettier-ignore
  if (!u_MVPMat) { console.error("invalid location for u_MVPMat returned"); return false;}
  //prettier-ignore
  if (!u_NormalMat) { console.error("invalid location for u_NormalMat returned"); return false;}
  //prettier-ignore
  if (!u_LightColor) { console.error("invalid location for u_LightColor returned"); return false; }
  //prettier-ignore
  if (!u_LightDirection) { console.error("invalid location for u_LightDirection returned"); return false; }


  gl.uniform3fv(u_LightColor, lightColor.elements);
  gl.uniform3fv(u_LightDirection, lightDirection.elements);


  resizeCanvasToDisplaySize(canvas);
  gl.viewport(0, 0, canvas.width, canvas.height);


  const viewProjMatrix = new Matrix4();

  viewProjMatrix.setPerspective(50.0, canvas.width / canvas.height, 1.0, 100.0);
  viewProjMatrix.lookAt(20.0, 10.0, 30.0, 		0.0, 0.0, 0.0, 		0.0, 1.0, 0.0);

  const n = initVertexBuffers(gl, a_Position, a_Color, a_Norm);

  //prettier-ignore
  if (n < 0) { console.error("invalid vertex count returned from buffer initialization!"); return false; }

  document.addEventListener("keydown", function (ev) {
    handleKeyDown(ev, gl, n, viewProjMatrix, u_MVPMat, u_NormalMat);
  })

  draw(gl, n, viewProjMatrix, u_MVPMat, u_NormalMat);

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
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.enable(gl.DEPTH_TEST);

  renderStatus = runRobotArmRender(canvas, gl);

  if (!renderStatus) return;
}
