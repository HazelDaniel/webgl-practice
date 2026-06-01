type ShapeType = "cube" | "sphere";

type BufferLookupType = Record<ShapeType, WebGLBuffer>;

interface GeometryMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  normalLines: Float32Array; // Lines segments representing normals
}

type ShadingModelType = "gouraud" | "phong";

interface AppState {
  shape: ShapeType;
  shadingModel: ShadingModelType;
  showNormals: boolean;
  normalsOnly: boolean;

  // Material
  matR: number;
  matG: number;
  matB: number;
  matShininess: number;

  // Ambient Light
  ambientIntensity: number;
  ambientR: number;
  ambientG: number;
  ambientB: number;

  // Directional Light
  dirLightEnabled: boolean;
  dirLightX: number;
  dirLightY: number;
  dirLightZ: number;
  dirIntensity: number;
  dirR: number;
  dirG: number;
  dirB: number;

  // Point Light
  pointLightEnabled: boolean;
  pointPosX: number;
  pointPosY: number;
  pointPosZ: number;
  pointIntensity: number;
  pointR: number;
  pointG: number;
  pointB: number;

  // Rotation
  autoRotate: boolean;
  rotX: number;
  rotY: number;
}

interface ShaderLocations {
  a_Position: number;
  a_Normal: number;
  u_MvpMatrix: WebGLUniformLocation | null;
  u_ModelMatrix: WebGLUniformLocation | null;
  u_NormalMatrix: WebGLUniformLocation | null;

  // Shading specific uniforms
  u_EyePos: WebGLUniformLocation | null;
  u_AmbientLight: WebGLUniformLocation | null;
  u_DirLightColor: WebGLUniformLocation | null;
  u_DirLightDir: WebGLUniformLocation | null;
  u_DirLightIntensity: WebGLUniformLocation | null;
  u_PointLightColor: WebGLUniformLocation | null;
  u_PointLightPos: WebGLUniformLocation | null;
  u_PointLightIntensity: WebGLUniformLocation | null;
  u_MatDiffuse: WebGLUniformLocation | null;
  u_MatShininess: WebGLUniformLocation | null;
}

const state: AppState = {
  shape: "cube",
  shadingModel: "gouraud",
  showNormals: false,
  normalsOnly: false,

  // Material (Ruby Pinkish-Red)
  matR: 0.88,
  matG: 0.11,
  matB: 0.28,
  matShininess: 32,

  // Ambient Environment
  ambientIntensity: 0.15,
  ambientR: 1.0,
  ambientG: 1.0,
  ambientB: 1.0,

  // Directional Light (Sun)
  dirLightEnabled: true,
  dirLightX: 0.5,
  dirLightY: 0.7,
  dirLightZ: 0.5,
  dirIntensity: 0.7,
  dirR: 1.0,
  dirG: 1.0,
  dirB: 0.9,

  // Point Light (Bulb)
  pointLightEnabled: true,
  pointPosX: -0.8,
  pointPosY: 0.4,
  pointPosZ: 0.8,
  pointIntensity: 1.2,
  pointR: 0.0,
  pointG: 0.8,
  pointB: 1.0,

  // Rotation
  autoRotate: true,
  rotX: 0,
  rotY: 5,
};

const defaults: AppState = { ...state };
/**
 * Generate a standard 3D Cube.
 * 24 vertices (4 per face) to isolate normal mapping per side.
 */
function generateCube(): GeometryMesh {
  // Coordinates
  //prettier-ignore
  const positions = new Float32Array([
     // Front face
     -0.5, -0.5,  0.5,   0.5, -0.5,  0.5,   0.5,  0.5,  0.5,  -0.5,  0.5,  0.5,
     // Back face
     -0.5, -0.5, -0.5,  -0.5,  0.5, -0.5,   0.5,  0.5, -0.5,   0.5, -0.5, -0.5,
     // Top face
     -0.5,  0.5, -0.5,  -0.5,  0.5,  0.5,   0.5,  0.5,  0.5,   0.5,  0.5, -0.5,
     // Bottom face
     -0.5, -0.5, -0.5,   0.5, -0.5, -0.5,   0.5, -0.5,  0.5,  -0.5, -0.5,  0.5,
     // Right face
      0.5, -0.5, -0.5,   0.5,  0.5, -0.5,   0.5,  0.5,  0.5,   0.5, -0.5,  0.5,
     // Left face
     -0.5, -0.5, -0.5,  -0.5, -0.5,  0.5,  -0.5,  0.5,  0.5,  -0.5,  0.5, -0.5
  ]);

  // Normals
  //prettier-ignore
  const normals = new Float32Array([
    // Front face
    0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,   0.0, 0.0, 1.0,
    // Back face
    0.0, 0.0, -1.0,  0.0, 0.0, -1.0,  0.0, 0.0, -1.0,  0.0, 0.0, -1.0,
    // Top face
    0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,   0.0, 1.0, 0.0,
    // Bottom face
    0.0, -1.0, 0.0,  0.0, -1.0, 0.0,  0.0, -1.0, 0.0,  0.0, -1.0, 0.0,
    // Right face
    1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,   1.0, 0.0, 0.0,
    // Left face
    -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0,  -1.0, 0.0, 0.0
  ]);

  // Indices
  //prettier-ignore
  const indices = new Uint16Array([
    0, 1, 2,     0, 2, 3,    // front
    4, 5, 6,     4, 6, 7,    // back
    8, 9, 10,    8, 10, 11,  // top
    12, 13, 14,  12, 14, 15, // bottom
    16, 17, 18,  16, 18, 19, // right
    20, 21, 22,  20, 22, 23  // left
  ]);

  const normalLines = generateNormalVisualizerLines(positions, normals);

  return { positions, normals, indices, normalLines };
}

function generateNormalVisualizerLines(
  positions: Float32Array,
  normals: Float32Array
): Float32Array {
  const lineLength = 0.1;
  const lines: number[] = [];

  for (let i = 0; i < positions.length / 3; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];

    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    if (
      px === undefined ||
      py === undefined ||
      pz === undefined ||
      nx === undefined ||
      ny === undefined ||
      nz === undefined
    ) {
      continue;
    }

    // Point A (Mesh Base)
    lines.push(px, py, pz);
    // Point B (Normal Direction offset)
    lines.push(
      px + nx * lineLength,
      py + ny * lineLength,
      pz + nz * lineLength
    );
  }

  return new Float32Array(lines);
}

/**
 * Generate a procedural sphere mesh using latitude/longitude parametric parametrization.
 */
function generateSphere(latSegments = 30, lonSegments = 30): GeometryMesh {
  const radius = 0.7;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  let x = 0,
    y = 0,
    z = 0;

  for (let lat = 0; lat <= latSegments; lat++) {
    const theta = (lat * Math.PI) / latSegments;

    y = Math.cos(theta);

    for (let lon = 0; lon <= lonSegments; lon++) {
      const phi = (lon * Math.PI * 2) / lonSegments;

      x = Math.sin(theta) * Math.cos(phi);
      z = Math.sin(theta) * Math.sin(phi);

      positions.push(x * radius, y * radius, z * radius);

      normals.push(x, y, z);
    }
  }

  for (let lat = 0; lat < latSegments; lat++) {
    for (let lon = 0; lon < lonSegments; lon++) {
      let first = lat * (lonSegments + 1) + lon;
      let second = first + (lonSegments + 1);

      indices.push(first, first + 1, second);
      indices.push(first + 1, second, second + 1);
    }
  }

  const posArr = new Float32Array(positions);
  const normArr = new Float32Array(normals);
  const idxArr = new Uint16Array(indices);
  const normalLines = generateNormalVisualizerLines(posArr, normArr);

  return { positions: posArr, normals: normArr, indices: idxArr, normalLines };
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("Failed to create shader");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed:\n${log}`);
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link failed:\n${log}`);
  }
  return program;
}
// ── Step 2: Retrieve Uniform & Attribute Locations ──
function getLocations(
  gl: WebGLRenderingContext,
  program: WebGLProgram
): ShaderLocations {
  return {
    a_Position: gl.getAttribLocation(program, "a_Position"),
    a_Normal: gl.getAttribLocation(program, "a_Normal"),
    u_MvpMatrix: gl.getUniformLocation(program, "u_MvpMatrix"),
    u_ModelMatrix: gl.getUniformLocation(program, "u_ModelMatrix"),
    u_NormalMatrix: gl.getUniformLocation(program, "u_NormalMatrix"),
    u_EyePos: gl.getUniformLocation(program, "u_EyePos"),
    u_AmbientLight: gl.getUniformLocation(program, "u_AmbientLight"),
    u_DirLightColor: gl.getUniformLocation(program, "u_DirLightColor"),
    u_DirLightDir: gl.getUniformLocation(program, "u_DirLightDir"),
    u_DirLightIntensity: gl.getUniformLocation(program, "u_DirLightIntensity"),
    u_PointLightColor: gl.getUniformLocation(program, "u_PointLightColor"),
    u_PointLightPos: gl.getUniformLocation(program, "u_PointLightPos"),
    u_PointLightIntensity: gl.getUniformLocation(
      program,
      "u_PointLightIntensity"
    ),
    u_MatDiffuse: gl.getUniformLocation(program, "u_MatDiffuse"),
    u_MatShininess: gl.getUniformLocation(program, "u_MatShininess"),
  };
}

function validateLocations(
  locs: ReturnType<typeof getLocations>,
  shading: ShadingModelType
) {
  for (const [key, val] of Object.entries(locs)) {
    if (key.startsWith("a_")) {
      if (val < 0) {
        throw new Error(`${key} has an invalid location in ${shading} program`);
      }
    } else if (key.startsWith("u_")) {
      if (!val) {
        throw new Error(`${key} has an invalid location in ${shading} program`);
      }
    }
  }
}

function uploadMeshBuffers(
  gl: WebGL2RenderingContext,
  key: "cube" | "sphere",
  positionBuffers: BufferLookupType,
  normalBuffers: BufferLookupType,
  indexBuffers: BufferLookupType,
  normalLineBuffers: BufferLookupType,
  meshes: Record<ShapeType, GeometryMesh>
): void {
  const mesh = meshes[key];

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[key]);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.positions, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[key]);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.normals, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffers[key]);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.indices, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ARRAY_BUFFER, normalLineBuffers[key]);
  gl.bufferData(gl.ARRAY_BUFFER, mesh.normalLines, gl.STATIC_DRAW);
}

function setupUI(): void {
  // Bind simple shape selector
  const shapeSelect = document.getElementById(
    "shapeSelect"
  ) as HTMLSelectElement | null;
  const shapeDisplay = document.getElementById("shapeDisplay");
  if (shapeSelect) {
    shapeSelect.addEventListener("change", () => {
      state.shape = shapeSelect.value as "sphere" | "cube";
      if (shapeDisplay) {
        shapeDisplay.textContent =
          state.shape === "sphere" ? "Sphere (2,180 Verts)" : "Cube (24 Verts)";
      }
    });
  }

  // Shading model selector
  const modelSelect = document.getElementById(
    "shadingModelSelect"
  ) as HTMLSelectElement | null;
  const modelDisplay = document.getElementById("modelDisplay");
  if (modelSelect) {
    modelSelect.addEventListener("change", () => {
      console.log(modelSelect.value);
      state.shadingModel = modelSelect.value as "gouraud" | "phong";
      if (modelDisplay) {
        modelDisplay.textContent =
          state.shadingModel === "phong" ? "Phong Shading" : "Gouraud Shading";
      }
    });
  }

  // Normals checkbox
  const normalsCheckbox = document.getElementById(
    "showNormals"
  ) as HTMLInputElement | null;
  if (normalsCheckbox) {
    normalsCheckbox.addEventListener("change", (e) => {
      state.showNormals = (e.target as HTMLInputElement).checked;
    });
  }

  // Normals Only checkbox
  const normalsOnlyCheckbox = document.getElementById(
    "normalsOnly"
  ) as HTMLInputElement | null;
  if (normalsOnlyCheckbox) {
    normalsOnlyCheckbox.addEventListener("change", (e) => {
      const checked = (e.target as HTMLInputElement).checked;
      state.normalsOnly = checked;
      if (checked) {
        state.showNormals = true;
        if (normalsCheckbox) {
          normalsCheckbox.checked = true;
        }
      }
    });
  }

  // Light enables
  bindCheckbox("dirLightEnabled", "dirLightEnabled");
  bindCheckbox("pointLightEnabled", "pointLightEnabled");
  bindCheckbox("autoRotate", "autoRotate");

  // Sliders binding
  bindSlider("matR", "matRVal", "matR", updateMaterialSwatch);
  bindSlider("matG", "matGVal", "matG", updateMaterialSwatch);
  bindSlider("matB", "matBVal", "matB", updateMaterialSwatch);
  bindSlider("matShininess", "matShininessVal", "matShininess", (v) =>
    parseFloat(v).toFixed(0)
  );

  bindSlider("ambientIntensity", "ambientIntensityVal", "ambientIntensity");
  bindSlider("ambientR", "ambientRVal", "ambientR");
  bindSlider("ambientG", "ambientGVal", "ambientG");
  bindSlider("ambientB", "ambientBVal", "ambientB");

  bindSlider("dirLightX", "dirLightXVal", "dirLightX");
  bindSlider("dirLightY", "dirLightYVal", "dirLightY");
  bindSlider("dirLightZ", "dirLightZVal", "dirLightZ");
  bindSlider("dirIntensity", "dirIntensityVal", "dirIntensity");
  bindSlider("dirR", "dirRVal", "dirR");
  bindSlider("dirG", "dirGVal", "dirG");
  bindSlider("dirB", "dirBVal", "dirB");

  bindSlider("pointPosX", "pointPosXVal", "pointPosX");
  bindSlider("pointPosY", "pointPosYVal", "pointPosY");
  bindSlider("pointPosZ", "pointPosZVal", "pointPosZ");
  bindSlider("pointIntensity", "pointIntensityVal", "pointIntensity");
  bindSlider("pointR", "pointRVal", "pointR");
  bindSlider("pointG", "pointGVal", "pointG");
  bindSlider("pointB", "pointBVal", "pointB");

  bindSlider("rotX", "rotXVal", "rotX", (v) => `${Math.round(parseFloat(v))}°`);
  bindSlider("rotY", "rotYVal", "rotY", (v) => `${Math.round(parseFloat(v))}°`);

  // Bind Reset
  const btnReset = document.getElementById("btnReset");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      Object.assign(state, { ...defaults });

      // Update DOM selectors
      if (shapeSelect) {
        shapeSelect.value = defaults.shape;
        if (shapeDisplay) shapeDisplay.textContent = "Sphere (2,180 Verts)";
      }
      if (modelSelect) {
        modelSelect.value = defaults.shadingModel;
        if (modelDisplay) modelDisplay.textContent = "Phong Shading";
      }
      if (normalsCheckbox) normalsCheckbox.checked = defaults.showNormals;
      if (normalsOnlyCheckbox)
        normalsOnlyCheckbox.checked = defaults.normalsOnly;

      // Update checkboxes
      setCheckState("dirLightEnabled", defaults.dirLightEnabled);
      setCheckState("pointLightEnabled", defaults.pointLightEnabled);
      setCheckState("autoRotate", defaults.autoRotate);

      // Sliders & outputs
      resetSlider("matR", "matRVal", defaults.matR);
      resetSlider("matG", "matGVal", defaults.matG);
      resetSlider("matB", "matBVal", defaults.matB);
      resetSlider(
        "matShininess",
        "matShininessVal",
        defaults.matShininess,
        (v) => parseFloat(v).toFixed(0)
      );

      resetSlider(
        "ambientIntensity",
        "ambientIntensityVal",
        defaults.ambientIntensity
      );
      resetSlider("ambientR", "ambientRVal", defaults.ambientR);
      resetSlider("ambientG", "ambientGVal", defaults.ambientG);
      resetSlider("ambientB", "ambientBVal", defaults.ambientB);

      resetSlider("dirLightX", "dirLightXVal", defaults.dirLightX);
      resetSlider("dirLightY", "dirLightYVal", defaults.dirLightY);
      resetSlider("dirLightZ", "dirLightZVal", defaults.dirLightZ);
      resetSlider("dirIntensity", "dirIntensityVal", defaults.dirIntensity);
      resetSlider("dirR", "dirRVal", defaults.dirR);
      resetSlider("dirG", "dirGVal", defaults.dirG);
      resetSlider("dirB", "dirBVal", defaults.dirB);

      resetSlider("pointPosX", "pointPosXVal", defaults.pointPosX);
      resetSlider("pointPosY", "pointPosYVal", defaults.pointPosY);
      resetSlider("pointPosZ", "pointPosZVal", defaults.pointPosZ);
      resetSlider(
        "pointIntensity",
        "pointIntensityVal",
        defaults.pointIntensity
      );
      resetSlider("pointR", "pointRVal", defaults.pointR);
      resetSlider("pointG", "pointGVal", defaults.pointG);
      resetSlider("pointB", "pointBVal", defaults.pointB);

      resetSlider(
        "rotX",
        "rotXVal",
        defaults.rotX,
        (v) => `${Math.round(parseFloat(v))}°`
      );
      resetSlider(
        "rotY",
        "rotYVal",
        defaults.rotY,
        (v) => `${Math.round(parseFloat(v))}°`
      );

      updateMaterialSwatch();
    });
  }

  updateMaterialSwatch();
}

// ─── UI Helper Methods ──────────────────────────────────────────

function bindCheckbox(elementId: string, stateKey: keyof AppState): void {
  const el = document.getElementById(elementId) as HTMLInputElement | null;
  if (!el) return;
  el.addEventListener("change", (e) => {
    (state as any)[stateKey] = (e.target as HTMLInputElement).checked;
    console.log((state as any)[stateKey]);
  });
}

function setCheckState(elementId: string, checked: boolean): void {
  const el = document.getElementById(elementId) as HTMLInputElement | null;
  if (el) el.checked = checked;
}

function bindSlider(
  inputId: string,
  outputId: string,
  stateKey: keyof AppState,
  callback?: (v: string) => void
): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  const output = document.getElementById(outputId) as HTMLOutputElement | null;
  if (!input || !output) return;

  const defaultFormat = (v: string) => parseFloat(v).toFixed(2);

  input.addEventListener("input", () => {
    const val = parseFloat(input.value);
    (state as any)[stateKey] = val;

    // Format output
    if (callback) {
      callback(input.value);
    } else {
      output.textContent = defaultFormat(input.value);
    }
  });
}

function resetSlider(
  inputId: string,
  outputId: string,
  value: number,
  formatter?: (v: string) => string
): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  const output = document.getElementById(outputId) as HTMLOutputElement | null;
  if (input) input.value = String(value);
  if (output) {
    output.textContent = formatter
      ? formatter(String(value))
      : value.toFixed(2);
  }
}

function updateMaterialSwatch(value?: string): void {
  const r = Math.round(state.matR * 255);
  const g = Math.round(state.matG * 255);
  const b = Math.round(state.matB * 255);

  const swatch = document.getElementById("matSwatch");
  const hex = document.getElementById("matHex");
  const outputR = document.getElementById("matRVal");
  const outputG = document.getElementById("matGVal");
  const outputB = document.getElementById("matBVal");

  if (swatch) swatch.style.background = `rgb(${r}, ${g}, ${b})`;
  if (hex) {
    hex.textContent =
      "#" +
      r.toString(16).padStart(2, "0").toUpperCase() +
      g.toString(16).padStart(2, "0").toUpperCase() +
      b.toString(16).padStart(2, "0").toUpperCase();
  }

  // Ensure individual label updates match
  if (outputR) outputR.textContent = state.matR.toFixed(2);
  if (outputG) outputG.textContent = state.matG.toFixed(2);
  if (outputB) outputB.textContent = state.matB.toFixed(2);
}

document.addEventListener("DOMContentLoaded", main);

const meshes: Record<ShapeType, GeometryMesh> = {
  cube: generateCube(),
  sphere: generateSphere(),
};

function main() {
  try {
    const gouraudVertexSource =
      document.getElementById("gouraud-vs")?.textContent;
    const gouraudFragmentSource =
      document.getElementById("gouraud-fs")?.textContent;

    const phongVertexSource = document.getElementById("phong-vs")?.textContent;
    const phongFragmentSource =
      document.getElementById("phong-fs")?.textContent;

    const flatVertexSource = document.getElementById("flat-vs")?.textContent;
    const flatFragmentSource = document.getElementById("flat-fs")?.textContent;

    const canvas: HTMLCanvasElement = document.getElementById(
      "glCanvas"
    ) as HTMLCanvasElement;

    if (!canvas) {
      throw new Error("could not locate canvas");
    }

    if (!gouraudFragmentSource || !gouraudVertexSource) {
      throw new Error("one of the gouraud shaders could not be located!");
    }

    if (!phongFragmentSource || !phongVertexSource) {
      throw new Error("one of the phong shaders could not be located!");
    }

    if (!flatFragmentSource || !flatVertexSource) {
      throw new Error("one of the flat shaders could not be located!");
    }

    const gl: WebGL2RenderingContext = canvas.getContext("webgl2")!;

    if (!gl) {
      throw new Error("your browser doesn't support webgl!");
    }

    setupUI();

    let isGouraud = state.shadingModel === "gouraud";

    //prettier-ignore
    const phongProgram = createProgram(gl, phongVertexSource, phongFragmentSource);
    //prettier-ignore
    const gouraudProgram = createProgram(gl, gouraudVertexSource, gouraudFragmentSource);
    //prettier-ignore
    const flatProgram= createProgram(gl, flatVertexSource, flatFragmentSource);

    const phongLocation = getLocations(
      gl as WebGLRenderingContext,
      phongProgram
    );
    const gouraudLocation = getLocations(
      gl as WebGLRenderingContext,
      gouraudProgram
    );

    // Flat Shader Locations (line normal drawing)
    const flatLocation = {
      a_Position: gl.getAttribLocation(flatProgram, "a_Position"),
      u_MvpMatrix: gl.getUniformLocation(flatProgram, "u_MvpMatrix"),
      u_Color: gl.getUniformLocation(flatProgram, "u_Color"),
    };

    validateLocations(gouraudLocation, "gouraud");
    validateLocations(phongLocation, "phong");

    let currentShadingLocation: ShaderLocations = isGouraud
      ? gouraudLocation
      : phongLocation;
    let currentShadingProgram = isGouraud ? gouraudProgram : phongProgram;

    const positionBuffers: BufferLookupType = {
      cube: gl.createBuffer()!,
      sphere: gl.createBuffer()!,
    };

    const indexBuffers: BufferLookupType = {
      cube: gl.createBuffer()!,
      sphere: gl.createBuffer()!,
    };

    const normalBuffers: BufferLookupType = {
      cube: gl.createBuffer()!,
      sphere: gl.createBuffer()!,
    };

    const normalLineBuffers: BufferLookupType = {
      cube: gl.createBuffer()!,
      sphere: gl.createBuffer()!,
    };

    //prettier-ignore
    uploadMeshBuffers(gl, "sphere", positionBuffers, normalBuffers, indexBuffers, normalLineBuffers, meshes);
    uploadMeshBuffers(
      gl,
      "cube",
      positionBuffers,
      normalBuffers,
      indexBuffers,
      normalLineBuffers,
      meshes
    );

    const eyePosition = new Vector3([0.0, 0.0, 2]);
    gl.useProgram(gouraudProgram);
    gl.uniform3fv(gouraudLocation.u_EyePos, eyePosition.elements);
    gl.useProgram(phongProgram);
    gl.uniform3fv(phongLocation.u_EyePos, eyePosition.elements);

    gl.useProgram(currentShadingProgram);

    const gModelMat = new Matrix4();
    const gMVPMat = new Matrix4();
    const gViewMat = new Matrix4();
    const gProjMat = new Matrix4();
    const gNormalMat = new Matrix4();

    gViewMat.setLookAt(
      eyePosition.elements[0]!,
      eyePosition.elements[1]!,
      eyePosition.elements[2]!,
      0.0,
      0.0,
      0.0,
      0.0,
      1.0,
      0.0
    );

    gProjMat.setPerspective(
      52,
      canvas.width / Math.max(canvas.height, 1.0),
      1.0,
      10.0
    );

    let lastTime = performance.now();
    let tick = 0;
    const fpsDisplay = document.getElementById("fpsDisplay");
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.enable(gl.DEPTH_TEST);
    // gl.enable(gl.POLYGON_OFFSET_FILL);
    const Y_ANGLE_STEP = 0.5;

    function render(time: number) {
      isGouraud = state.shadingModel === "gouraud";
      tick++;

      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

      if (time - lastTime >= 1000) {
        if (fpsDisplay) fpsDisplay.textContent = `${tick} FPS`;
        tick = 0;
        lastTime = time;
      }

      //prettier-ignore
      currentShadingProgram = isGouraud ? gouraudProgram : phongProgram;
      currentShadingLocation = isGouraud ? gouraudLocation : phongLocation;

      let currentMesh: GeometryMesh = meshes[state.shape];
      let currentPositionBuffer: WebGLBuffer = positionBuffers[state.shape];
      let currentIndicesBuffer: WebGLBuffer = indexBuffers[state.shape];
      let currentNormalLinesBuffer: WebGLBuffer =
        normalLineBuffers[state.shape];
      let currentNormalsBuffer: WebGLBuffer = normalBuffers[state.shape];

      const { indices, normalLines, normals, positions } = currentMesh;

      gl.useProgram(currentShadingProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, currentPositionBuffer);
      //prettier-ignore
      gl.vertexAttribPointer(currentShadingLocation.a_Position, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(currentShadingLocation.a_Position);

      gl.bindBuffer(gl.ARRAY_BUFFER, currentNormalsBuffer);
      //prettier-ignore
      gl.vertexAttribPointer(currentShadingLocation.a_Normal, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(currentShadingLocation.a_Normal);

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, currentIndicesBuffer);

      const ambientLightColor = new Vector3([
        state.ambientR * state.ambientIntensity,
        state.ambientG * state.ambientIntensity,
        state.ambientB * state.ambientIntensity,
      ]);

      gl.uniform3fv(
        currentShadingLocation.u_AmbientLight,
        ambientLightColor.elements
      );

      // gl.uniform3fv(currentShadingLocation.u_EyePos, eyePosition.elements);

      const directionalLightColor = new Vector3([
        state.dirR,
        state.dirG,
        state.dirB,
      ]);

      const pointLightColor = new Vector3([
        state.pointR,
        state.pointG,
        state.pointB,
      ]);
      gl.uniform3fv(
        currentShadingLocation.u_PointLightColor,
        pointLightColor.elements
      );

      //prettier-ignore

      if (state.dirLightEnabled) {
      gl.uniform3fv(
        currentShadingLocation.u_DirLightColor,
        directionalLightColor.elements
      );
      const dlx = state.dirLightX;
      const dly = state.dirLightY;
      const dlz = state.dirLightZ;
      const len = Math.sqrt(dlx * dlx + dly * dly + dlz * dlz) || 1;
      gl.uniform3f(currentShadingLocation.u_DirLightDir, dlx / len, dly / len, dlz / len);
      gl.uniform1f(currentShadingLocation.u_DirLightIntensity, state.dirIntensity);
    } else {
      gl.uniform1f(currentShadingLocation.u_DirLightIntensity, 0.0);
    }

      if (state.pointLightEnabled) {
        const pointLightPosition = new Vector3([
          state.pointPosX,
          state.pointPosY,
          state.pointPosZ,
        ]);
        gl.uniform3fv(
          currentShadingLocation.u_PointLightPos,
          pointLightPosition.elements
        );

        gl.uniform1f(
          currentShadingLocation.u_PointLightIntensity,
          state.pointIntensity
        );
      } else {
        gl.uniform1f(currentShadingLocation.u_PointLightIntensity, 0.0);
      }

      const materialDiffuseColor = new Vector3([
        state.matR,
        state.matG,
        state.matB,
      ]);
      gl.uniform3fv(
        currentShadingLocation.u_MatDiffuse,
        materialDiffuseColor.elements
      );
      gl.uniform1f(currentShadingLocation.u_MatShininess, state.matShininess);

      if (state.autoRotate) {
        state.rotY = (state.rotY + Y_ANGLE_STEP) % 360;
        const rotYSlider = document.getElementById(
          "rotY"
        ) as HTMLInputElement | null;
        const rotYVal = document.getElementById("rotYVal");
        if (rotYSlider) rotYSlider.value = String(Math.round(state.rotY));
        if (rotYVal) rotYVal.textContent = `${Math.round(state.rotY)}°`;
      }

      gModelMat.setRotate(state.rotY, 0.0, 1.0, 0.0);
      gModelMat.rotate(state.rotX, 1.0, 0.0, 0.0);

      gMVPMat.set(gProjMat);
      gMVPMat.multiply(gViewMat);
      gMVPMat.multiply(gModelMat);

      gNormalMat.setInverseOf(gModelMat);
      gNormalMat.transpose();

      gl.useProgram(currentShadingProgram);
      //prettier-ignore
      gl.uniformMatrix4fv(currentShadingLocation.u_ModelMatrix, false, gModelMat.elements);
      //prettier-ignore
      gl.uniformMatrix4fv(currentShadingLocation.u_MvpMatrix, false, gMVPMat.elements);
      //prettier-ignore
      gl.uniformMatrix4fv(currentShadingLocation.u_NormalMatrix, false, gNormalMat.elements);

      if (!state.normalsOnly)
        gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);

      if (state.showNormals) {
        gl.useProgram(flatProgram);
        gl.bindBuffer(gl.ARRAY_BUFFER, currentNormalLinesBuffer);
        //prettier-ignore
        gl.vertexAttribPointer(flatLocation.a_Position, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(flatLocation.a_Position);
        gl.uniform4f(flatLocation.u_Color, 0.3, 0.3, 0.3, 1.0);
        //prettier-ignore
        gl.uniformMatrix4fv(flatLocation.u_MvpMatrix, false, gMVPMat.elements);

        gl.drawArrays(gl.LINES, 0, (positions.length / 3) * 2);
      }

      requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
  } catch (err) {
    console.error(
      `couldn't run main loop: ${
        err instanceof Error ? err.message : JSON.stringify(err)
      }`
    );
  }
}
