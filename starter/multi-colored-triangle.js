function resizeCanvasToDisplaySize(canvas) {
  const shouldResize =
    canvas.width !== canvas.clientWidth ||
    canvas.height !== canvas.clientHeight;

  if (shouldResize) {
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
  }

  return shouldResize;
}

function initShaders(gl, VS_SOURCE, FS_SOURCE) {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);

  //prettier-ignore
  if (!vertexShader) { console.warn("failed to create vertex shader"); return null; }
  //prettier-ignore
  if (!fragmentShader) { console.warn("failed to create fragment shader"); return null; }

  gl.shaderSource(vertexShader, VS_SOURCE);
  gl.compileShader(vertexShader);

  gl.shaderSource(fragmentShader, FS_SOURCE);
  gl.compileShader(fragmentShader);

  let success = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);

  //prettier-ignore
  if (!success) { console.warn("failed to compile vertex shader. reason: ", gl.getShaderInfoLog(vertexShader)); gl.deleteShader(vertexShader); return null; }

  success = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);

  //prettier-ignore
  if (!success) { console.warn("failed to compile fragment shader. reason: ", gl.getShaderInfoLog(fragmentShader)); gl.deleteShader(fragmentShader); return null; }

  const program = gl.createProgram();

  //prettier-ignore
  if (!program) { console.warn("failed to create program"); return null; }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  success = gl.getProgramParameter(program, gl.LINK_STATUS);

  //prettier-ignore`
  if (!success) {
    console.warn(
      "failed to link program. reason: ",
      gl.getProgramInfoLog(program)
    );
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);
  gl.program = program;

  return program;
}

function initVerticesBuffer(gl, vertexComponentSize) {
  //prettier-ignore
  const vertices = new Float32Array(
    [0, 0.5,
    -0.25, -0.25,
    0.25, -0.25]);
  const buffer = gl.createBuffer();

  //prettier-ignore
  if (!buffer) { console.warn("failed to create buffer"); return -1; }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  return vertices.length / vertexComponentSize;
}

function run() {
  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl");
  const VS_SOURCE = document.getElementById("vertex-source").textContent;
  const FS_SOURCE = document.getElementById("fragment-source").textContent;

  //prettier-ignore
  if (!gl) { console.warn("your browser doesn't support webgl"); return; }

  //prettier-ignore
  if (!(initShaders(gl, VS_SOURCE, FS_SOURCE))) { console.error("failed to initialize shaders"); return; }

  resizeCanvasToDisplaySize(canvas);
  gl.viewport(0, 0, canvas.width, canvas.height);

  const vertexComponentSize = 2;

  const n = initVerticesBuffer(gl, vertexComponentSize);
  const aPositionLocation = gl.getAttribLocation(gl.program, "a_Position");

  gl.vertexAttribPointer(aPositionLocation, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(aPositionLocation);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  const U_ModelMatrixLocation = gl.getUniformLocation(
    gl.program,
    "u_ModelMatrix"
  );

  const U_DimensionLocation = gl.getUniformLocation(gl.program, "u_Dim");

  const modelMatrix = new Matrix4();
  gl.clear(gl.COLOR_BUFFER_BIT);

  gl.uniformMatrix4fv(U_ModelMatrixLocation, false, modelMatrix.elements);
  gl.uniform2f(U_DimensionLocation, canvas.width, canvas.height);
  // gl.uniformFloat
  gl.drawArrays(gl.TRIANGLES, 0, n);
}

document.addEventListener("DOMContentLoaded", () => {
  run();
});
