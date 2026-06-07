import {
  NODE_LAYOUT,
  NodeHandleData,
  NodeType,
  ThemeName,
  isContainerNodeType,
} from './types.js';

interface ThemeStyle {
  bgFill: string;
  borderStroke: string;
  headerFill: string;
  titleFill: string;
  bodyFill: string;
  borderWidth: number;
}

export function drawHandle(
  ctx: CanvasRenderingContext2D,
  handle: NodeHandleData,
  x: number,
  y: number
): void {
  const { style, isConnected } = handle;
  const radius = style.size / 2;
  const borderColor = isConnected
    ? style.connectedBorderColor
    : style.disconnectedBorderColor;

  ctx.save();
  ctx.fillStyle = style.backgroundColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = style.borderWidth;

  if (style.shape === 'circle') {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.rect(x - radius, y - radius, style.size, style.size);
    ctx.fill();
    ctx.stroke();
  }

  ctx.restore();
}

const NODE_THEMES: Record<ThemeName, ThemeStyle> = {
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


const G_NODE_THEMES: Record<ThemeName, ThemeStyle> = {
  dark: {
    bgFill:       'rgba(30, 41, 59, 0.25)',
    borderStroke: 'rgba(255, 255, 255, 0.35)',
    headerFill:   'rgba(0, 0, 0, 0.3)',
    titleFill:    '#f8fafc',
    bodyFill:     '#94a3b8',
    borderWidth:  1,
  },
  light: {
    bgFill:       'rgba(248, 250, 252, 0.9)',
    borderStroke: 'rgba(0, 0, 0, 0.4)',
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

  const s = isContainerNodeType(nodeType)
    ? G_NODE_THEMES[theme]
    : NODE_THEMES[theme];

  // Background
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = s.bgFill;
  if (isContainerNodeType(nodeType)) ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 8);
  ctx.fill();
  ctx.globalAlpha = 1.0;

  // Border
  ctx.strokeStyle = s.borderStroke;
  ctx.lineWidth = s.borderWidth;
  if (isContainerNodeType(nodeType)) ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Header bar (only for leaf nodes)
  if (nodeType === 'node' || nodeType === 'composition-child') {
    ctx.fillStyle = s.headerFill;
    ctx.beginPath();
    ctx.roundRect(0, 0, width, NODE_LAYOUT.headerHeight, [8, 8, 0, 0]);
    ctx.fill();
  }

  // Title (only for leaf nodes, group/composition labels are handled elsewhere)
  const titleY = isContainerNodeType(nodeType) ? 20 : NODE_LAYOUT.headerHeight / 2;
  if (nodeType === 'node' || nodeType === 'composition-child') {
    ctx.fillStyle = s.titleFill;
    ctx.font = '600 14px Inter, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 15, titleY);
  }

  // Close icon
  ctx.fillStyle = '#ef4444';
  ctx.font = '14px Inter, sans-serif';
  ctx.fillText('✕', width - NODE_LAYOUT.closeBtnPaddingRight, titleY);

  if (nodeType === 'node' || nodeType === 'composition-child' || nodeType === 'group') {
    // Edit icon
    ctx.fillStyle = s.titleFill;
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('✎', width - NODE_LAYOUT.editBtnPaddingRight, titleY);
  }

  if (nodeType === 'group') {
    // Draw "+" plus button at the bottom center
    const btnX = width / 2;
    const btnY = height - NODE_LAYOUT.plusBtnPaddingBottom;
    const btnRadius = NODE_LAYOUT.plusBtnClickRadius;

    // Background circle
    ctx.fillStyle = theme === 'light' ? 'rgba(0, 0, 0, 0.08)' : 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnRadius, 0, 2 * Math.PI);
    ctx.fill();

    // Border
    ctx.strokeStyle = s.borderStroke;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(btnX, btnY, btnRadius, 0, 2 * Math.PI);
    ctx.stroke();

    // Plus text
    ctx.fillStyle = s.titleFill;
    ctx.font = 'bold 16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', btnX, btnY);
    ctx.textAlign = 'left'; // restore
  }

  if (nodeType === 'composition-child') {
    ctx.fillStyle = s.titleFill;
    ctx.font = '14px Inter, sans-serif';
    ctx.fillText('✎', width - NODE_LAYOUT.editBtnPaddingRight, titleY);
  }

  // Body hint
  ctx.fillStyle = s.bodyFill;
  ctx.font = '12px Inter, sans-serif';
  if (nodeType === "node") ctx.fillText('Drag to move', 10, 50);

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
