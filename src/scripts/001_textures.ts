document.addEventListener("DOMContentLoaded", run);

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

function initVerticesBuffer(
  gl: WebGLRenderingContext,
  componentPerVertex: number,
  componentStride: number
): number {
  //prettier-ignore
  const vertices = new Float32Array([
    0.0, 0.5, 1.0, 0.0, 0.0, 1.0,
    -0.5, 0.5, 0.0, 0.0, 1.0, 1.0,
    -0.5, -0.5, 0.0, 1.0, 1.0, 1.0,

    -0.5, -0.5, 0.0, 0.0, 1.0, 1.0,
    0.0, -0.5, 1.0, 1.0, 0.0, 1.0,
    0.0, 0.5, 1.0, 0.0, 1.0, 1.0,
  ]);

  const buffer = gl.createBuffer();

  if (!componentPerVertex) {
    console.error("Invalid number of components per vertex");
    return -1;
  }

  if (!buffer) {
    console.error("Failed to create the buffer object");
    return -1;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  return vertices.length / (componentPerVertex + componentStride);
}

function initVertexBufferWithTexture(
  gl: WebGLRenderingContext,
  componentPerVertex: number,
  componentStride: number
): number {
  if (!componentPerVertex) {
    console.error("Invalid number of components per vertex");
    return -1;
  }

  //prettier-ignore
  const verticetexture = new Float32Array([
    -1.0, 1.0, 0.0, 0.1,
    -1.0, -1.0, 0.0, 0.0,
    1.0, 1.0, 1.0, 1.0,
    1.0, -1.0, 1.0, 0.0,
  ]);

  // const verticetexture = new Float32Array([
  //   -0.5, 0.5, 0.0, 1.0,
  //   -0.5, -0.5, 0.0, 0.0,
  //   0.5, 0.5, 1.0, 1.0,
  //   0.5, -0.5, 1.0, 0.0,
  // ]);

  const buffer = gl.createBuffer();

  if (!buffer) {
    console.error("Failed to create the buffer object");
    return -1;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, verticetexture, gl.STATIC_DRAW);

  return verticetexture.length / (componentPerVertex + componentStride);
}

function initTexture(gl: WebGLRenderingContext, n: number): boolean {
  const texture = gl.createTexture();
  const u_Sampler = gl.getUniformLocation((gl as any).program, "u_Sampler");
  const image = new Image();

  //prettier-ignore
  if (!texture) { console.error("Failed to create the texture object"); return false; }

  //prettier-ignore
  if (!image) { console.error("Failed to create the image object"); return false; }

  //prettier-ignore
  if (!u_Sampler) { console.error("Failed to get the storage location of u_Sampler"); return false; }

  //prettier-ignore
  image.addEventListener("load", () => loadTexture(gl, u_Sampler, n, texture, image));
  image.src = "/images/huey2.jpg";

  return true;
}

function loadTexture(
  gl: WebGLRenderingContext,
  u_Sampler: WebGLUniformLocation,
  n: number,
  texture: WebGLTexture,
  image: HTMLImageElement
) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);

  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

  gl.uniform1i(u_Sampler, 0);

  gl.drawArrays(gl.TRIANGLE_STRIP, 0, n);
}

function runImageTextureRender(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext
): boolean {
  const componentPerVertex = 2;
  const componentStride = 2;

  resizeCanvasToDisplaySize(canvas);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  //prettier-ignore
  const n = initVertexBufferWithTexture(gl, componentPerVertex, componentStride);

  //prettier-ignore
  if (n < 1) { console.error("Failed to set the positions of the vertices"); return false; }

  //prettier-ignore
  if (!initTexture(gl, n)) { console.error("Failed to initialize the texture."); return false; }

  const a_position = gl.getAttribLocation((gl as any).program, "a_position");
  const a_texcoord = gl.getAttribLocation((gl as any).program, "a_texcoord");

  //prettier-ignore
  if (a_position < 0) { console.error("Failed to get the storage location of a_position"); return false; }

  //prettier-ignore
  if (a_texcoord < 0) { console.error("Failed to get the storage location of a_texcoord"); return false; }

  //prettier-ignore
  gl.vertexAttribPointer( a_position, componentPerVertex, gl.FLOAT, false, (componentPerVertex + componentStride) * Float32Array.BYTES_PER_ELEMENT, 0);

  //prettier-ignore
  gl.vertexAttribPointer(a_texcoord, componentStride, gl.FLOAT, false, (componentPerVertex + componentStride) * Float32Array.BYTES_PER_ELEMENT, componentPerVertex * Float32Array.BYTES_PER_ELEMENT);

  gl.enableVertexAttribArray(a_position);
  gl.enableVertexAttribArray(a_texcoord);

  return true;
}

function runTriangleRender(
  canvas: HTMLCanvasElement,
  gl: WebGLRenderingContext
): boolean {
  const componentPerVertex = 2;
  const componentStride = 4;

  const n = initVerticesBuffer(gl, componentPerVertex, componentStride);
  if (n < 1) return false;

  resizeCanvasToDisplaySize(canvas);
  gl.viewport(0, 0, canvas.width, canvas.height);

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  const a_position = gl.getAttribLocation((gl as any).program, "a_position");
  const a_color = gl.getAttribLocation((gl as any).program, "a_color");
  const u_Dim = gl.getUniformLocation((gl as any).program, "u_Dim");

  if (a_position < 0) {
    console.error("Failed to get the storage location of a_position");
    return false;
  }

  if (!u_Dim) {
    console.error("Failed to get the storage location of u_Dim");
    return false;
  }

  gl.vertexAttribPointer(
    a_position,
    componentPerVertex,
    gl.FLOAT,
    false,
    (componentPerVertex + componentStride) * Float32Array.BYTES_PER_ELEMENT,
    0
  );

  gl.vertexAttribPointer(
    a_color,
    componentStride,
    gl.FLOAT,
    false,
    (componentPerVertex + componentStride) * Float32Array.BYTES_PER_ELEMENT,
    componentPerVertex * Float32Array.BYTES_PER_ELEMENT
  );
  gl.enableVertexAttribArray(a_position);
  gl.enableVertexAttribArray(a_color);

  gl.uniform2f(u_Dim, canvas.width, canvas.height);

  gl.drawArrays(gl.TRIANGLES, 0, n);

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
  renderStatus = runImageTextureRender(canvas, gl);
  if (!renderStatus) return;
}
