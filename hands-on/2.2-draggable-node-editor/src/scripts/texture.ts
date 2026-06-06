import { ThemeName, NodeType } from './types.js';

interface ThemeStyle {
  bgFill: string;
  borderStroke: string;
  headerFill: string;
  titleFill: string;
  bodyFill: string;
  borderWidth: number;
}

const THEMES: Record<ThemeName, ThemeStyle> = {
  dark: {
    bgFill:       'rgba(30, 41, 59, 0.8)',
    borderStroke: 'rgba(255, 255, 255, 0.1)',
    headerFill:   'rgba(0, 0, 0, 0.3)',
    titleFill:    '#f8fafc',
    bodyFill:     '#94a3b8',
    borderWidth:  1,
  },
  light: {
    bgFill:       'rgba(248, 250, 252, 0.9)',
    borderStroke: 'rgba(0, 0, 0, 0.1)',
    headerFill:   'rgba(226, 232, 240, 1)',
    titleFill:    '#0f172a',
    bodyFill:     '#475569',
    borderWidth:  1,
  },
  neon: {
    bgFill:       'rgba(10, 10, 20, 0.9)',
    borderStroke: '#06b6d4',
    headerFill:   'rgba(6, 182, 212, 0.2)',
    titleFill:    '#cffafe',
    bodyFill:     '#67e8f9',
    borderWidth:  2,
  },
};

/**
 * Renders node UI into an off-screen 2D canvas, then uploads it as a WebGL texture.
 * The caller is responsible for deleting the returned texture when the node is destroyed.
 */
export function createTextTexture(
  gl: WebGL2RenderingContext,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  text: string,
  width: number,
  height: number,
  theme: ThemeName = 'dark',
  nodeType: NodeType = 'node'
): WebGLTexture {
  canvas.width = width;
  canvas.height = height;

  const s = THEMES[theme];

  // Background
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = s.bgFill;
  if (nodeType === 'group') ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 8);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Border
  ctx.strokeStyle = s.borderStroke;
  ctx.lineWidth = s.borderWidth;
  if (nodeType === 'group') ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Header bar
  ctx.fillStyle = s.headerFill;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, 30, [8, 8, 0, 0]);
  ctx.fill();

  // Title
  ctx.fillStyle = s.titleFill;
  ctx.font = '600 14px Inter, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 10, 15);

  // Close icon
  ctx.fillStyle = '#ef4444';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('✕', width - 20, 15);

  // Body hint
  ctx.fillStyle = s.bodyFill;
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText('Drag to move', 10, 50);

  // Upload to WebGL
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  return tex;
}
