const fs = require('fs');
let code = fs.readFileSync('src/scripts/task.ts', 'utf-8');

// 1. Interface
code = code.replace(
`  dragOffsetY: number;
  shaderLocation: {`,
`  dragOffsetY: number;
  panX: number;
  panY: number;
  zoom: number;
  bgColor: [number, number, number, number];
  theme: string;
  shaderLocation: {`
);

code = code.replace(
`    u_ModelMatrix: WebGLUniformLocation;
    u_ProjMatrix: WebGLUniformLocation;`,
`    u_ModelMatrix: WebGLUniformLocation;
    u_ViewMatrix: WebGLUniformLocation;
    u_ProjMatrix: WebGLUniformLocation;`
);

// 2. NodeEditor class properties
code = code.replace(
`  private modelMatrix: Matrix4 = new Matrix4();
  private projMatrix: Matrix4 = new Matrix4();`,
`  private modelMatrix: Matrix4 = new Matrix4();
  private viewMatrix: Matrix4 = new Matrix4();
  private projMatrix: Matrix4 = new Matrix4();
  private isPanning: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;`
);

// 3. Constructor event listeners
code = code.replace(
`    this.canvas.addEventListener("mousedown", (e) => {
      this.handlePick(e);
    });
    window.addEventListener("mousemove", (e) => {
      this.handleDrag(e);
    });
    window.addEventListener("mouseup", (e) => this.handleUnpick());`,
`    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 1) {
        this.isPanning = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else {
        this.handlePick(e);
      }
    });
    window.addEventListener("mousemove", (e) => {
      if (this.isPanning && this.state) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.state.panX += dx;
        this.state.panY += dy;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      } else {
        this.handleDrag(e);
      }
    });
    window.addEventListener("mouseup", (e) => {
      if (e.button === 1) {
        this.isPanning = false;
      } else {
        this.handleUnpick();
      }
    });
    this.canvas.addEventListener("wheel", (e) => {
      if (!this.state) return;
      e.preventDefault();
      const { left, top } = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - left;
      const mouseY = e.clientY - top;
      
      const zoomSensitivity = 0.001;
      const zoomFactor = 1.0 - (e.deltaY * zoomSensitivity);
      const newZoom = Math.max(0.1, Math.min(this.state.zoom * zoomFactor, 5.0));
      
      const scaleChange = newZoom / this.state.zoom;
      this.state.panX = mouseX - (mouseX - this.state.panX) * scaleChange;
      this.state.panY = mouseY - (mouseY - this.state.panY) * scaleChange;
      this.state.zoom = newZoom;
    }, { passive: false });`
);

// 4. screenToWorld method
code = code.replace(
`  handlePick(event: MouseEvent) {`,
`  screenToWorld(screenX: number, screenY: number) {
    if (!this.state) return { x: screenX, y: screenY };
    return {
      x: (screenX - this.state.panX) / this.state.zoom,
      y: (screenY - this.state.panY) / this.state.zoom
    };
  }

  handlePick(event: MouseEvent) {`
);

// 5. handlePick coords
code = code.replace(
`    const x = event.clientX - left;
    const y = event.clientY - top;

    const nodeId = this.pick(x, y);`,
`    const screenX = event.clientX - left;
    const screenY = event.clientY - top;

    const nodeId = this.pick(screenX, screenY);`
);

code = code.replace(
`    this.state.dragOffsetX = x - node.x;
    this.state.dragOffsetY = y - node.y;`,
`    const { x: worldX, y: worldY } = this.screenToWorld(screenX, screenY);
    this.state.dragOffsetX = worldX - node.x;
    this.state.dragOffsetY = worldY - node.y;`
);

// 6. handleDrag coords
code = code.replace(
`  handleDrag(event: MouseEvent) {
    if (!this.state || !this.state.draggingNode) return;
    const { left, top } = this.canvas.getBoundingClientRect();
    const x = event.clientX - left;
    const y = event.clientY - top;

    this.state.draggingNode.x = x - this.state.dragOffsetX;
    this.state.draggingNode.y = y - this.state.dragOffsetY;
  }`,
`  handleDrag(event: MouseEvent) {
    if (!this.state || !this.state.draggingNode) return;
    const { left, top } = this.canvas.getBoundingClientRect();
    const screenX = event.clientX - left;
    const screenY = event.clientY - top;
    
    const { x: worldX, y: worldY } = this.screenToWorld(screenX, screenY);

    this.state.draggingNode.x = worldX - this.state.dragOffsetX;
    this.state.draggingNode.y = worldY - this.state.dragOffsetY;
  }`
);

// 8. render
code = code.replace(
`  render() {
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    this.gl.clearColor(0.06, 0.09, 0.16, 1.0);`,
`  render() {
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    if (this.state) {
      const [r, g, b, a] = this.state.bgColor;
      this.gl.clearColor(r, g, b, a);
    } else {
      this.gl.clearColor(0.06, 0.09, 0.16, 1.0);
    }`
);

// 9. setupControls
code = code.replace(
`    this.addNodeButton = addNodeButton;
    this.deleteNodeButton = deleteNodeButton;
  }`,
`    this.addNodeButton = addNodeButton;
    this.deleteNodeButton = deleteNodeButton;

    const bgColorPicker = controlsContainer.querySelector("#bg-color-picker") as HTMLInputElement;
    if (bgColorPicker) {
      bgColorPicker.addEventListener("input", (e) => {
        const hex = (e.target as HTMLInputElement).value;
        const r = parseInt(hex.substring(1, 3), 16) / 255;
        const g = parseInt(hex.substring(3, 5), 16) / 255;
        const b = parseInt(hex.substring(5, 7), 16) / 255;
        if (this.state) this.state.bgColor = [r, g, b, 1.0];
      });
    }

    const themeSelector = controlsContainer.querySelector("#theme-selector") as HTMLSelectElement;
    if (themeSelector) {
      themeSelector.addEventListener("change", (e) => {
        if (!this.state) return;
        this.state.theme = (e.target as HTMLSelectElement).value;
        // Regenerate textures
        this.state.nodes.forEach(node => {
          this.gl.deleteTexture(node.texture);
          node.texture = this.createTextTexture(node.text, node.width, node.height, this.state!.theme);
        });
      });
    }
  }`
);

// addNode localized
code = code.replace(
`      // assuming canvas viewport is at least 140x120 to accommodate node size + margins
      const x = Math.random() * (width - 120) + 20;
      const y = Math.random() * (height - 100) + 20;`,
`      // Localized spawning based on current pan and zoom
      const screenX = Math.random() * (width - 200) + 100;
      const screenY = Math.random() * (height - 200) + 100;
      const { x, y } = this.screenToWorld(screenX, screenY);`
);

// 10. setDefaultState
code = code.replace(
`    const resState = {
      draggingNode: null,
      dragOffsetX: 0,
      dragOffsetY: 0,
      nextNodeID: 1,
      nodes: [],
      shaderLocation: {`,
`    const resState = {
      draggingNode: null,
      dragOffsetX: 0,
      dragOffsetY: 0,
      panX: 0,
      panY: 0,
      zoom: 1,
      bgColor: [0.06, 0.09, 0.16, 1.0],
      theme: 'dark',
      nextNodeID: 1,
      nodes: [],
      shaderLocation: {`
);

code = code.replace(
`        u_ModelMatrix: this.gl.getUniformLocation(
          this.program!,
          "u_ModelMatrix"
        ),
        u_ProjMatrix: this.gl.getUniformLocation(this.program!, "u_ProjMatrix"),`,
`        u_ModelMatrix: this.gl.getUniformLocation(
          this.program!,
          "u_ModelMatrix"
        ),
        u_ViewMatrix: this.gl.getUniformLocation(
          this.program!,
          "u_ViewMatrix"
        ),
        u_ProjMatrix: this.gl.getUniformLocation(this.program!, "u_ProjMatrix"),`
);

// 11. createTextTexture theme support
code = code.replace(
`  createTextTexture(text: string, width: number, height: number): WebGLTexture {`,
`  createTextTexture(text: string, width: number, height: number, theme: string = 'dark'): WebGLTexture {`
);

code = code.replace(
`    // Background
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
    this.textContext.fillText("Drag to move", 10, 50);`,
`    // Colors based on theme
    let bgFill = "rgba(30, 41, 59, 0.8)";
    let borderStroke = "rgba(255, 255, 255, 0.1)";
    let headerFill = "rgba(0, 0, 0, 0.3)";
    let titleFill = "#f8fafc";
    let bodyFill = "#94a3b8";

    if (theme === 'light') {
      bgFill = "rgba(248, 250, 252, 0.9)";
      borderStroke = "rgba(0, 0, 0, 0.1)";
      headerFill = "rgba(226, 232, 240, 1)";
      titleFill = "#0f172a";
      bodyFill = "#475569";
    } else if (theme === 'neon') {
      bgFill = "rgba(10, 10, 20, 0.9)";
      borderStroke = "#06b6d4";
      headerFill = "rgba(6, 182, 212, 0.2)";
      titleFill = "#cffafe";
      bodyFill = "#67e8f9";
    }

    // Background
    this.textContext.clearRect(0, 0, width, height);
    this.textContext.fillStyle = bgFill;
    this.textContext.beginPath();
    this.textContext.roundRect(0, 0, width, height, 8);
    this.textContext.fill();

    // Border
    this.textContext.strokeStyle = borderStroke;
    this.textContext.lineWidth = theme === 'neon' ? 2 : 1;
    this.textContext.stroke();

    // Top header bar
    this.textContext.fillStyle = headerFill;
    this.textContext.beginPath();
    this.textContext.roundRect(0, 0, width, 30, [8, 8, 0, 0]);
    this.textContext.fill();

    // Header Title
    this.textContext.fillStyle = titleFill;
    this.textContext.font = "600 14px Inter, sans-serif";
    this.textContext.textBaseline = "middle";
    this.textContext.fillText(text, 10, 15);

    // Fake Delete Icon
    this.textContext.fillStyle = "#ef4444";
    this.textContext.font = "14px Inter, sans-serif";
    this.textContext.fillText("✕", width - 20, 15);

    // Body content
    this.textContext.fillStyle = bodyFill;
    this.textContext.font = "12px Inter, sans-serif";
    this.textContext.fillText("Drag to move", 10, 50);`
);

// 12. addNode
code = code.replace(
`    const texture = this.createTextTexture(text, width, height);`,
`    const texture = this.createTextTexture(text, width, height, this.state.theme);`
);

// 13. drawNodes
code = code.replace(
`    this.gl.uniformMatrix4fv(
      this.state.shaderLocation.u_ProjMatrix,
      false,
      this.projMatrix.elements
    );`,
`    this.gl.uniformMatrix4fv(
      this.state.shaderLocation.u_ProjMatrix,
      false,
      this.projMatrix.elements
    );
    
    this.viewMatrix.setIdentity();
    this.viewMatrix.translate(this.state.panX, this.state.panY, 0);
    this.viewMatrix.scale(this.state.zoom, this.state.zoom, 1.0);
    
    this.gl.uniformMatrix4fv(
      this.state.shaderLocation.u_ViewMatrix,
      false,
      this.viewMatrix.elements
    );`
);

fs.writeFileSync('src/scripts/task.ts', code);
console.log('Update complete.');
