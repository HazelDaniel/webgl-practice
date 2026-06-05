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
  visible: boolean;
}

interface NodeEditorState {
  nodes: NodeData[];
  nextNodeID: number;
  draggingNode: NodeData | null;
  dragOffsetX: number;
  dragOffsetY: number;
  shaderLocation: {
    a_Position: number;
    a_TexCoord: number;
    u_ModelMatrix: WebGLUniformLocation;
    u_ProjMatrix: WebGLUniformLocation;
    u_Color: WebGLUniformLocation;
    u_UseTexture: WebGLUniformLocation;
    u_Sampler: WebGLUniformLocation;
  };
  pickFBO: WebGLFramebuffer;
  pickTexture: WebGLTexture;
  pickRenderBuffer: WebGLRenderbuffer;
  geometryNode: GeometryNode;
}

type geometryMeshType = "rounded-square";

// function drawNodes(picking: boolean) {}
// function pick(x: number, y: number): number {
// function addNode(x: number, y: number, text: string) {
// function createTextTexture(
// function initPickFBO() {
// function initBuffers() {
// function initShaders() {
// function resizeCanvas() {
// function setupUI

class GeometryNode {
  public vertexBuffer: WebGLBuffer | null = null;
  public indexBuffer: WebGLBuffer | null = null;

  constructor(private gl: WebGL2RenderingContext, meshType: geometryMeshType) {
    switch (meshType) {
      case "rounded-square": {
        this.generateSquareMesh();
        break;
      }
      default:
        break;
    }
  }

  generateSquareMesh() {
    //prettier-ignore
    const vertices = new Float32Array([
      // X, Y,   U, V
      0.0, 0.0, 0.0, 0.0, // Top-Left
      0.0, 1.0, 0.0, 1.0, // Bottom-Left
      1.0, 1.0, 1.0, 1.0, // Bottom-Right
      1.0, 0.0, 1.0, 0.0, // Top-Right
    ]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const vertexBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);

    const indexBuffer = this.gl.createBuffer()!;
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      indices,
      this.gl.STATIC_DRAW
    );

    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;
  }
}

class NodeEditor {
  private program: WebGLProgram | null = null;
  private textContext: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private textCanvas: HTMLCanvasElement;
  private gl: WebGL2RenderingContext;
  private state: NodeEditorState | null = null;

  private modelMatrix: Matrix4 = new Matrix4();
  private projMatrix: Matrix4 = new Matrix4();

  private static nodeEditor: NodeEditor | null = null;

  private addNodeButton: HTMLButtonElement | null = null;
  private deleteNodeButton: HTMLButtonElement | null = null;

  static create(
    canvasID: string,
    textCanvasID: string,
    fsSource: string,
    vsSource: string
  ) {
    if (this.nodeEditor) return this.nodeEditor;
    this.nodeEditor = new NodeEditor(
      canvasID,
      textCanvasID,
      fsSource,
      vsSource
    );
    return this.nodeEditor;
  }

  constructor(
    canvasID: string,
    textCanvasID: string,
    private fsSource: string,
    private vsSource: string
  ) {
    const resCanvas = document.getElementById(canvasID) as HTMLCanvasElement;
    const resTextCanvas = document.getElementById(
      textCanvasID
    ) as HTMLCanvasElement;
    if (!resCanvas) throw new Error("could not locate main canvas!");
    this.canvas = resCanvas;
    if (!resTextCanvas) throw new Error("could not locate text canvas!");
    this.textCanvas = resTextCanvas;
    const resGl = this.canvas.getContext(
      "webgl2",
      {}
    ) as WebGL2RenderingContext;
    if (!resGl) throw new Error("your browser doesn't support webgl2");
    this.gl = resGl;
    const resTextContext = this.textCanvas.getContext("2d");
    if (!resTextContext) throw new Error("your browser doesn't support canvas");
    this.textContext = resTextContext;
    this.setProgram();
    this.setDefaultState();
    this.setupControls();

    window.addEventListener("resize", (e) => this.resizeCanvas());

    this.resizeCanvas();
    this.canvas.addEventListener("mousedown", (e) => {
      this.handlePick(e);
    });
    window.addEventListener("mousemove", (e) => {
      this.handleDrag(e);
    });
    window.addEventListener("mouseup", (e) => this.handleUnpick());
  }

  handlePick(event: MouseEvent) {
    if (!this.state) return;
    const { left, top } = this.canvas.getBoundingClientRect();
    const x = event.clientX - left;
    const y = event.clientY - top;

    const nodeId = this.pick(x, y);
    const nodeIndex = this.state.nodes.findIndex((n) => n.id === nodeId);
    if (nodeIndex < 0) {
      return;
    }

    let node = this.state.nodes[nodeIndex];

    if (this.deleteNodeButton) this.deleteNodeButton.disabled = false;

    this.state.draggingNode = node;

    this.state.dragOffsetX = x - node.x;
    this.state.dragOffsetY = y - node.y;

    [node] = this.state.nodes.splice(nodeIndex, 1);

    this.state.nodes.forEach((node) => (node.isSelected = false));
    node.isSelected = true;
    this.state.nodes.push(node);
  }

  handleDrag(event: MouseEvent) {
    if (!this.state || !this.state.draggingNode) return;
    const { left, top } = this.canvas.getBoundingClientRect();
    const x = event.clientX - left;
    const y = event.clientY - top;

    this.state.draggingNode.x = x - this.state.dragOffsetX;
    this.state.draggingNode.y = y - this.state.dragOffsetY;
  }

  handleUnpick() {
    if (!this.state) return;
    this.state.draggingNode = null;
  }

  render() {
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(0.06, 0.09, 0.16, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    this.drawNodes(false);
    requestAnimationFrame(this.render.bind(this));
  }

  resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    // Orthographic projection: origin at top-left, y points down
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.projMatrix.setOrtho(
      0,
      this.canvas.width,
      this.canvas.height,
      0,
      -1,
      1
    );
    this.resetPickFBO();
  }

  resetPickFBO() {
    if (!this.state) return;

    let { pickFBO, pickTexture, pickRenderBuffer } = this.state;

    if (pickFBO) {
      this.gl.deleteFramebuffer(pickFBO);
      this.gl.deleteTexture(pickTexture);
      this.gl.deleteRenderbuffer(pickRenderBuffer);
    }

    this.state.pickFBO = this.gl.createFramebuffer()!;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.state.pickFBO);

    this.state.pickTexture = this.gl.createTexture()!;

    this.gl.bindTexture(this.gl.TEXTURE_2D, this.state.pickTexture);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.canvas.width,
      this.canvas.height,
      0,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      null
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );
    this.gl.framebufferTexture2D(
      this.gl.FRAMEBUFFER,
      this.gl.COLOR_ATTACHMENT0,
      this.gl.TEXTURE_2D,
      this.state.pickTexture,
      0
    );

    this.state.pickRenderBuffer = this.gl.createRenderbuffer()!;
    this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.state.pickRenderBuffer);
    this.gl.renderbufferStorage(
      this.gl.RENDERBUFFER,
      this.gl.DEPTH_COMPONENT16,
      this.canvas.width,
      this.canvas.height
    );
    this.gl.framebufferRenderbuffer(
      this.gl.FRAMEBUFFER,
      this.gl.DEPTH_ATTACHMENT,
      this.gl.RENDERBUFFER,
      this.state.pickRenderBuffer
    );

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  setupControls() {
    if (!this.state) return;

    const controlsContainer = document.getElementById(
      "controls-container"
    )! as HTMLDivElement;
    const addNodeButton = controlsContainer.querySelector(
      "#btn-add-node"
    )! as HTMLButtonElement;
    const deleteNodeButton = controlsContainer.querySelector(
      "#btn-delete-node"
    )! as HTMLButtonElement;

    addNodeButton.addEventListener("click", (e) => {
      const width = this.canvas.width;
      const height = this.canvas.height;

      // assuming canvas viewport is at least 140x120 to accommodate node size + margins
      const x = Math.random() * (width - 120) + 20;
      const y = Math.random() * (height - 100) + 20;

      const text = `Node ${this.state!.nextNodeID}`;
      this.addNode(x, y, text);
    });

    deleteNodeButton.addEventListener("click", (e) => {
      if (!this.state) return;
      const activeNode = this.state.nodes.find((node) => node.isSelected);
      if (activeNode) activeNode!.visible = false;
    });

    this.addNodeButton = addNodeButton;
    this.deleteNodeButton = deleteNodeButton;
  }

  validateStateLocations() {
    const locs = this.state!.shaderLocation;
    for (const [key, val] of Object.entries(locs)) {
      if (key.startsWith("a_")) {
        if ((val as number) < 0) {
          throw new Error(`${key} has an invalid location in program`);
        }
      } else if (key.startsWith("u_")) {
        if (!val) {
          throw new Error(`${key} has an invalid location in program`);
        }
      }
    }
  }

  setProgram() {
    const fragmentShader = this.gl.createShader(this.gl.FRAGMENT_SHADER);
    const vertexShader = this.gl.createShader(this.gl.VERTEX_SHADER);
    let success: boolean = false;

    //prettier-ignore
    if (!fragmentShader || !vertexShader) throw new Error("could not create shader object");

    this.gl.shaderSource(vertexShader, this.vsSource);
    this.gl.shaderSource(fragmentShader, this.fsSource);

    this.gl.compileShader(vertexShader);
    success = this.gl.getShaderParameter(vertexShader, this.gl.COMPILE_STATUS);
    //prettier-ignore
    if (!success) {
      this.gl.deleteShader(vertexShader);
      throw new Error(`failed to compile vertex shader: ${this.gl.getShaderInfoLog(vertexShader)}`);
    }

    this.gl.compileShader(fragmentShader);
    success = this.gl.getShaderParameter(
      fragmentShader,
      this.gl.COMPILE_STATUS
    );
    //prettier-ignore
    if (!success) {
      this.gl.deleteShader(fragmentShader);
      throw new Error(`failed to compile fragment shader: ${this.gl.getShaderInfoLog(fragmentShader)}`);
    }

    const program = this.gl.createProgram()!;

    if (!program) {
      this.gl.deleteShader(vertexShader);
      this.gl.deleteShader(fragmentShader);
      throw new Error("failed to create program");
    }

    this.gl.attachShader(program, fragmentShader);
    this.gl.attachShader(program, vertexShader);
    this.gl.linkProgram(program);

    success = this.gl.getProgramParameter(program, this.gl.LINK_STATUS);

    if (!success) {
      this.gl.deleteShader(vertexShader);
      this.gl.deleteShader(fragmentShader);
      const message = `failed to link program: ${this.gl.getProgramInfoLog(
        program
      )}`;
      this.gl.deleteProgram(program);
      throw new Error(message);
    }

    this.program = program;
  }

  setDefaultState() {
    const resState = {
      draggingNode: null,
      dragOffsetX: 0,
      dragOffsetY: 0,
      nextNodeID: 1,
      nodes: [],
      shaderLocation: {
        a_Position: this.gl.getAttribLocation(this.program!, "a_Position"),
        a_TexCoord: this.gl.getAttribLocation(this.program!, "a_TexCoord"),
        u_Color: this.gl.getUniformLocation(this.program!, "u_Color"),
        u_ModelMatrix: this.gl.getUniformLocation(
          this.program!,
          "u_ModelMatrix"
        ),
        u_ProjMatrix: this.gl.getUniformLocation(this.program!, "u_ProjMatrix"),
        u_Sampler: this.gl.getUniformLocation(this.program!, "u_Sampler"),
        u_UseTexture: this.gl.getUniformLocation(this.program!, "u_UseTexture"),
      },
      geometryNode: new GeometryNode(this.gl, "rounded-square"),
      pickFBO: this.gl.createFramebuffer()!,
      pickRenderBuffer: this.gl.createRenderbuffer()!,
      pickTexture: this.gl.createTexture()!,
    } as NodeEditorState;
    this.state = resState;
    this.validateStateLocations();
  }

  createTextTexture(text: string, width: number, height: number): WebGLTexture {
    this.textCanvas.width = width;
    this.textCanvas.height = height;

    // Background
    this.textContext.clearRect(0, 0, width, height);
    this.textContext.fillStyle = "rgba(30, 41, 59, 0.8)"; // glassmorphism bg
    this.textContext.beginPath();
    this.textContext.roundRect(0, 0, width, height, 8);
    this.textContext.fill();

    // Border
    this.textContext.strokeStyle = "rgba(255, 255, 255, 0.1)";
    this.textContext.lineWidth = 2;
    this.textContext.stroke();

    // Top header bar (darker)
    this.textContext.fillStyle = "rgba(0, 0, 0, 0.3)";
    this.textContext.beginPath();
    this.textContext.roundRect(0, 0, width, 30, [8, 8, 0, 0]);
    this.textContext.fill();

    // Header Title
    this.textContext.fillStyle = "#f8fafc";
    this.textContext.font = "600 14px Inter, sans-serif";
    this.textContext.textBaseline = "middle";
    this.textContext.fillText(text, 10, 15);

    // Fake Delete Icon
    this.textContext.fillStyle = "#ef4444";
    this.textContext.font = "14px Inter, sans-serif";
    this.textContext.fillText("✕", width - 20, 15);

    // Body content
    this.textContext.fillStyle = "#94a3b8";
    this.textContext.font = "12px Inter, sans-serif";
    this.textContext.fillText("Drag to move", 10, 50);

    const tex = this.gl.createTexture()!;
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, 0); // Flipped Y because canvas top-left is 0,0
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      this.textCanvas
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );

    return tex;
  }

  addNode(x: number, y: number, text: string) {
    if (!this.state) return;

    const width = 180;
    const height = 150;

    const texture = this.createTextTexture(text, width, height);
    const id = ++this.state.nextNodeID;

    const r = id & 0xff;
    const g = (id >> 8) & 0xff;
    const b = (id >> 16) & 0xff;

    const newNode = {
      x,
      y,
      width,
      height,
      id,
      isSelected: false,
      pickColor: [r / 255, g / 255, b / 255],
      text,
      texture,
      visible: true,
    } as NodeData;

    this.state.nodes.push(newNode);
  }

  pick(x: number, y: number): number {
    let id = 0;
    if (!this.state) {
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      return id;
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.state.pickFBO);
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(1.0, 1.0, 1.0, 1.0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    const pixels = new Uint8Array(4);

    this.drawNodes(true);

    //prettier-ignore
    this.gl.readPixels(x, this.canvas.height - y, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);

    if (pixels[0] === 255 && pixels[1] === 255 && pixels[2] === 255) {
      this.state.nodes.forEach((node) => (node.isSelected = false));
      this.deleteNodeButton!.disabled = true;
      this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
      return id;
    }

    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);

    return pixels[0] + (pixels[1] << 8) + (pixels[2] << 16);
  }

  // TODO: cross-check
  drawNodes(picking?: boolean) {
    if (!this.state) return;
    if (!this.program) throw new Error("program not initialized");

    this.gl.useProgram(this.program);

    if (picking) {
      this.gl.disable(this.gl.BLEND);
    } else {
      this.gl.enable(this.gl.BLEND);
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }

    this.gl.bindBuffer(
      this.gl.ARRAY_BUFFER,
      this.state.geometryNode.vertexBuffer
    );
    this.gl.bindBuffer(
      this.gl.ELEMENT_ARRAY_BUFFER,
      this.state.geometryNode.indexBuffer
    );

    this.gl.vertexAttribPointer(
      this.state.shaderLocation.a_Position,
      2,
      this.gl.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0
    );
    this.gl.enableVertexAttribArray(this.state.shaderLocation.a_Position);

    this.gl.vertexAttribPointer(
      this.state.shaderLocation.a_TexCoord,
      2,
      this.gl.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT
    );
    this.gl.enableVertexAttribArray(this.state.shaderLocation.a_TexCoord);

    this.gl.uniformMatrix4fv(
      this.state.shaderLocation.u_ProjMatrix,
      false,
      this.projMatrix.elements
    );

    for (const node of this.state.nodes.filter((node) => node.visible)) {
      if (picking) {
        this.gl.uniform1i(this.state.shaderLocation.u_UseTexture, 0);
        this.gl.uniform4f(
          this.state.shaderLocation.u_Color,
          node.pickColor[0],
          node.pickColor[1],
          node.pickColor[2],
          1.0
        );
        this.modelMatrix.setIdentity();
        this.modelMatrix.translate(node.x, node.y, 0.0);
        this.modelMatrix.scale(node.width, node.height, 1.0);
        this.gl.uniformMatrix4fv(
          this.state.shaderLocation.u_ModelMatrix,
          false,
          this.modelMatrix.elements
        );
      } else {
        if (node.isSelected) {
          this.modelMatrix.setIdentity();
          this.modelMatrix.translate(node.x - 4, node.y - 4, 0.0);
          this.modelMatrix.scale(node.width + 8, node.height + 8, 1.0);
          this.gl.uniformMatrix4fv(
            this.state.shaderLocation.u_ModelMatrix,
            false,
            this.modelMatrix.elements
          );
          this.gl.uniform1i(this.state.shaderLocation.u_UseTexture, 0);
          this.gl.uniform4f(
            this.state.shaderLocation.u_Color,
            0.23,
            0.51,
            0.96,
            0.8
          ); // Accent glow
          this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
        }

        this.modelMatrix.setIdentity();
        this.modelMatrix.translate(node.x, node.y, 0.0);
        this.modelMatrix.scale(node.width, node.height, 1.0);
        this.gl.uniformMatrix4fv(
          this.state.shaderLocation.u_ModelMatrix,
          false,
          this.modelMatrix.elements
        );

        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, node.texture);

        this.gl.uniform1i(this.state.shaderLocation.u_UseTexture, 1);
        this.gl.uniform1i(this.state.shaderLocation.u_Sampler, 0);
      }
      // TODO: draw based on the geometry specified
      this.gl.drawElements(this.gl.TRIANGLES, 6, this.gl.UNSIGNED_SHORT, 0);
    }
  }
}

function init() {
  try {
    const fragmentShaderCode = document.getElementById("f-shader")?.textContent;
    const vertexShaderCode = document.getElementById("v-shader")?.textContent;

    //prettier-ignore
    if (!fragmentShaderCode || !vertexShaderCode) { throw new Error("shader code empty or missing!"); }

    //prettier-ignore
    const nodeEditor = NodeEditor.create("webgl-canvas", "2d-text-canvas", fragmentShaderCode, vertexShaderCode);
    nodeEditor.render();
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
