import { EdgeHeadSkinId } from './types.js';

export interface EdgeHeadTextureRegion {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
}

interface SkinLayout {
  id: EdgeHeadSkinId;
  draw: (ctx: CanvasRenderingContext2D, size: number) => void;
}

const ATLAS_COLUMNS = 4;
const ATLAS_ROWS = 1;
const CELL_SIZE = 128;

const SKIN_LAYOUTS: SkinLayout[] = [
  {
    id: 'arrow',
    draw: (ctx, size) => {
      const cx = size / 2;
      const cy = size / 2;
      const headLength = size * 0.58;
      const headWidth = size * 0.52;
      const stemWidth = size * 0.18;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.beginPath();
      ctx.moveTo(cx + headLength * 0.5, cy);
      ctx.lineTo(cx - headLength * 0.15, cy - headWidth * 0.5);
      ctx.lineTo(cx - headLength * 0.15, cy - stemWidth * 0.5);
      ctx.lineTo(cx - headLength * 0.48, cy - stemWidth * 0.5);
      ctx.lineTo(cx - headLength * 0.48, cy + stemWidth * 0.5);
      ctx.lineTo(cx - headLength * 0.15, cy + stemWidth * 0.5);
      ctx.lineTo(cx - headLength * 0.15, cy + headWidth * 0.5);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'chevron',
    draw: (ctx, size) => {
      const cx = size / 2;
      const cy = size / 2;
      const w = size * 0.55;
      const h = size * 0.38;

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)';
      ctx.lineWidth = size * 0.12;
      ctx.beginPath();
      ctx.moveTo(cx - w * 0.35, cy - h);
      ctx.lineTo(cx + w * 0.28, cy);
      ctx.lineTo(cx - w * 0.35, cy + h);
      ctx.stroke();
    },
  },
  {
    id: 'diamond',
    draw: (ctx, size) => {
      const cx = size / 2;
      const cy = size / 2;
      const w = size * 0.45;
      const h = size * 0.34;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.beginPath();
      ctx.moveTo(cx + w, cy);
      ctx.lineTo(cx, cy - h);
      ctx.lineTo(cx - w, cy);
      ctx.lineTo(cx, cy + h);
      ctx.closePath();
      ctx.fill();
    },
  },
  {
    id: 'pill',
    draw: (ctx, size) => {
      const cx = size / 2;
      const cy = size / 2;
      const width = size * 0.64;
      const height = size * 0.26;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.beginPath();
      ctx.roundRect(cx - width / 2, cy - height / 2, width, height, height / 2);
      ctx.fill();
    },
  },
];

export class EdgeHeadTextureLibrary {
  readonly texture: WebGLTexture;
  private regions: Record<EdgeHeadSkinId, EdgeHeadTextureRegion>;

  constructor(private gl: WebGL2RenderingContext) {
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = CELL_SIZE * ATLAS_COLUMNS;
    atlasCanvas.height = CELL_SIZE * ATLAS_ROWS;

    const ctx = atlasCanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Unable to create 2D context for edge-head atlas');
    }

    ctx.clearRect(0, 0, atlasCanvas.width, atlasCanvas.height);
    ctx.save();
    ctx.translate(0, 0);

    this.regions = {
      arrow: this.buildRegion(0),
      chevron: this.buildRegion(1),
      diamond: this.buildRegion(2),
      pill: this.buildRegion(3),
    };

    for (let i = 0; i < SKIN_LAYOUTS.length; i++) {
      const skin = SKIN_LAYOUTS[i];
      const cellX = i * CELL_SIZE;

      ctx.save();
      ctx.translate(cellX, 0);
      skin.draw(ctx, CELL_SIZE);
      ctx.restore();
    }

    ctx.restore();

    const texture = gl.createTexture();
    if (!texture) {
      throw new Error('Unable to allocate edge-head texture atlas');
    }

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      atlasCanvas
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.texture = texture;
  }

  getRegion(skinId: EdgeHeadSkinId): EdgeHeadTextureRegion {
    return this.regions[skinId] ?? this.regions.arrow;
  }

  private buildRegion(index: number): EdgeHeadTextureRegion {
    const u0 = index / ATLAS_COLUMNS;
    const u1 = (index + 1) / ATLAS_COLUMNS;
    return {
      u0,
      v0: 0,
      u1,
      v1: 1,
    };
  }
}
