import { NodeData, NodeShaderLocations, BGShaderLocations } from "./types.js";
import { BGGeometryNode, GeometryNode } from "./geometry.js";
import { Camera } from "./camera.js";
import { NodeStore } from "./node-store.js";
import { getWorldPosition } from "./scene-graph.js";

/**
 * Owns the WebGL draw loop and all rendering logic.
 * It knows nothing about input events or UI — it only reads Camera and NodeStore state.
 */
export class Renderer {
  private modelMatrix: Matrix4 = new Matrix4();
  private projMatrix: Matrix4 = new Matrix4();

  constructor(
    private gl: WebGL2RenderingContext,
    private canvas: HTMLCanvasElement,
    private bgCanvas: HTMLCanvasElement,
    private program: WebGLProgram,
    private locations: NodeShaderLocations,
    private geometry: GeometryNode,
    private bgGeometry: BGGeometryNode,
    private store: NodeStore,
    private camera: Camera,
    private bgProgram: WebGLProgram,
    private bgLocations: BGShaderLocations,
    /** Callback so Renderer never stores bgColor itself — it belongs to the editor. */
    private getBgColor: () => [number, number, number, number]
  ) {}

  /** Call once after each canvas resize to update the orthographic projection. */
  resize(width: number, height: number): void {
    this.gl.viewport(0, 0, width, height);
    // Origin top-left, y-axis pointing down — matches screen and 2D canvas convention
    this.projMatrix.setOrtho(0, width, height, 0, -1, 1);
  }

  /** Start the RAF-driven render loop. */
  startLoop(): void {
    requestAnimationFrame(this.tick.bind(this));
  }

  private tick(): void {
    this.drawBGFrame();
    this.drawFrame();
    requestAnimationFrame(this.tick.bind(this));
  }

  private drawFrame(): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    // gl.clearColor(0.0, 0.0, 0.0, 0.0);
    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawNodes(false);
  }

  private drawBGFrame(): void {
    const gl = this.gl;
    // gl.viewport(0, 0, this.bgCanvas.width, this.bgCanvas.height);
    const [r, g, b, a] = this.getBgColor();
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    this.drawBG(false);
  }

  /**
   * Draw all visible nodes.
   * @param picking — when true, each node is drawn as a flat pick-color silhouette
   *                  (blend disabled, no texture) for the off-screen pick render pass.
   */
  drawNodes(picking: boolean): void {
    const gl = this.gl;
    gl.useProgram(this.program);

    if (picking) {
      gl.disable(gl.BLEND);
    } else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    // Bind shared geometry buffers once for all nodes
    gl.bindBuffer(gl.ARRAY_BUFFER, this.geometry.vertexBuffer);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.geometry.indexBuffer);

    const stride = 4 * Float32Array.BYTES_PER_ELEMENT;
    gl.vertexAttribPointer(
      this.locations.a_Position,
      2,
      gl.FLOAT,
      false,
      stride,
      0
    );
    gl.enableVertexAttribArray(this.locations.a_Position);
    gl.vertexAttribPointer(
      this.locations.a_TexCoord,
      2,
      gl.FLOAT,
      false,
      stride,
      2 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.enableVertexAttribArray(this.locations.a_TexCoord);

    // Upload camera matrices (shared by all nodes this frame)
    gl.uniformMatrix4fv(
      this.locations.u_ProjMatrix,
      false,
      this.projMatrix.elements
    );
    gl.uniformMatrix4fv(
      this.locations.u_ViewMatrix,
      false,
      this.camera.getViewMatrix().elements
    );

    for (const node of this.store.visibleNodes()) {
      // Scene graph: resolve the absolute world position before building model matrix
      const { x, y } = getWorldPosition(node.id, this.store.allNodesMap);
      this.drawNode(node, x, y, picking);
    }
  }

  /**
   * Draw all visible nodes.
   * @param picking — when true, each node is drawn as a flat pick-color silhouette
   *                  (blend disabled, no texture) for the off-screen pick render pass.
   */
  drawBG(picking: boolean): void {
    const gl = this.gl;

    gl.useProgram(this.bgProgram);

    if (picking) {
      gl.disable(gl.BLEND);
    } else {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.bgGeometry.vertexBuffer);
    gl.vertexAttribPointer(
      this.bgLocations.a_Position,
      2,
      gl.FLOAT,
      false,
      0,
      0
    );
    gl.enableVertexAttribArray(this.bgLocations.a_Position);

    gl.uniform4f(this.bgLocations.u_Color, 0.1, 0.1, 0.1, 0.05); // dull gray pattern
    gl.drawArrays(this.bgGeometry.primitiveType, 0, this.bgGeometry.length);
  }

  private drawNode(
    node: NodeData,
    worldX: number,
    worldY: number,
    picking: boolean
  ): void {
    const gl = this.gl;

    if (picking) {
      // Flat color silhouette — the RGB encodes the node id
      gl.uniform1i(this.locations.u_UseTexture, 0);
      gl.uniform4f(
        this.locations.u_Color,
        node.pickColor[0],
        node.pickColor[1],
        node.pickColor[2],
        1.0
      );
      this.setModelMatrix(worldX, worldY, node.width, node.height);
    } else {
      if (node.isDropTarget) {
        this.setModelMatrix(
          worldX - 6,
          worldY - 6,
          node.width + 12,
          node.height + 12
        );
        gl.uniform1i(this.locations.u_UseTexture, 0);
        gl.uniform4f(this.locations.u_Color, 0.13, 0.86, 0.39, 0.8); // Green glow
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      } else if (node.isSelected) {
        // Selection glow: draw a slightly larger quad behind the node
        this.setModelMatrix(
          worldX - 4,
          worldY - 4,
          node.width + 8,
          node.height + 8
        );
        gl.uniform1i(this.locations.u_UseTexture, 0);
        gl.uniform4f(this.locations.u_Color, 0.23, 0.51, 0.96, 0.8);
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }

      // Main node quad with texture
      this.setModelMatrix(worldX, worldY, node.width, node.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, node.texture);
      gl.uniform1i(this.locations.u_UseTexture, 1);
      gl.uniform1i(this.locations.u_Sampler, 0);
    }

    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
  }

  private setModelMatrix(x: number, y: number, w: number, h: number): void {
    this.modelMatrix.setIdentity();
    this.modelMatrix.translate(x, y, 0.0);
    this.modelMatrix.scale(w, h, 1.0);
    this.gl.uniformMatrix4fv(
      this.locations.u_ModelMatrix,
      false,
      this.modelMatrix.elements
    );
  }
}
