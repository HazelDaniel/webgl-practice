function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  let status = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (!status) {
    console.log(`shader source ====:${source}:====`);
    console.error(
      "shader failed to comiple. reason: ",
      gl.getShaderInfoLog(shader)
    );
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
  const program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  let status = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!status) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function generateRectangles(canvas) {
  const rects = [];
  const width = canvas.width;
  const height = canvas.height;

  for (let i = 0; i < 50; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    const w = Math.random() * 80 + 1;
    const h = Math.random() * 80 + 1;

    const x2 = x + w;
    const y2 = y + h;

    rects.push(
      x,
      y,
      x2,
      y,
      x,
      y2,

      x,
      y2,
      x2,
      y,
      x2,
      y2
    );
  }

  document.getElementById("rect-data").textContent = rects.join(",");
}

function run() {
  const canvas = document.getElementById("glcanvas");
  let gl = canvas.getContext("webgl");

  if (!gl) {
    console.log("no webgl for you!");
    return;
  }

  const vertexShaderSource =
    document.getElementById("vertex-shader").textContent;
  const fragmentShaderSource =
    document.getElementById("fragment-shader").textContent;

  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = createShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource
  );
  let program = createProgram(gl, vertexShader, fragmentShader);

  generateRectangles(canvas);

  const rawData = document.getElementById("rect-data").textContent;
  const vertices = new Float32Array(rawData.split(",")).map(Number);

  const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
  const resolutionLocation = gl.getUniformLocation(program, "u_resolution");

  let positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // webglUtils.resizeCanvasToDisplaySize();
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.useProgram(program);
  gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
  gl.enableVertexAttribArray(positionAttributeLocation);
  let size = 2;
  let type = gl.FLOAT;
  let normalized = false;
  let stride = 0;
  let offset = 0;
  gl.vertexAttribPointer(
    positionAttributeLocation,
    size,
    type,
    normalized,
    stride,
    offset
  );
  let primitive = gl.TRIANGLES;
  let iteration = vertices.length / 2;
  let offset_ = 0;
  gl.drawArrays(primitive, offset_, iteration);
}

document.addEventListener("DOMContentLoaded", () => {
  run();
});
