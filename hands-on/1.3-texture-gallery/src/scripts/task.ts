/* ═══════════════════════════════════════════════════════════════
   1.3 Texture Gallery — Main TypeScript Application
   
   CONCEPTS PRACTICED:
   • Multi-texture rendering (Texture Units TEXTURE0 and TEXTURE1)
   • Texture wrapping modes (S and T dimensions: REPEAT, CLAMP_TO_EDGE, MIRRORED_REPEAT)
   • Texture filtering (MAG_FILTER vs MIN_FILTER, nearest-neighbor vs bilinear)
   • Mipmaps generation and minification levels
   • Procedural texture generation (creating textures dynamically using pixel arrays)
   • Image texture loading and WebGL state management
   • Dual context coordination for side-by-side comparative views
   ═══════════════════════════════════════════════════════════════ */

"use strict";

// ─── Interfaces ────────────────────────────────────────────────

class InternalTextureImage extends Image {
  constructor(width?: number, height?: number, public name: string = "") {
    super(width, height);
  }
}

type InternalTextureKeyType = "checkerboard" | "stripes" | "huey";

interface AppState {
  texture1: InternalTextureKeyType | string;
  texture2: InternalTextureKeyType | string;
  blendFactor: number;
  wrapS: "CLAMP_TO_EDGE" | "REPEAT" | "MIRRORED_REPEAT";
  wrapT: "CLAMP_TO_EDGE" | "REPEAT" | "MIRRORED_REPEAT";
  uvScale: number;
  magFilter: "NEAREST" | "LINEAR";
  minFilter:
    | "NEAREST"
    | "LINEAR"
    | "NEAREST_MIPMAP_NEAREST"
    | "LINEAR_MIPMAP_NEAREST"
    | "NEAREST_MIPMAP_LINEAR"
    | "LINEAR_MIPMAP_LINEAR";
  generateMipmaps: boolean;
  textureUploadDest: "texture1" | "texture2";
  textureUploadImage: InternalTextureImage | null;
}

interface ShaderLocations {
  a_Position: number;
  a_TexCoord: number;
  u_UVScale: WebGLUniformLocation | null;
  u_Sampler1: WebGLUniformLocation | null;
  u_Sampler2: WebGLUniformLocation | null;
  u_BlendFactor: WebGLUniformLocation | null;
}

// ─── Constants & State ──────────────────────────────────────────

const state: AppState = {
  texture1: "checkerboard",
  texture2: "stripes",
  blendFactor: 0.0,
  wrapS: "CLAMP_TO_EDGE",
  wrapT: "CLAMP_TO_EDGE",
  uvScale: 3.0,
  magFilter: "LINEAR",
  minFilter: "LINEAR",
  generateMipmaps: true,
  textureUploadDest: "texture1",
  textureUploadImage: null,
};

const defaults: AppState = { ...state };

// ─── Procedural Texture Generators ──────────────────────────────

const PROCEDURAL_IMAGE_DIM = 512;

/** * EVENTS */
const textureUploadEvent = new CustomEvent("tex-upload", {});

/**
 * Generate a 512x512 checkerboard pattern.
 * Alternates between neon pink and deep charcoal.
 */
function createCheckerboardData(): Uint8Array {
  const size = PROCEDURAL_IMAGE_DIM;
  const pixels = new Uint8Array(size * size * 4); // RGBA
  const squareSize = 64; // Size of each checker box in pixels

  for (let y = 0; y < size; y++) {
    const squareY = Math.floor(y / squareSize);
    for (let x = 0; x < size; x++) {
      const squareX = Math.floor(x / squareSize);
      const isPink = (squareX + squareY) % 2 === 0;
      const idx = (y * size + x) * 4;

      if (isPink) {
        pixels[idx] = 236; // R (Pink)
        pixels[idx + 1] = 72; // G
        pixels[idx + 2] = 153; // B
        pixels[idx + 3] = 255; // A
      } else {
        pixels[idx] = 15; // R (Dark slate)
        pixels[idx + 1] = 23; // G
        pixels[idx + 2] = 42; // B
        pixels[idx + 3] = 255; // A
      }
    }
  }

  return pixels;
}

/**
 * Generate a 512x512 stripes/tech pattern.
 * Creates diagonal neon teal and dark violet cyber lines.
 */
function createTechStripesData(): Uint8Array {
  const size = 512;
  const pixels = new Uint8Array(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;

      // Draw custom cyberpunk diagonal stripes
      const diagonalVal = (x + y) % 64;
      const diagonalVal2 = (x - y + size) % 64;

      if (diagonalVal < 4) {
        // Glowing cyan line
        pixels[idx] = 6; // R
        pixels[idx + 1] = 182; // G
        pixels[idx + 2] = 212; // B
        pixels[idx + 3] = 255; // A
      } else if (diagonalVal2 < 4) {
        // Glowing purple accent
        pixels[idx] = 168; // R
        pixels[idx + 1] = 85; // G
        pixels[idx + 2] = 247; // B
        pixels[idx + 3] = 255; // A
      } else {
        // Dark background navy blue
        pixels[idx] = 15; // R
        pixels[idx + 1] = 23; // G
        pixels[idx + 2] = 30; // B
        pixels[idx + 3] = 255; // A
      }
    }
  }

  return pixels;
}

// ─── WebGL Helpers ──────────────────────────────────────────────

function createShader(
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
    throw new Error(`Shader compilation error:\n${log}`);
  }
  return shader;
}

function createProgram(
  gl: WebGLRenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSource);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const program = gl.createProgram();
  if (!program) throw new Error("Failed to create program");

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(`Program link error:\n${log}`);
  }
  return program;
}

// ─── Canvas Context Manager Class ───────────────────────────────

class WebGLCanvasViewer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private locations: ShaderLocations;
  private isZoomed: boolean;

  // Geometry
  private vertexBuffer: WebGLBuffer | null = null;
  private count: number = 4;
  private static instances: number = 0;

  // Texture resources
  private checkerboardTexture: WebGLTexture | null = null;
  private stripesTexture: WebGLTexture | null = null;
  private hueyTexture: WebGLTexture | null = null;

  private textureLookup = new Map<string, WebGLTexture>();

  // Image load state tracker
  private hueyImage: HTMLImageElement | null = null;

  constructor(canvasId: string, isZoomed: boolean) {
    const canvas = document.getElementById(
      canvasId
    ) as HTMLCanvasElement | null;
    if (!canvas) throw new Error(`Canvas element ${canvasId} not found`);
    this.canvas = canvas;

    const gl =
      canvas.getContext("webgl2", { antialias: true, alpha: false }) ||
      canvas.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) throw new Error("WebGL not supported");
    this.gl = gl;
    this.isZoomed = isZoomed;

    // Compile shader program
    const vsSource = document.getElementById("vertex-shader")?.textContent;
    const fsSource = document.getElementById("fragment-shader")?.textContent;
    if (!vsSource || !fsSource)
      throw new Error("Shader elements not found in DOM");

    this.program = createProgram(gl, vsSource, fsSource);

    // Attribute & Uniform locations
    this.locations = {
      a_Position: gl.getAttribLocation(this.program, "a_Position"),
      a_TexCoord: gl.getAttribLocation(this.program, "a_TexCoord"),
      u_UVScale: gl.getUniformLocation(this.program, "u_UVScale"),
      u_Sampler1: gl.getUniformLocation(this.program, "u_Sampler1"),
      u_Sampler2: gl.getUniformLocation(this.program, "u_Sampler2"),
      u_BlendFactor: gl.getUniformLocation(this.program, "u_BlendFactor"),
    };

    this.initGeometry();
    this.initTextures();

    document.addEventListener("tex-upload", () =>
      this.initUploadTexture(isZoomed ? 1 : 0)
    );
    WebGLCanvasViewer.instances++;
  }

  /**
   * Set up a flat quad.
   * UVs go from 0 to 1 across the quad surface.
   */
  private initGeometry(): void {
    const gl = this.gl;
    // Vertex layout: X, Y (Pos) | U, V (Texture Coord)
    //prettier-ignore
    const vertexData = new Float32Array([
      -1.0, 1.0, 0.0, 1.0, // Top Left
      -1.0, -1.0, 0.0, 0.0, // Bottom Left
      1.0, 1.0, 1.0, 1.0, // Top Right
      1.0, -1.0, 1.0, 0.0, // Bottom Right
    ]);

    this.vertexBuffer = gl.createBuffer();
    if (!this.vertexBuffer) throw new Error("Failed to create vertex buffer");
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.STATIC_DRAW);
  }

  private initUploadTexture(viewKey: number) {
    const viewLookupDict: Record<number, number> = {};

    const gl = this.gl;
    if (!state.textureUploadImage) return;

    if (viewLookupDict[viewKey] === undefined) {
      viewLookupDict[viewKey] = 0;
      const texture: WebGLTexture | null = gl.createTexture();
      this.textureLookup.set(state.textureUploadImage.name, texture);

      if (!texture) return;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        state.textureUploadImage
      );
      gl.generateMipmap(gl.TEXTURE_2D);

      viewLookupDict[viewKey]++;
    }

    if (Object.keys(viewLookupDict).length >= 2) {
      state.textureUploadImage = null;
    }
  }

  /**
   * Create textures.
   * Allocates procedural checkerboard, procedural tech stripes,
   * and loads huey image texture.
   */
  private initTextures(): void {
    const gl = this.gl;

    // 1. Checkerboard
    this.checkerboardTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.checkerboardTexture);
    //prettier-ignore
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PROCEDURAL_IMAGE_DIM, PROCEDURAL_IMAGE_DIM, 0, gl.RGBA, gl.UNSIGNED_BYTE, createCheckerboardData());
    this.textureLookup.set("checkerboard", this.checkerboardTexture);
    gl.generateMipmap(gl.TEXTURE_2D);

    // 2. Tech Stripes
    this.stripesTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.stripesTexture);
    //prettier-ignore
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, PROCEDURAL_IMAGE_DIM, PROCEDURAL_IMAGE_DIM, 0, gl.RGBA, gl.UNSIGNED_BYTE, createTechStripesData());
    this.textureLookup.set("stripes", this.stripesTexture);
    gl.generateMipmap(gl.TEXTURE_2D);

    // 3. Image Texture (huey)
    this.hueyTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.hueyTexture);
    // Put a placeholder blue pixel first while loading
    //prettier-ignore
    this.textureLookup.set("huey", this.hueyTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([15, 23, 42, 255])
    ); // texImage2D is overloaded

    this.hueyImage = new Image();
    this.hueyImage.onload = () => {
      if (!this.hueyTexture || !this.hueyImage) return;
      gl.bindTexture(gl.TEXTURE_2D, this.hueyTexture);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this.hueyImage
      );
      gl.generateMipmap(gl.TEXTURE_2D);
      this.render();
    };
    this.hueyImage.src = "/src/images/huey2.jpg";
  }

  /**
   * Helper to return WebGL constants based on string settings.
   */
  private getGlWrapMode(mode: AppState["wrapS"]): number {
    const gl = this.gl;
    if (mode === "CLAMP_TO_EDGE") return gl.CLAMP_TO_EDGE;
    if (mode === "MIRRORED_REPEAT") return gl.MIRRORED_REPEAT;
    return gl.REPEAT;
  }

  private getGlFilterMode(mode: string): number {
    const gl = this.gl;
    switch (mode) {
      case "NEAREST":
        return gl.NEAREST;
      case "LINEAR":
        return gl.LINEAR;
      case "NEAREST_MIPMAP_NEAREST":
        return gl.NEAREST_MIPMAP_NEAREST;
      case "LINEAR_MIPMAP_NEAREST":
        return gl.LINEAR_MIPMAP_NEAREST;
      case "NEAREST_MIPMAP_LINEAR":
        return gl.NEAREST_MIPMAP_LINEAR;
      case "LINEAR_MIPMAP_LINEAR":
        return gl.LINEAR_MIPMAP_LINEAR;
      default:
        return gl.LINEAR;
    }
  }

  /**
   * Rebind texture options (wrapping, filtering, mipmaps)
   */
  private updateTextureParameters(texture: WebGLTexture): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Generate mipmaps if minification filter uses mipmaps and auto-generate is toggled
    const usesMipmaps = state.minFilter.includes("MIPMAP");
    if (usesMipmaps && state.generateMipmaps) {
      gl.generateMipmap(gl.TEXTURE_2D);
    }

    // Apply Wrapping
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_S,
      this.getGlWrapMode(state.wrapS)
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_WRAP_T,
      this.getGlWrapMode(state.wrapT)
    );

    // Apply Filtering
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MAG_FILTER,
      this.getGlFilterMode(state.magFilter)
    );
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      this.getGlFilterMode(state.minFilter)
    );
  }

  private getActiveTexture(
    key: InternalTextureKeyType | string
  ): WebGLTexture | null {
    return this.textureLookup.get(key) ?? null;
  }

  /**
   * Render the WebGL Canvas viewport.
   */
  public render(): void {
    const gl = this.gl;

    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0.08, 0.08, 0.12, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Bind buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);

    // Set attributes (Pos + UV)
    // Stride is 4 floats (16 bytes). Offset of Pos is 0. Offset of UV is 2 floats (8 bytes).
    const FSIZE = Float32Array.BYTES_PER_ELEMENT;
    gl.vertexAttribPointer(
      this.locations.a_Position,
      2,
      gl.FLOAT,
      false,
      4 * FSIZE,
      0
    );
    gl.enableVertexAttribArray(this.locations.a_Position);

    gl.vertexAttribPointer(
      this.locations.a_TexCoord,
      2,
      gl.FLOAT,
      false,
      4 * FSIZE,
      2 * FSIZE
    );
    gl.enableVertexAttribArray(this.locations.a_TexCoord);

    // Get Active textures
    const tex1 = this.getActiveTexture(state.texture1);
    const tex2 = this.getActiveTexture(state.texture2);

    if (!tex1 || !tex2) return;

    // Apply texture params
    this.updateTextureParameters(tex1);
    this.updateTextureParameters(tex2);

    // Bind texture 1 to Unit 0
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex1);
    gl.uniform1i(this.locations.u_Sampler1, 0);

    // Bind texture 2 to Unit 1
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, tex2);
    gl.uniform1i(this.locations.u_Sampler2, 1);

    // Set UV Scale
    // For zoomed view, scale UV coordinates to map a smaller region (close up)
    const scale = this.isZoomed ? state.uvScale / 16.0 : state.uvScale;
    gl.uniform1f(this.locations.u_UVScale, scale);

    // Set Blend
    gl.uniform1f(this.locations.u_BlendFactor, state.blendFactor);

    // Draw Quad using TRIANGLE_STRIP
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.count);
  }
}

// ─── Entry Point & Event Bindings ───────────────────────────────

let viewerLeft: WebGLCanvasViewer;
let viewerRight: WebGLCanvasViewer;

function init(): void {
  try {
    viewerLeft = new WebGLCanvasViewer("canvasLeft", false);
    viewerRight = new WebGLCanvasViewer("canvasRight", true);

    setupUI();
    renderAll();
  } catch (err) {
    console.error("Failed to initialize WebGL Texture Gallery:", err);
  }
}

function renderAll(): void {
  viewerLeft.render();
  viewerRight.render();

  // Update Technical Specs Panel
  const usesMipmaps = state.minFilter.includes("MIPMAP");
  const mipsDisplay = document.getElementById("mipsActiveDisplay");
  if (mipsDisplay) {
    mipsDisplay.textContent =
      usesMipmaps && state.generateMipmaps ? "Yes" : "No";
  }
}

function setupUI(): void {
  // Bind Selectors
  bindSelect("texSelect1", "texture1");
  bindSelect("texSelect2", "texture2");
  bindSelect("wrapS", "wrapS");
  bindSelect("wrapT", "wrapT");
  bindSelect("magFilter", "magFilter");
  bindSelect("minFilter", "minFilter");

  // Bind Sliders
  bindSlider("blendFactor", "blendFactorVal", "blendFactor");
  bindSlider("uvScale", "uvScaleVal", "uvScale");

  // Bind Mipmaps Checkbox
  const mipCheck = document.getElementById(
    "generateMipmaps"
  ) as HTMLInputElement | null;
  if (mipCheck) {
    mipCheck.addEventListener("change", (e) => {
      const target = e.target as HTMLInputElement;
      state.generateMipmaps = target.checked;
      renderAll();
    });
  }

  // Bind Reset
  const btnReset = document.getElementById("btnReset");
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      Object.assign(state, { ...defaults });

      // Update select values in DOM
      setSelectValue("texSelect1", defaults.texture1);
      setSelectValue("texSelect2", defaults.texture2);
      setSelectValue("wrapS", defaults.wrapS);
      setSelectValue("wrapT", defaults.wrapT);
      setSelectValue("magFilter", defaults.magFilter);
      setSelectValue("minFilter", defaults.minFilter);

      // Update slider values in DOM
      setSliderValue("blendFactor", "blendFactorVal", defaults.blendFactor);
      setSliderValue("uvScale", "uvScaleVal", defaults.uvScale);

      // Checkbox
      const checkEl = document.getElementById(
        "generateMipmaps"
      ) as HTMLInputElement | null;
      if (checkEl) checkEl.checked = defaults.generateMipmaps;

      renderAll();
    });
  }

  function fileToBase64(file: File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;

      reader.readAsDataURL(file);
    });
  }

  // Bind Image Upload Form
  const uploadForm = document.getElementById(
    "uploadForm"
  ) as HTMLFormElement | null;
  const imageUploadInput = document.getElementById(
    "imageUpload"
  ) as HTMLInputElement | null;
  if (uploadForm && imageUploadInput) {
    uploadForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const tex1 = uploadForm.querySelector(".tex-radio");
      const texture1Checked = tex1 instanceof HTMLInputElement && tex1.checked;

      state.textureUploadDest = texture1Checked ? "texture1" : "texture2";

      if (imageUploadInput.files && imageUploadInput.files[0]) {
        const file = imageUploadInput.files[0];
        if (!file) throw new Error("No file selected");

        const name =
          file.name.toLowerCase().replaceAll(" ", "_") + "_" + Date.now();

        const base64: string = (await fileToBase64(file)) as string;

        let img = new InternalTextureImage(undefined, undefined, name);
        img.onload = () => {
          handleTextureImageUpload(
            img,
            (file as File & { originalName: string }).originalName || name
          );
        };

        img.src = base64;
      }
    });
  }
}

// ─── DOM Binding Helpers ────────────────────────────────────────

function bindSelect(elementId: string, stateKey: keyof AppState): void {
  const el = document.getElementById(elementId) as HTMLSelectElement | null;
  if (!el) return;
  el.addEventListener("change", () => {
    (state as any)[stateKey] = el.value;
    renderAll();
  });
}

function bindSlider(
  inputId: string,
  valId: string,
  stateKey: keyof AppState
): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  const valDisplay = document.getElementById(valId) as HTMLElement | null;
  if (!input || !valDisplay) return;

  input.addEventListener("input", () => {
    const val = parseFloat(input.value);
    (state as any)[stateKey] = val;
    valDisplay.textContent = val.toFixed(2);
    renderAll();
  });
}

function setSelectValue(id: string, value: string): void {
  const el = document.getElementById(id) as HTMLSelectElement | null;
  if (el) el.value = value;
}

function setSliderValue(inputId: string, valId: string, value: number): void {
  const input = document.getElementById(inputId) as HTMLInputElement | null;
  const valDisplay = document.getElementById(valId) as HTMLElement | null;
  if (input) input.value = String(value);
  if (valDisplay) valDisplay.textContent = value.toFixed(2);
}

const generateOptionTemplate = (value: string): string => {
  return `<option value="${value}">${value}</option>`;
};
/**
 * Unimplemented function to handle uploaded texture image.
 * This is left for the user to implement (WebGL specific logic).
 */
function handleTextureImageUpload(image: HTMLImageElement, name: string): void {
  state.textureUploadImage = image;

  const selectTargetID =
    state.textureUploadDest === "texture1" ? "texSelect1" : "texSelect2";
  const selectTarget = document.getElementById(
    selectTargetID
  ) as HTMLSelectElement | null;

  const optionTemplate = generateOptionTemplate(name);
  selectTarget?.insertAdjacentHTML("beforeend", optionTemplate);

  document.dispatchEvent(textureUploadEvent);
}

// const geneart

// Launch
document.addEventListener("DOMContentLoaded", init);
