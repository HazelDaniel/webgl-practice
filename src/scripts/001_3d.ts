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

function initColorCoordsVerticesBuffer(
  gl: WebGLRenderingContext,
  componentPerVertex: number,
  componentGap: number
): number {
  //prettier-ignore
  const vertices = new Float32Array([
    -0.25, 0.4, 0.2, 1.0,       0.0, 1.0, 0.0,
    -0.4, -0.25, 0.2, 1.0,      0.0, 1.0, 0.0,
    0.0, -0.4, 0.2, 1.0,        0.0, 1.0, 0.0,

    -0.5, 0.65, 0.5, 1.0,       0.0, 1.0, 1.0,
    -0.65, -0.5, 0.5, 1.0,      0.0, 1.0, 1.0,
    0.0, -0.65, 0.5, 1.0,        0.0, 1.0, 1.0,

    -0.5, 0.65, 0.9, 1.0,       1.0, 0.0, 1.0,
    -0.65, -0.5, 0.9, 1.0,      1.0, 0.0, 1.0,
    0.0, -0.65, 0.9, 1.0,        1.0, 0.0, 1.0,
  ])

  const buffer = gl.createBuffer();

  if (componentPerVertex <= 0) {
    console.error("Invalid number of components per vertex");
    return -1;
  }

  if (!buffer) {
    console.error("Failed to create the buffer object");
    return -1;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  return vertices.length / (componentPerVertex + componentGap);
}

function handleMouseDownRender(
  gl: WebGLRenderingContext,
  n: number,
  u_viewModelMat: WebGLUniformLocation,
  viewModelMat: Matrix4,
  lookAtObj: LookAtStruct,
  e: MouseEvent,
  canvas: HTMLCanvasElement
) {
  const { clientLeft: left, clientTop: top, height, width } = canvas;
  let x = e.clientX - left - width / 2;
  let y = e.clientY - top - height / 2;

  x /= (canvas.width / 2);
  y /= (-canvas.height/2);

  lookAtObj.eyeX = x;
  lookAtObj.eyeY = y;
  draw(gl, n, u_viewModelMat, viewModelMat, lookAtObj);
}

function draw(
  gl: WebGLRenderingContext,
  n: number,
  u_viewModelMat: WebGLUniformLocation,
  viewModelMat: Matrix4,
  lookAtObj: LookAtStruct
) {
  const { atX, atY, atZ, eyeX, eyeY, eyeZ, upX, upY, upZ } = lookAtObj;
  viewModelMat.setLookAt(eyeX, eyeY, eyeZ, atX, atY, atZ, upX, upY, upZ);
  gl.uniformMatrix4fv(u_viewModelMat, false, viewModelMat.elements);
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.drawArrays(gl.TRIANGLES, 0, n);
}

function run3dTriangleViewRender(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext
): boolean {
  resizeCanvasToDisplaySize(canvas);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const positionComponentPerVertex = 4;
  const positionComponentGap = 3;
  const positionComponentStride = 7;

  const colorComponentPerVertex = 3;
  const colorComponentGap = 4;
  const colorComponentStride = 7;

  const n = initColorCoordsVerticesBuffer(
    gl,
    positionComponentPerVertex,
    positionComponentGap
  );

  if (n < 0) return false;

  const a_color = gl.getAttribLocation((gl as any).program, "a_color");
  const a_position = gl.getAttribLocation((gl as any).program, "a_position");
  //prettier-ignore
  const u_viewModelMat = gl.getUniformLocation( (gl as any).program, "u_viewModelMat");
  const viewModelMat = new Matrix4();

  //prettier-ignore
  if (a_color < 0) { console.error("invalid location for a_color returned"); return false; }
  //prettier-ignore
  if (a_position < 0) { console.error("invalid location for a_position returned"); return false; }
  //prettier-ignore
  if (!u_viewModelMat) { console.error("invalid location for u_viewModelMat returned"); return false;}

  gl.enableVertexAttribArray(a_position);
  gl.enableVertexAttribArray(a_color);

  gl.vertexAttribPointer(
    a_position,
    positionComponentPerVertex,
    gl.FLOAT,
    false,
    positionComponentStride * Float32Array.BYTES_PER_ELEMENT,
    0
  );
  gl.vertexAttribPointer(
    a_color,
    colorComponentPerVertex,
    gl.FLOAT,
    false,
    colorComponentStride * Float32Array.BYTES_PER_ELEMENT,
    positionComponentPerVertex * Float32Array.BYTES_PER_ELEMENT
  );

  const globalLookAtObject: LookAtStruct = {
    eyeX: 0.25,
    eyeY: 0.25,
    eyeZ: 0.2,
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
      n,
      u_viewModelMat,
      viewModelMat,
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
  renderStatus = run3dTriangleViewRender(canvas, gl);
  if (!renderStatus) return;
}
