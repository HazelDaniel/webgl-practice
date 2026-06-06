import { BGGeometryMeshType, GeometryMeshType } from "./types.js";

/**
 * Owns the WebGL vertex and index buffers for a given mesh shape.
 * Currently supports 'rounded-square' (a unit quad from (0,0) to (1,1)).
 */
export class GeometryNode {
  public vertexBuffer: WebGLBuffer | null = null;
  public indexBuffer: WebGLBuffer | null = null;

  constructor(private gl: WebGL2RenderingContext, meshType: GeometryMeshType) {
    switch (meshType) {
      case "rounded-square":
        this.generateSquareMesh();
        break;
    }
  }

  private generateSquareMesh(): void {
    const gl = this.gl;
    //prettier-ignore
    const vertices = new Float32Array([
      // X,   Y,   U,   V
       0.0, 0.0, 0.0, 0.0, // Top-Left
       0.0, 1.0, 0.0, 1.0, // Bottom-Left
       1.0, 1.0, 1.0, 1.0, // Bottom-Right
       1.0, 0.0, 1.0, 0.0, // Top-Right
    ]);
    const indices = new Uint16Array([0, 1, 2, 0, 2, 3]);

    const vertexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const indexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

    this.vertexBuffer = vertexBuffer;
    this.indexBuffer = indexBuffer;
  }
}

/**
 * Owns the WebGL vertex and index buffers for a given mesh shape.
 * Currently supports 'dotted' (a dotted bg pattern).
 */
export class BGGeometryNode {
  public vertexBuffer: WebGLBuffer | null = null;
  public length: number = 0;
  public primitiveType: number = -1;

  constructor(
    private gl: WebGL2RenderingContext,
    meshType: BGGeometryMeshType,
    private readonly canvas: HTMLCanvasElement
  ) {
    switch (meshType) {
      case "dotted":
        this.generateDotMesh();
        break;
      case "grid":
        this.generateGridMesh();
        break;
    }
  }

  private generateDotMesh(): void {
    const gl = this.gl;
    const Vsegments = this.canvas.height / 10;
    const Hsegments = this.canvas.width / 10;
    //prettier-ignore
    const vertices = new Float32Array((Vsegments + 1) * (Hsegments + 1) * 2);

    const stepX = (10 / this.canvas.width) * 2;
    const stepY = (10 / this.canvas.height) * 2;

    for (let i = 0; i <= Vsegments; i++) {
      for (let j = 0; j <= Hsegments; j++) {
        let y = i,
          x = j;
        x = -1 + j * stepX;
        y = -1 + i * stepY + 0.1;

        const index = (i * (Hsegments + 1) + j) * 2;
        vertices[index] = x;
        vertices[index + 1] = y;
      }
    }

    const vertexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    this.vertexBuffer = vertexBuffer;
    this.primitiveType = gl.POINTS;

    this.length = vertices.length / 2;
  }

  private generateGridMesh(): void {
    const gl = this.gl;
    const lines: number[] = [];
    const divisionsX = this.canvas.width / 20;
    const divisionsY = this.canvas.height / 20;
    const stepX = 2.0 / divisionsX;
    const stepY = 2.0 / divisionsY;

    for (let i = 0; i <= Math.max(divisionsX, divisionsY); i++) {
      const posX = -1.0 + i * stepX;
      const posY = -1.0 + i * stepY;
      lines.push(posY, -1.0, posY, 1.0);
      lines.push(-1.0, posX, 1.0, posX);
    }

    const vertexBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lines), gl.STATIC_DRAW);

    this.vertexBuffer = vertexBuffer;


    this.length = lines.length / 2;
    this.primitiveType = gl.LINES;
  }
}
