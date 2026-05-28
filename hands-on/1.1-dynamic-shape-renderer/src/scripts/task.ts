/* ═══════════════════════════════════════════════════════════════
   1.1 Dynamic Shape Renderer
   ═══════════════════════════════════════════════════════════════ */

// ─── Interfaces & Types ────────────────────────────────────────

interface ShapeGeometry {
  vertices: Float32Array;
  count: number;
  isFan?: boolean;
}

interface AppState {
  shape: "triangle" | "quad" | "circle" | "star";
  drawMode: "filled" | "wireframe" | "points";
  posX: number;
  posY: number;
  scale: number;
  rotation: number; // in degrees
  colorR: number;
  colorG: number;
  colorB: number;
  colorA: number;
  bgBrightness: number;
  showGrid: boolean;
  pointSize: number;
  segments: number;
}

interface MainShaderLocations {
  a_Position: number;
  u_Color: WebGLUniformLocation | null;
  u_PointSize: WebGLUniformLocation | null;
  u_ModelMat: WebGLUniformLocation | null;
}

interface GridShaderLocations {
  a_Position: number;
  u_Color: WebGLUniformLocation | null;
}

// ─── WebGL Initialization ─────────────────────────────────────

function initWebGL(canvas: HTMLCanvasElement): WebGLRenderingContext {
  const gl = canvas.getContext("webgl", {
    alpha: false,
    antialias: true,
    premultipliedAlpha: false,
  });

  if (!gl) {
    throw new Error(
      "WebGL not supported. Your browser or GPU may not support WebGL."
    );
  }

  return gl;
}

// ─── Shader Compilation ───────────────────────────────────────

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader object.");
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed: \n${info}`);
  }

  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);

  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create program object.");
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program linking failed:\n${info}`);
  }

  return program;
}

// ─── Geometry Generation ──────────────────────────────────────

function generateTriangle(): ShapeGeometry {
  const vertices = new Float32Array([0.0, 0.6, -0.5, -0.3, 0.5, -0.3]);
  return { vertices, count: 3 };
}

function generateQuad(): ShapeGeometry {
  //prettier-ignore
  const vertices = new Float32Array([
    -0.5, 0.5,     -0.5, -0.5,
    0.5, 0.5,      0.5, 0.5,
    -0.5, -0.5,     0.5, -0.5,
  ]);
  return { vertices, count: 6 };
}

function generateCircle(segments: number): ShapeGeometry {
  const verts = new Float32Array((segments + 2) * 2);
  const radius = 0.5;

  verts[0] = 0.0; // center x
  verts[1] = 0.0; // center x

  for (let i = 0; i <= segments; i++) {
    const ratio = i / segments;
    const angle = ratio * 2.0 * Math.PI;
    verts[(i + 1) * 2] = Math.cos(angle) * radius; // x
    verts[(i + 1) * 2 + 1] = Math.sin(angle) * radius; // y
  }

  return { vertices: verts, count: segments + 2, isFan: true };
}

function generateStar(): ShapeGeometry {
  const starPoints = 5;
  const totalPoints = starPoints * 2;
  const verts = new Float32Array((totalPoints + 2) * 2);
  const longRadius = 0.5;
  const shortRadius = 0.2;
  let radius = 0;

  verts[0] = 0.0;
  verts[1] = 0.0;

  for (let i = 0; i <= totalPoints; i++) {
    const ratio = i / totalPoints;
    const angle = ratio * 2.0 * Math.PI - Math.PI / 2;

    radius = i % 2 === 0 ? longRadius : shortRadius;
    verts[(i + 1) * 2] = Math.cos(angle) * radius; // x
    verts[(i + 1) * 2 + 1] = Math.sin(angle) * radius; // y
  }

  return { vertices: verts, count: totalPoints + 2, isFan: true };
}

// TODO:
function generateGrid(): ShapeGeometry {
  const lines: number[] = [];
  const divisions = 10;
  const step = 3.0 / divisions;

  for (let i = 0; i <= divisions; i++) {
    const pos = -1.0 + i * step;
    lines.push(pos, -1.0, pos, 1.0);
    lines.push(-1.0, pos, 1.0, pos);
  }

  return {
    vertices: new Float32Array(lines),
    count: lines.length / 2,
  };
}

// ─── Buffer Management ────────────────────────────────────────

function createBuffer(
  gl: WebGLRenderingContext,
  data: Float32Array
): WebGLBuffer {
  const buffer = gl.createBuffer();
  if (!buffer) {
    throw new Error("Failed to create WebGL buffer.");
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return buffer;
}

function updateBuffer(
  gl: WebGLRenderingContext,
  buffer: WebGLBuffer,
  data: Float32Array
): void {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
}

// ─── Application State ───────────────────────────────────────

const state: AppState = {
  shape: "triangle",
  drawMode: "filled",
  posX: 0.0,
  posY: 0.0,
  scale: 0.5,
  rotation: 0.0,
  colorR: 0.29,
  colorG: 0.56,
  colorB: 0.85,
  colorA: 1.0,
  bgBrightness: 0.08,
  showGrid: true,
  pointSize: 4.0,
  segments: 32,
};

const defaults: AppState = { ...state };

// ─── Main Application ─────────────────────────────────────────

/** GLOBAL VARIABLES  */
const gModelMat = new Matrix4();

/** EVENTS */
const renderEvent = new CustomEvent("gl-render");

function main(): void {
  const canvas = document.getElementById(
    "glCanvas"
  ) as HTMLCanvasElement | null;
  if (!canvas) {
    console.error("Canvas element glCanvas not found.");
    return;
  }

  const gl = initWebGL(canvas);

  const vertexShaderSrc = document.getElementById("vertex-shader")?.textContent;
  const fragmentShaderSrc =
    document.getElementById("fragment-shader")?.textContent;
  const gridVertexShaderSrc =
    document.getElementById("grid-vertex-shader")?.textContent;
  const gridFragmentShaderSrc = document.getElementById(
    "grid-fragment-shader"
  )?.textContent;

  if (
    !vertexShaderSrc ||
    !fragmentShaderSrc ||
    !gridVertexShaderSrc ||
    !gridFragmentShaderSrc
  ) {
    console.error("Shader sources not found in index.html.");
    return;
  }

  const mainProgram = createProgram(gl, vertexShaderSrc, fragmentShaderSrc);
  const gridProgram = createProgram(
    gl,
    gridVertexShaderSrc,
    gridFragmentShaderSrc
  );

  const mainLocs: MainShaderLocations = {
    a_Position: gl.getAttribLocation(mainProgram, "a_Position"),
    u_Color: gl.getUniformLocation(mainProgram, "u_Color"),
    u_PointSize: gl.getUniformLocation(mainProgram, "u_PointSize"),
    u_ModelMat: gl.getUniformLocation(mainProgram, "u_ModelMat"),
  };

  const gridLocs: GridShaderLocations = {
    a_Position: gl.getAttribLocation(gridProgram, "a_Position"),
    u_Color: gl.getUniformLocation(gridProgram, "u_Color"),
  };

  const triangleGeometry = generateTriangle();
  const quadGeometry = generateQuad();
  const circleGeometry = generateCircle(state.segments);
  const starGeometry = generateStar();

  const shapeBuffers = {
    triangle: createBuffer(gl, triangleGeometry.vertices),
    quad: createBuffer(gl, quadGeometry.vertices),
    circle: createBuffer(gl, circleGeometry.vertices),
    star: createBuffer(gl, starGeometry.vertices),
  };

  const gridData = generateGrid();
  const gridBuffer = createBuffer(gl, gridData.vertices);

  const shapeMeta: Record<AppState["shape"], ShapeGeometry> = {
    triangle: triangleGeometry,
    quad: quadGeometry,
    circle: circleGeometry,
    star: starGeometry,
  };

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  setupControls(gl, shapeBuffers, shapeMeta);

  let frameCount = 0;
  let lastFpsTime = performance.now();
  const fpsDisplay = document.getElementById("fpsCounter");

  function render(now?: number): void {
    const bg = state.bgBrightness;
    gl.clearColor(bg * 0.6, bg * 0.65, bg * 0.8, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (state.showGrid) {
      gl.useProgram(gridProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, gridBuffer);
      gl.vertexAttribPointer(gridLocs.a_Position, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(gridLocs.a_Position);
      gl.uniform4f(gridLocs.u_Color, 1.0, 1.0, 1.0, 0.06);
      gl.drawArrays(gl.LINES, 0, gridData.count);
    }

    gl.useProgram(mainProgram);
    const currentMeta = shapeMeta[state.shape];
    const currentBuffer = shapeBuffers[state.shape];

    gl.bindBuffer(gl.ARRAY_BUFFER, currentBuffer);
    gl.vertexAttribPointer(mainLocs.a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(mainLocs.a_Position);

    gl.uniform4f(
      mainLocs.u_Color,
      state.colorR,
      state.colorG,
      state.colorB,
      state.colorA
    );
    gl.uniform1f(mainLocs.u_PointSize, state.pointSize);
    syncGModelMatrixState();
    gl.uniformMatrix4fv(mainLocs.u_ModelMat, false, gModelMat.elements);

    let glDrawMode: number;
    if (state.drawMode === "points") {
      glDrawMode = gl.POINTS;
    } else if (state.drawMode === "wireframe") {
      glDrawMode = gl.LINE_LOOP;
    } else {
      glDrawMode = currentMeta.isFan ? gl.TRIANGLE_FAN : gl.TRIANGLES;
    }

    gl.drawArrays(glDrawMode, 0, currentMeta.count);
  }

  render();

  document.addEventListener("gl-render", () => {
    render();
  });
}

function syncGModelMatrixState() {
  gModelMat.setTranslate(state.posX, state.posY, 0.0);
  gModelMat.scale(state.scale, state.scale, 1.0);
  gModelMat.rotate(state.rotation, 0.0, 0.0, 1.0);
}

// ─── UI Controls Setup ────────────────────────────────────────

function setupControls(
  gl: WebGLRenderingContext,
  shapeBuffers: Record<AppState["shape"], WebGLBuffer>,
  shapeMeta: Record<AppState["shape"], ShapeGeometry>
): void {
  const shapeButtons = document.querySelectorAll(".shape-btn");
  shapeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      shapeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const selectedShape =
        ((btn as HTMLButtonElement).dataset.shape as
          | AppState["shape"]
          | null) || null;
      if (selectedShape) {
        state.shape = selectedShape;
      }

      const segRow = document.getElementById("segmentsRow");
      if (segRow) {
        segRow.style.display = state.shape === "circle" ? "" : "none";
      }
      document.dispatchEvent(renderEvent);
    });
  });

  const modeButtons = document.querySelectorAll(".mode-btn");
  modeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      modeButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const selectedMode = btn.getAttribute("data-mode") as
        | AppState["drawMode"]
        | null;
      if (selectedMode) {
        state.drawMode = selectedMode;
      }

      const pointSizeRow = document.getElementById("pointSizeRow");
      if (pointSizeRow) {
        pointSizeRow.style.display = state.drawMode === "points" ? "" : "none";
      }

      document.dispatchEvent(renderEvent);
    });
  });

  function bindSlider(
    inputId: string,
    outputId: string,
    stateKey: keyof AppState,
    formatter?: (v: string) => string
  ): void {
    const input = document.getElementById(inputId) as HTMLInputElement | null;
    const output = document.getElementById(
      outputId
    ) as HTMLOutputElement | null;
    if (!input || !output) return;

    const format = formatter || ((v: string) => parseFloat(v).toFixed(2));
    output.textContent = format(input.value);

    input.addEventListener("input", () => {
      const val = parseFloat(input.value);
      if (typeof state[stateKey] === "boolean") {
        (state as any)[stateKey] = input.value === "true";
      } else {
        switch (stateKey) {
          case "posX": {
            (state as any)[stateKey] = val;
            state.rotation = val;
            break;
          }
          case "posY": {
            (state as any)[stateKey] = val;
            state.posY = val;
            break;
          }
          case "scale": {
            (state as any)[stateKey] = val;
            state.scale = val;
            break;
          }
          case "rotation": {
            (state as any)[stateKey] = val;
            state.rotation = val;
            break;
          }
          default: {
            (state as any)[stateKey] = val;
          }
        }
      }
      output.textContent = format(input.value);

      if (["colorR", "colorG", "colorB", "colorA"].includes(stateKey)) {
        updateColorPreview();
      }

      document.dispatchEvent(renderEvent);
    });
  }

  bindSlider("posX", "posXVal", "posX");
  bindSlider("posY", "posYVal", "posY");
  bindSlider("scale", "scaleVal", "scale");
  bindSlider("rotation", "rotationVal", "rotation", (v) => `${v}°`);
  bindSlider("colorR", "colorRVal", "colorR");
  bindSlider("colorG", "colorGVal", "colorG");
  bindSlider("colorB", "colorBVal", "colorB");
  bindSlider("colorA", "colorAVal", "colorA");
  bindSlider("bgBright", "bgBrightVal", "bgBrightness");
  bindSlider("pointSize", "pointSizeVal", "pointSize", (v) =>
    parseFloat(v).toFixed(1)
  );

  const segInput = document.getElementById(
    "segments"
  ) as HTMLInputElement | null;
  const segOutput = document.getElementById(
    "segmentsVal"
  ) as HTMLOutputElement | null;

  if (segInput && segOutput) {
    segInput.addEventListener("input", () => {
      state.segments = parseInt(segInput.value, 10);
      segOutput.textContent = String(state.segments);

      const newCircle = generateCircle(state.segments);
      shapeMeta.circle = newCircle;
      updateBuffer(gl, shapeBuffers.circle, newCircle.vertices);

      document.dispatchEvent(renderEvent);
    });
  }

  const showGridCheckbox = document.getElementById(
    "showGrid"
  ) as HTMLInputElement | null;
  if (showGridCheckbox) {
    showGridCheckbox.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      state.showGrid = target.checked;
      document.dispatchEvent(renderEvent);
    });
  }

  const btnReset = document.getElementById(
    "btnReset"
  ) as HTMLButtonElement | null;
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      Object.assign(state, { ...defaults });

      const setVal = (id: string, val: any) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.value = String(val);
      };

      const setTxt = (id: string, val: string) => {
        const el = document.getElementById(id) as HTMLElement | null;
        if (el) el.textContent = val;
      };

      setVal("posX", defaults.posX);
      setVal("posY", defaults.posY);
      setVal("scale", defaults.scale);
      setVal("rotation", defaults.rotation);
      setVal("colorR", defaults.colorR);
      setVal("colorG", defaults.colorG);
      setVal("colorB", defaults.colorB);
      setVal("colorA", defaults.colorA);
      setVal("bgBright", defaults.bgBrightness);
      setVal("pointSize", defaults.pointSize);
      setVal("segments", defaults.segments);

      const gridCheck = document.getElementById(
        "showGrid"
      ) as HTMLInputElement | null;
      if (gridCheck) gridCheck.checked = defaults.showGrid;

      setTxt("posXVal", defaults.posX.toFixed(2));
      setTxt("posYVal", defaults.posY.toFixed(2));
      setTxt("scaleVal", defaults.scale.toFixed(2));
      setTxt("rotationVal", `${defaults.rotation}°`);
      setTxt("colorRVal", defaults.colorR.toFixed(2));
      setTxt("colorGVal", defaults.colorG.toFixed(2));
      setTxt("colorBVal", defaults.colorB.toFixed(2));
      setTxt("colorAVal", defaults.colorA.toFixed(2));
      setTxt("bgBrightVal", defaults.bgBrightness.toFixed(2));
      setTxt("pointSizeVal", defaults.pointSize.toFixed(1));
      setTxt("segmentsVal", String(defaults.segments));

      shapeButtons.forEach((b) => b.classList.remove("active"));
      const activeShapeBtn = document.getElementById("btnTriangle");
      if (activeShapeBtn) activeShapeBtn.classList.add("active");

      modeButtons.forEach((b) => b.classList.remove("active"));
      const activeModeBtn = document.getElementById("btnFilled");
      if (activeModeBtn) activeModeBtn.classList.add("active");

      const pointSizeRow = document.getElementById("pointSizeRow");
      if (pointSizeRow) pointSizeRow.style.display = "none";

      const segmentsRow = document.getElementById("segmentsRow");
      if (segmentsRow) segmentsRow.style.display = "none";

      // const newCircle = generateCircle(defaults.segments);
      // shapeMeta.circle = newCircle;
      // updateBuffer(gl, shapeBuffers.circle, newCircle.vertices);

      updateColorPreview();
      document.dispatchEvent(renderEvent);
    });
  }

  updateColorPreview();

  const segmentsRow = document.getElementById("segmentsRow");
  if (segmentsRow) segmentsRow.style.display = "none";
}

// ─── Color Preview Helper ─────────────────────────────────────

function updateColorPreview(): void {
  const r = Math.round(state.colorR * 255);
  const g = Math.round(state.colorG * 255);
  const b = Math.round(state.colorB * 255);

  const swatch = document.getElementById("colorSwatch");
  const hexLabel = document.getElementById("colorHex");

  if (swatch) {
    swatch.style.background = `rgba(${r}, ${g}, ${b}, ${state.colorA})`;
  }

  if (hexLabel) {
    const hex =
      "#" +
      r.toString(16).padStart(2, "0").toUpperCase() +
      g.toString(16).padStart(2, "0").toUpperCase() +
      b.toString(16).padStart(2, "0").toUpperCase();
    hexLabel.textContent = hex;
  }
}

// ─── Entry Point ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", main);
