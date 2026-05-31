/* ═══════════════════════════════════════════════════════════════
   1.4 Lighting Lab — Main TypeScript Application
   
   CONCEPTS PRACTICED:
   • Math of Phong Reflection Model (Ambient, Diffuse, Specular)
   • Gouraud (Per-Vertex) vs Phong (Per-Fragment) shading pipelines
   • Normal vectors and Normal Matrix (Inverse-Transpose of Model Matrix)
   • Procedural 3D mesh generation (lat/lon Sphere parametrization)
   • Vertex Normals lines rendering (Visualizing normal vectors)
   • Directional light vectors and local Point Light source with distance attenuation
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ─── Interfaces & Types ────────────────────────────────────────

interface GeometryMesh {
  positions: Float32Array;
  normals: Float32Array;
  indices: Uint16Array;
  normalLines: Float32Array; // Lines segments representing normals
}

interface AppState {
  shape: 'sphere' | 'cube';
  shadingModel: 'gouraud' | 'phong';
  showNormals: boolean;
  
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

// ─── State ──────────────────────────────────────────────────────

const state: AppState = {
  shape: 'sphere',
  shadingModel: 'phong',
  showNormals: false,

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
  rotX: 20,
  rotY: 0,
};

const defaults: AppState = { ...state };

// ─── Geometry Generators ────────────────────────────────────────

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

/**
 * Generate a procedural sphere mesh using latitude/longitude parametric parametrization.
 */
function generateSphere(latSegments = 30, lonSegments = 30): GeometryMesh {
  const radius = 0.6;
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];

  // Generate vertices & normals
  for (let lat = 0; lat <= latSegments; lat++) {
    const theta = (lat * Math.PI) / latSegments;

    const sinTheta = Math.sin(theta);
    const cosTheta = Math.cos(theta);

    for (let lon = 0; lon <= lonSegments; lon++) {
      const phi = (lon * 2 * Math.PI) / lonSegments;
      const sinPhi = Math.sin(phi);
      const cosPhi = Math.cos(phi);

      const x = cosPhi * sinTheta;
      const y = cosTheta;
      const z = sinPhi * sinTheta;

      // Position (scaled by radius)
      positions.push(x * radius, y * radius, z * radius);
      
      // Normal vector (equal to raw sphere coordinates for unit sphere)
      normals.push(x, y, z);
    }
  }

  // Generate indices (indexed triangles)
  for (let lat = 0; lat < latSegments; lat++) {
    for (let lon = 0; lon < lonSegments; lon++) {
      const first = lat * (lonSegments + 1) + lon;
      const second = first + lonSegments + 1;

      // Two triangles per grid quad
      indices.push(first, second, first + 1);
      indices.push(second, second + 1, first + 1);
    }
  }

  const posArr = new Float32Array(positions);
  const normArr = new Float32Array(normals);
  const idxArr = new Uint16Array(indices);
  const normalLines = generateNormalVisualizerLines(posArr, normArr);

  return { positions: posArr, normals: normArr, indices: idxArr, normalLines };
}

/**
 * Procedural helper to convert standard vertex coordinate meshes + normals
 * to line coordinates demonstrating local normal paths.
 * Every vertex produces a line segment: Position A (base) -> Position B (base + normal * scale)
 */
function generateNormalVisualizerLines(positions: Float32Array, normals: Float32Array): Float32Array {
  const lineLength = 0.1;
  const lines: number[] = [];

  for (let i = 0; i < positions.length / 3; i++) {
    const px = positions[i * 3];
    const py = positions[i * 3 + 1];
    const pz = positions[i * 3 + 2];

    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    if (px === undefined || py === undefined || pz === undefined ||
        nx === undefined || ny === undefined || nz === undefined) {
      continue;
    }

    // Point A (Mesh Base)
    lines.push(px, py, pz);
    // Point B (Normal Direction offset)
    lines.push(px + nx * lineLength, py + ny * lineLength, pz + nz * lineLength);
  }

  return new Float32Array(lines);
}

// ─── WebGL Compilation Helpers ──────────────────────────────────

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Failed to create shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Shader compilation failed:\n${log}`);
  }
  return shader;
}

function createProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) throw new Error('Failed to create program');

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

// ─── Main Program Setup ─────────────────────────────────────────

function main(): void {
  const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element glCanvas not found');
    return;
  }

  const gl = canvas.getContext('webgl', { antialias: true, alpha: false }) as WebGLRenderingContext;
  if (!gl) {
    console.error('WebGL 1.0 context initialization failed');
    return;
  }

  // ── Step 1: Create Programs ──
  const gouraudProgram = createProgram(
    gl,
    document.getElementById('gouraud-vs')?.textContent ?? '',
    document.getElementById('gouraud-fs')?.textContent ?? ''
  );

  const phongProgram = createProgram(
    gl,
    document.getElementById('phong-vs')?.textContent ?? '',
    document.getElementById('phong-fs')?.textContent ?? ''
  );

  const flatProgram = createProgram(
    gl,
    document.getElementById('flat-vs')?.textContent ?? '',
    document.getElementById('flat-fs')?.textContent ?? ''
  );

  // ── Step 2: Retrieve Uniform & Attribute Locations ──
  function getLocations(program: WebGLProgram): ShaderLocations {
    return {
      a_Position: gl.getAttribLocation(program, 'a_Position'),
      a_Normal: gl.getAttribLocation(program, 'a_Normal'),
      u_MvpMatrix: gl.getUniformLocation(program, 'u_MvpMatrix'),
      u_ModelMatrix: gl.getUniformLocation(program, 'u_ModelMatrix'),
      u_NormalMatrix: gl.getUniformLocation(program, 'u_NormalMatrix'),
      u_EyePos: gl.getUniformLocation(program, 'u_EyePos'),
      u_AmbientLight: gl.getUniformLocation(program, 'u_AmbientLight'),
      u_DirLightColor: gl.getUniformLocation(program, 'u_DirLightColor'),
      u_DirLightDir: gl.getUniformLocation(program, 'u_DirLightDir'),
      u_DirLightIntensity: gl.getUniformLocation(program, 'u_DirLightIntensity'),
      u_PointLightColor: gl.getUniformLocation(program, 'u_PointLightColor'),
      u_PointLightPos: gl.getUniformLocation(program, 'u_PointLightPos'),
      u_PointLightIntensity: gl.getUniformLocation(program, 'u_PointLightIntensity'),
      u_MatDiffuse: gl.getUniformLocation(program, 'u_MatDiffuse'),
      u_MatShininess: gl.getUniformLocation(program, 'u_MatShininess'),
    };
  }

  const gouraudLocs = getLocations(gouraudProgram);
  const phongLocs = getLocations(phongProgram);
  
  // Flat Shader Locations (line normal drawing)
  const flatLocs = {
    a_Position: gl.getAttribLocation(flatProgram, 'a_Position'),
    u_MvpMatrix: gl.getUniformLocation(flatProgram, 'u_MvpMatrix'),
    u_Color: gl.getUniformLocation(flatProgram, 'u_Color'),
  };

  // ── Step 3: Geometry Initialization ──
  const meshes = {
    cube: generateCube(),
    sphere: generateSphere(40, 40),
  };

  // Create GPU WebGL Buffers
  const positionBuffers = {
    cube: gl.createBuffer()!,
    sphere: gl.createBuffer()!,
  };
  const normalBuffers = {
    cube: gl.createBuffer()!,
    sphere: gl.createBuffer()!,
  };
  const indexBuffers = {
    cube: gl.createBuffer()!,
    sphere: gl.createBuffer()!,
  };
  const normalLineBuffers = {
    cube: gl.createBuffer()!,
    sphere: gl.createBuffer()!,
  };

  // Load mesh buffer contents on the GPU
  function uploadMeshBuffers(key: 'cube' | 'sphere'): void {
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

  uploadMeshBuffers('cube');
  uploadMeshBuffers('sphere');

  // ── Step 4: Configure WebGL States ──
  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0.04, 0.04, 0.06, 1.0);

  // ── Step 5: UI Elements & Matrix setups ──
  setupUI();

  // Matrices
  const modelMatrix = new Matrix4();
  const viewMatrix = new Matrix4();
  const projMatrix = new Matrix4();
  const mvpMatrix = new Matrix4();
  const normalMatrix = new Matrix4();

  // Camera settings
  const eyeX = 0.0;
  const eyeY = 0.0;
  const eyeZ = 2.0;

  // View & Projection constant calculation
  viewMatrix.setLookAt(eyeX, eyeY, eyeZ, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0);
  projMatrix.setPerspective(52, canvas.width / canvas.height, 0.1, 10.0);

  // Frame timing loop
  let lastTime = performance.now();
  let frameCount = 0;
  const fpsDisplay = document.getElementById('fpsDisplay');

  function render(time: number): void {
    // 1. FPS Tracker
    frameCount++;
    if (time - lastTime >= 1000) {
      if (fpsDisplay) fpsDisplay.textContent = `${frameCount} FPS`;
      frameCount = 0;
      lastTime = time;
    }

    // 2. Auto Rotation updates
    if (state.autoRotate) {
      state.rotY = (state.rotY + 0.5) % 360;
      const rotYSlider = document.getElementById('rotY') as HTMLInputElement | null;
      const rotYVal = document.getElementById('rotYVal');
      if (rotYSlider) rotYSlider.value = String(Math.round(state.rotY));
      if (rotYVal) rotYVal.textContent = `${Math.round(state.rotY)}°`;
    }

    // 3. Clear canvas depth & color buffers
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // 4. Matrix Transforms Calculation
    // Apply Euler rotations to model matrix
    modelMatrix.setIdentity();
    modelMatrix.rotate(state.rotX, 1.0, 0.0, 0.0);
    modelMatrix.rotate(state.rotY, 0.0, 1.0, 0.0);

    // MVP = Projection * View * Model
    mvpMatrix.set(projMatrix);
    mvpMatrix.multiply(viewMatrix);
    mvpMatrix.multiply(modelMatrix);

    // Normal Matrix = Inverse-Transpose of Model Matrix (converts normal orientations correctly in world coordinates)
    normalMatrix.setInverseOf(modelMatrix);
    normalMatrix.transpose();

    // 5. Select active program
    const isPhong = state.shadingModel === 'phong';
    const activeProgram = isPhong ? phongProgram : gouraudProgram;
    const activeLocs = isPhong ? phongLocs : gouraudLocs;

    gl.useProgram(activeProgram);

    // Bind active shape buffers
    const activeMesh = meshes[state.shape];
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffers[state.shape]);
    gl.vertexAttribPointer(activeLocs.a_Position, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(activeLocs.a_Position);

    gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffers[state.shape]);
    gl.vertexAttribPointer(activeLocs.a_Normal, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(activeLocs.a_Normal);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffers[state.shape]);

    // 6. Bind Matrices & Vector Uniforms
    gl.uniformMatrix4fv(activeLocs.u_MvpMatrix, false, mvpMatrix.elements);
    gl.uniformMatrix4fv(activeLocs.u_ModelMatrix, false, modelMatrix.elements);
    gl.uniformMatrix4fv(activeLocs.u_NormalMatrix, false, normalMatrix.elements);

    // Eye position
    gl.uniform3f(activeLocs.u_EyePos, eyeX, eyeY, eyeZ);

    // Ambient Lighting settings
    const ambientR = state.ambientR * state.ambientIntensity;
    const ambientG = state.ambientG * state.ambientIntensity;
    const ambientB = state.ambientB * state.ambientIntensity;
    gl.uniform3f(activeLocs.u_AmbientLight, ambientR, ambientG, ambientB);

    // Material properties
    gl.uniform3f(activeLocs.u_MatDiffuse, state.matR, state.matG, state.matB);
    gl.uniform1f(activeLocs.u_MatShininess, state.matShininess);

    // Directional Light parameters
    if (state.dirLightEnabled) {
      gl.uniform3f(activeLocs.u_DirLightColor, state.dirR, state.dirG, state.dirB);
      // Normalized direction vector
      const dlx = state.dirLightX;
      const dly = state.dirLightY;
      const dlz = state.dirLightZ;
      const len = Math.sqrt(dlx * dlx + dly * dly + dlz * dlz) || 1;
      gl.uniform3f(activeLocs.u_DirLightDir, dlx / len, dly / len, dlz / len);
      gl.uniform1f(activeLocs.u_DirLightIntensity, state.dirIntensity);
    } else {
      gl.uniform1f(activeLocs.u_DirLightIntensity, 0.0);
    }

    // Point Light parameters
    if (state.pointLightEnabled) {
      gl.uniform3f(activeLocs.u_PointLightColor, state.pointR, state.pointG, state.pointB);
      gl.uniform3f(activeLocs.u_PointLightPos, state.pointPosX, state.pointPosY, state.pointPosZ);
      gl.uniform1f(activeLocs.u_PointLightIntensity, state.pointIntensity);
    } else {
      gl.uniform1f(activeLocs.u_PointLightIntensity, 0.0);
    }

    // 7. Draw Geometry Mesh
    gl.drawElements(gl.TRIANGLES, activeMesh.indices.length, gl.UNSIGNED_SHORT, 0);

    // 8. Optional: Render Normal Vectors
    if (state.showNormals) {
      gl.useProgram(flatProgram);
      gl.bindBuffer(gl.ARRAY_BUFFER, normalLineBuffers[state.shape]);
      gl.vertexAttribPointer(flatLocs.a_Position, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(flatLocs.a_Position);

      // Re-use same MVP matrix
      gl.uniformMatrix4fv(flatLocs.u_MvpMatrix, false, mvpMatrix.elements);
      // Bright neon cyan color for the lines
      gl.uniform4f(flatLocs.u_Color, 0.05, 0.95, 0.95, 1.0);

      gl.drawArrays(gl.LINES, 0, activeMesh.positions.length / 3 * 2);
    }

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

// ─── UI Bindings setup ──────────────────────────────────────────

function setupUI(): void {
  // Bind simple shape selector
  const shapeSelect = document.getElementById('shapeSelect') as HTMLSelectElement | null;
  const shapeDisplay = document.getElementById('shapeDisplay');
  if (shapeSelect) {
    shapeSelect.addEventListener('change', () => {
      state.shape = shapeSelect.value as 'sphere' | 'cube';
      if (shapeDisplay) {
        shapeDisplay.textContent = state.shape === 'sphere' ? 'Sphere (2,180 Verts)' : 'Cube (24 Verts)';
      }
    });
  }

  // Shading model selector
  const modelSelect = document.getElementById('shadingModelSelect') as HTMLSelectElement | null;
  const modelDisplay = document.getElementById('modelDisplay');
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      state.shadingModel = modelSelect.value as 'gouraud' | 'phong';
      if (modelDisplay) {
        modelDisplay.textContent = state.shadingModel === 'phong' ? 'Phong Shading' : 'Gouraud Shading';
      }
    });
  }

  // Normals checkbox
  const normalsCheckbox = document.getElementById('showNormals') as HTMLInputElement | null;
  if (normalsCheckbox) {
    normalsCheckbox.addEventListener('change', (e) => {
      state.showNormals = (e.target as HTMLInputElement).checked;
    });
  }

  // Light enables
  bindCheckbox('dirLightEnabled', 'dirLightEnabled');
  bindCheckbox('pointLightEnabled', 'pointLightEnabled');
  bindCheckbox('autoRotate', 'autoRotate');

  // Sliders binding
  bindSlider('matR', 'matRVal', 'matR', updateMaterialSwatch);
  bindSlider('matG', 'matGVal', 'matG', updateMaterialSwatch);
  bindSlider('matB', 'matBVal', 'matB', updateMaterialSwatch);
  bindSlider('matShininess', 'matShininessVal', 'matShininess', v => parseFloat(v).toFixed(0));

  bindSlider('ambientIntensity', 'ambientIntensityVal', 'ambientIntensity');
  bindSlider('ambientR', 'ambientRVal', 'ambientR');
  bindSlider('ambientG', 'ambientGVal', 'ambientG');
  bindSlider('ambientB', 'ambientBVal', 'ambientB');

  bindSlider('dirLightX', 'dirLightXVal', 'dirLightX');
  bindSlider('dirLightY', 'dirLightYVal', 'dirLightY');
  bindSlider('dirLightZ', 'dirLightZVal', 'dirLightZ');
  bindSlider('dirIntensity', 'dirIntensityVal', 'dirIntensity');
  bindSlider('dirR', 'dirRVal', 'dirR');
  bindSlider('dirG', 'dirGVal', 'dirG');
  bindSlider('dirB', 'dirBVal', 'dirB');

  bindSlider('pointPosX', 'pointPosXVal', 'pointPosX');
  bindSlider('pointPosY', 'pointPosYVal', 'pointPosY');
  bindSlider('pointPosZ', 'pointPosZVal', 'pointPosZ');
  bindSlider('pointIntensity', 'pointIntensityVal', 'pointIntensity');
  bindSlider('pointR', 'pointRVal', 'pointR');
  bindSlider('pointG', 'pointGVal', 'pointG');
  bindSlider('pointB', 'pointBVal', 'pointB');

  bindSlider('rotX', 'rotXVal', 'rotX', v => `${Math.round(parseFloat(v))}°`);
  bindSlider('rotY', 'rotYVal', 'rotY', v => `${Math.round(parseFloat(v))}°`);

  // Bind Reset
  const btnReset = document.getElementById('btnReset');
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      Object.assign(state, { ...defaults });

      // Update DOM selectors
      if (shapeSelect) {
        shapeSelect.value = defaults.shape;
        if (shapeDisplay) shapeDisplay.textContent = 'Sphere (2,180 Verts)';
      }
      if (modelSelect) {
        modelSelect.value = defaults.shadingModel;
        if (modelDisplay) modelDisplay.textContent = 'Phong Shading';
      }
      if (normalsCheckbox) normalsCheckbox.checked = defaults.showNormals;

      // Update checkboxes
      setCheckState('dirLightEnabled', defaults.dirLightEnabled);
      setCheckState('pointLightEnabled', defaults.pointLightEnabled);
      setCheckState('autoRotate', defaults.autoRotate);

      // Sliders & outputs
      resetSlider('matR', 'matRVal', defaults.matR);
      resetSlider('matG', 'matGVal', defaults.matG);
      resetSlider('matB', 'matBVal', defaults.matB);
      resetSlider('matShininess', 'matShininessVal', defaults.matShininess, v => parseFloat(v).toFixed(0));

      resetSlider('ambientIntensity', 'ambientIntensityVal', defaults.ambientIntensity);
      resetSlider('ambientR', 'ambientRVal', defaults.ambientR);
      resetSlider('ambientG', 'ambientGVal', defaults.ambientG);
      resetSlider('ambientB', 'ambientBVal', defaults.ambientB);

      resetSlider('dirLightX', 'dirLightXVal', defaults.dirLightX);
      resetSlider('dirLightY', 'dirLightYVal', defaults.dirLightY);
      resetSlider('dirLightZ', 'dirLightZVal', defaults.dirLightZ);
      resetSlider('dirIntensity', 'dirIntensityVal', defaults.dirIntensity);
      resetSlider('dirR', 'dirRVal', defaults.dirR);
      resetSlider('dirG', 'dirGVal', defaults.dirG);
      resetSlider('dirB', 'dirBVal', defaults.dirB);

      resetSlider('pointPosX', 'pointPosXVal', defaults.pointPosX);
      resetSlider('pointPosY', 'pointPosYVal', defaults.pointPosY);
      resetSlider('pointPosZ', 'pointPosZVal', defaults.pointPosZ);
      resetSlider('pointIntensity', 'pointIntensityVal', defaults.pointIntensity);
      resetSlider('pointR', 'pointRVal', defaults.pointR);
      resetSlider('pointG', 'pointGVal', defaults.pointG);
      resetSlider('pointB', 'pointBVal', defaults.pointB);

      resetSlider('rotX', 'rotXVal', defaults.rotX, v => `${Math.round(parseFloat(v))}°`);
      resetSlider('rotY', 'rotYVal', defaults.rotY, v => `${Math.round(parseFloat(v))}°`);

      updateMaterialSwatch();
    });
  }

  updateMaterialSwatch();
}

// ─── UI Helper Methods ──────────────────────────────────────────

function bindCheckbox(elementId: string, stateKey: keyof AppState): void {
  const el = document.getElementById(elementId) as HTMLInputElement | null;
  if (!el) return;
  el.addEventListener('change', (e) => {
    (state as any)[stateKey] = (e.target as HTMLInputElement).checked;
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

  input.addEventListener('input', () => {
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
    output.textContent = formatter ? formatter(String(value)) : value.toFixed(2);
  }
}

function updateMaterialSwatch(value?: string): void {
  const r = Math.round(state.matR * 255);
  const g = Math.round(state.matG * 255);
  const b = Math.round(state.matB * 255);

  const swatch = document.getElementById('matSwatch');
  const hex = document.getElementById('matHex');
  const outputR = document.getElementById('matRVal');
  const outputG = document.getElementById('matGVal');
  const outputB = document.getElementById('matBVal');

  if (swatch) swatch.style.background = `rgb(${r}, ${g}, ${b})`;
  if (hex) {
    hex.textContent =
      '#' +
      r.toString(16).padStart(2, '0').toUpperCase() +
      g.toString(16).padStart(2, '0').toUpperCase() +
      b.toString(16).padStart(2, '0').toUpperCase();
  }

  // Ensure individual label updates match
  if (outputR) outputR.textContent = state.matR.toFixed(2);
  if (outputG) outputG.textContent = state.matG.toFixed(2);
  if (outputB) outputB.textContent = state.matB.toFixed(2);
}

// Entry Point
document.addEventListener('DOMContentLoaded', main);
