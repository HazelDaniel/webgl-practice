namespace x {
// 2.2 — Draggable 2D Node Editor
const VSHADER_SOURCE = `
  attribute vec4 a_Position;
  attribute vec2 a_TexCoord;
  uniform mat4 u_ModelMatrix;
  uniform mat4 u_ProjMatrix;
  varying vec2 v_TexCoord;
  void main() {
    gl_Position = u_ProjMatrix * u_ModelMatrix * a_Position;
    v_TexCoord = a_TexCoord;
  }
`;

const FSHADER_SOURCE = `
  precision mediump float;
  uniform vec4 u_Color;
  uniform bool u_UseTexture;
  uniform sampler2D u_Sampler;
  varying vec2 v_TexCoord;
  void main() {
    if (u_UseTexture) {
      vec4 texColor = texture2D(u_Sampler, v_TexCoord);
      gl_FragColor = texColor;
    } else {
      gl_FragColor = u_Color;
    }
  }
`;

interface NodeData {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  texture: WebGLTexture;
  pickColor: [number, number, number];
  isSelected: boolean;
}

let gl: WebGL2RenderingContext;
let program: WebGLProgram;
let canvas: HTMLCanvasElement;
let textCanvas: HTMLCanvasElement;
let textCtx: CanvasRenderingContext2D;

let a_Position: number;
let a_TexCoord: number;
let u_ModelMatrix: WebGLUniformLocation;
let u_ProjMatrix: WebGLUniformLocation;
let u_Color: WebGLUniformLocation;
let u_UseTexture: WebGLUniformLocation;
let u_Sampler: WebGLUniformLocation;

let projMatrix = new Matrix4();
let modelMatrix = new Matrix4();

// FBO for picking
let pickFBO: WebGLFramebuffer;
let pickTexture: WebGLTexture;
let pickRenderBuffer: WebGLRenderbuffer;

// Geometry buffers
let vertexBuffer: WebGLBuffer;
let indexBuffer: WebGLBuffer;

// State
let nodes: NodeData[] = [];
let nextNodeId = 1;
let draggingNode: NodeData | null = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// UI
const btnAddNode = document.getElementById("btn-add-node") as HTMLButtonElement;
const btnDeleteNode = document.getElementById(
  "btn-delete-node"
) as HTMLButtonElement;

function resizeCanvasToDisplaySize(canvas: HTMLCanvasElement) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  const dpi = window.devicePixelRatio || 1;
  if (canvas.width !== width * dpi || canvas.height !== height * dpi) {
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    return true;
  }
  return false;
}

function main() {
  canvas = document.getElementById("webgl-canvas") as HTMLCanvasElement;
  textCanvas = document.getElementById("text-canvas") as HTMLCanvasElement;
  textCtx = textCanvas.getContext("2d")!;

  gl = canvas.getContext("webgl2", {
    preserveDrawingBuffer: true,
  }) as WebGL2RenderingContext;

  if (!gl) {
    console.error("WebGL 2 not supported");
    return;
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  initShaders();
  initBuffers();
  initPickFBO();

  setupEvents();

  // Create initial nodes
  addNode(100, 100, "Node 1");
  addNode(300, 150, "Node 2");

  requestAnimationFrame(render);
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  // Orthographic projection: origin at top-left, y points down
  gl.viewport(0, 0, canvas.width, canvas.height);
  projMatrix.setOrtho(0, canvas.width, canvas.height, 0, -1, 1);
  if (gl) initPickFBO(); // Recreate FBO to match new size
}

function initShaders() {
  const vShader = gl.createShader(gl.VERTEX_SHADER)!;
  gl.shaderSource(vShader, VSHADER_SOURCE);
  gl.compileShader(vShader);

  const fShader = gl.createShader(gl.FRAGMENT_SHADER)!;
  gl.shaderSource(fShader, FSHADER_SOURCE);
  gl.compileShader(fShader);

  program = gl.createProgram()!;
  gl.attachShader(program, vShader);
  gl.attachShader(program, fShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Link error:", gl.getProgramInfoLog(program));
  }

  gl.useProgram(program);

  a_Position = gl.getAttribLocation(program, "a_Position");
  a_TexCoord = gl.getAttribLocation(program, "a_TexCoord");
  u_ModelMatrix = gl.getUniformLocation(program, "u_ModelMatrix")!;
  u_ProjMatrix = gl.getUniformLocation(program, "u_ProjMatrix")!;
  u_Color = gl.getUniformLocation(program, "u_Color")!;
  u_UseTexture = gl.getUniformLocation(program, "u_UseTexture")!;
  u_Sampler = gl.getUniformLocation(program, "u_Sampler")!;
}

function initBuffers() {
  // A simple quad from (0,0) to (1,1). We'll scale it using modelMatrix.
  const vertices = new Float32Array([
    // X, Y,   U, V
    0.0,
    0.0,
    0.0,
    0.0, // Top-Left
    0.0,
    1.0,
    0.0,
    1.0, // Bottom-Left
    1.0,
    1.0,
    1.0,
    1.0, // Bottom-Right
    1.0,
    0.0,
    1.0,
    0.0, // Top-Right
  ]);
  const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

  vertexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  indexBuffer = gl.createBuffer()!;
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
}

function initPickFBO() {
  if (pickFBO) {
    gl.deleteFramebuffer(pickFBO);
    gl.deleteTexture(pickTexture);
    gl.deleteRenderbuffer(pickRenderBuffer);
  }

  pickFBO = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBO);

  pickTexture = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, pickTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    canvas.width,
    canvas.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    pickTexture,
    0
  );

  pickRenderBuffer = gl.createRenderbuffer()!;
  gl.bindRenderbuffer(gl.RENDERBUFFER, pickRenderBuffer);
  gl.renderbufferStorage(
    gl.RENDERBUFFER,
    gl.DEPTH_COMPONENT16,
    canvas.width,
    canvas.height
  );
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER,
    pickRenderBuffer
  );

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

function createTextTexture(
  text: string,
  width: number,
  height: number
): WebGLTexture {
  textCanvas.width = width;
  textCanvas.height = height;

  // Background
  textCtx.clearRect(0, 0, width, height);
  textCtx.fillStyle = "rgba(30, 41, 59, 0.8)"; // glassmorphism bg
  textCtx.beginPath();
  textCtx.roundRect(0, 0, width, height, 8);
  textCtx.fill();

  // Border
  textCtx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  textCtx.lineWidth = 2;
  textCtx.stroke();

  // Top header bar (darker)
  textCtx.fillStyle = "rgba(0, 0, 0, 0.3)";
  textCtx.beginPath();
  textCtx.roundRect(0, 0, width, 30, [8, 8, 0, 0]);
  textCtx.fill();

  // Header Title
  textCtx.fillStyle = "#f8fafc";
  textCtx.font = "600 14px Inter, sans-serif";
  textCtx.textBaseline = "middle";
  textCtx.fillText(text, 10, 15);

  // Fake Delete Icon
  textCtx.fillStyle = "#ef4444";
  textCtx.font = "14px Inter, sans-serif";
  textCtx.fillText("✕", width - 20, 15);

  // Body content
  textCtx.fillStyle = "#94a3b8";
  textCtx.font = "12px Inter, sans-serif";
  textCtx.fillText("Drag to move", 10, 50);

  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0); // Flipped Y because canvas top-left is 0,0
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    textCanvas
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return tex;
}

function addNode(x: number, y: number, text: string) {
  const id = nextNodeId++;
  const width = 220;
  const height = 180;

  // Create pick color based on ID (R=id, G=0, B=0 is fine for small amounts, but let's be safer)
  const r = id & 0xff;
  const g = (id >> 8) & 0xff;
  const b = (id >> 16) & 0xff;

  const texture = createTextTexture(text, width, height);

  nodes.push({
    id,
    x,
    y,
    width,
    height,
    text,
    texture,
    pickColor: [r / 255, g / 255, b / 255],
    isSelected: false,
  });
}

function setupEvents() {
  btnAddNode.addEventListener("click", () => {
    addNode(
      Math.random() * (canvas.width - 200) + 100,
      Math.random() * (canvas.height - 150) + 50,
      `Node ${nextNodeId}`
    );
  });

  btnDeleteNode.addEventListener("click", () => {
    nodes = nodes.filter((n) => !n.isSelected);
    btnDeleteNode.disabled = true;
  });

  canvas.addEventListener("mousedown", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const pickedId = pick(x, y);

    // Deselect all
    nodes.forEach((n) => (n.isSelected = false));
    btnDeleteNode.disabled = true;
    draggingNode = null;

    if (pickedId > 0) {
      const node = nodes.find((n) => n.id === pickedId);
      if (node) {
        node.isSelected = true;
        btnDeleteNode.disabled = false;

        // Start dragging
        draggingNode = node;
        dragOffsetX = x - node.x;
        dragOffsetY = y - node.y;

        // Bring to front
        nodes = nodes.filter((n) => n.id !== node.id);
        nodes.push(node);
      }
    }
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!draggingNode) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    draggingNode.x = x - dragOffsetX;
    draggingNode.y = y - dragOffsetY;
  });

  window.addEventListener("mouseup", () => {
    draggingNode = null;
  });
}

function pick(x: number, y: number): number {
  // Bind FBO and draw picking pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, pickFBO);
  // gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(1.0, 1.0, 1.0, 1.0); // ID 0 means nothing picked (white)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  drawNodes(true);

  // Read pixel
  const pixels = new Uint8Array(4);
  // gl.readPixels reads from bottom-left origin! Need to flip Y for picking coordinate
  const readY = canvas.height - y;
  gl.readPixels(x, readY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  if (pixels[0] === 255 && pixels[1] === 255 && pixels[2] === 255) {
    return 0; // Clicked background
  }

  // Reconstruct ID
  return pixels[0] + (pixels[1] << 8) + (pixels[2] << 16);
}

function drawNodes(picking: boolean) {
  gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.enableVertexAttribArray(a_Position);
  gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 16, 0);

  gl.enableVertexAttribArray(a_TexCoord);
  gl.vertexAttribPointer(a_TexCoord, 2, gl.FLOAT, false, 16, 8);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);

  gl.uniformMatrix4fv(u_ProjMatrix, false, projMatrix.elements);

  // Enable blending for textures, but disable it for picking!
  if (picking) {
    gl.disable(gl.BLEND);
  } else {
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  for (const node of nodes) {
    modelMatrix.setIdentity();
    modelMatrix.translate(node.x, node.y, 0.0);
    modelMatrix.scale(node.width, node.height, 1.0);
    gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

    if (picking) {
      gl.uniform1i(u_UseTexture, 0);
      gl.uniform4f(
        u_Color,
        node.pickColor[0],
        node.pickColor[1],
        node.pickColor[2],
        1.0
      );
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    } else {
      // 1. Draw selection glow if selected
      if (node.isSelected) {
        modelMatrix.setIdentity();
        modelMatrix.translate(node.x - 4, node.y - 4, 0.0);
        modelMatrix.scale(node.width + 8, node.height + 8, 1.0);
        gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);
        gl.uniform1i(u_UseTexture, 0);
        gl.uniform4f(u_Color, 0.23, 0.51, 0.96, 0.8); // Accent glow
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }

      // 2. Draw Text Texture (The node itself)
      modelMatrix.setIdentity();
      modelMatrix.translate(node.x, node.y, 0.0);
      modelMatrix.scale(node.width, node.height, 1.0);
      gl.uniformMatrix4fv(u_ModelMatrix, false, modelMatrix.elements);

      gl.uniform1i(u_UseTexture, 1);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, node.texture);
      gl.uniform1i(u_Sampler, 0);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }
  }
}

function render() {
  // Main pass
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.06, 0.09, 0.16, 1.0); // bg-dark
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  drawNodes(false);

  requestAnimationFrame(render);
}

main();
}
