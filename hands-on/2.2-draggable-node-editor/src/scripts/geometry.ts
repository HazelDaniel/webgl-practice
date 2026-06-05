import { GeometryMeshType } from './types.js';

/**
 * Owns the WebGL vertex and index buffers for a given mesh shape.
 * Currently supports 'rounded-square' (a unit quad from (0,0) to (1,1)).
 */
export class GeometryNode {
  public vertexBuffer: WebGLBuffer | null = null;
  public indexBuffer: WebGLBuffer | null = null;

  constructor(private gl: WebGL2RenderingContext, meshType: GeometryMeshType) {
    switch (meshType) {
      case 'rounded-square':
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
