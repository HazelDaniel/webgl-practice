import {
  NodeData,
  NodeShaderLocations,
  BGShaderLocations,
  ConnectionPreviewData,
} from "./types.js";
import { BGGeometryNode, GeometryNode } from "./geometry.js";
import { Camera } from "./camera.js";
import { EdgeStore } from "./edge-store.js";
import {
  EdgeHeadTextureLibrary,
  EdgeHeadTextureRegion,
} from "./edge-head-textures.js";
import {
  buildConnectionPreviewGeometry,
  buildEdgeRouteGeometry,
  EdgeRouteGeometry,
} from "./edge-geometry.js";
import { NodeStore } from "./node-store.js";
import { getWorldPosition } from "./scene-graph.js";
import { drawHandle } from "./texture.js";
import { getHandleScreenGeometry } from "./handle-geometry.js";

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
    private edgeStore: EdgeStore,
    private camera: Camera,
    private bgProgram: WebGLProgram,
    private bgLocations: BGShaderLocations,
    private labelCanvas: HTMLCanvasElement,
    private getConnectionPreview: () => ConnectionPreviewData | null,
    /** Callback so Renderer never stores bgColor itself — it belongs to the editor. */
    private getBgColor: () => [number, number, number, number]
  ) {
    this.labelCtx = labelCanvas.getContext('2d');
    this.edgeVertexBuffer = gl.createBuffer();
    this.edgeHeadBuffer = gl.createBuffer();
    if (!this.edgeVertexBuffer) {
      throw new Error('Unable to allocate edge vertex buffer');
    }
    if (!this.edgeHeadBuffer) {
      throw new Error('Unable to allocate edge head buffer');
    }

    this.edgeHeadTextures = new EdgeHeadTextureLibrary(gl);
  }

  private labelCtx: CanvasRenderingContext2D | null;
  private edgeVertexBuffer: WebGLBuffer;
  private edgeHeadBuffer: WebGLBuffer;
  private edgeHeadTextures: EdgeHeadTextureLibrary;
  private edgeFrame: EdgeRouteGeometry[] = [];

  /** Call once after each canvas resize to update the orthographic projection. */
  resize(width: number, height: number): void {
    this.gl.viewport(0, 0, width, height);
    // Origin top-left, y-axis pointing down — matches screen and 2D canvas convention
    this.projMatrix.setOrtho(0, width, height, 0, -1, 1);
    
    this.labelCanvas.width = width;
    this.labelCanvas.height = height;
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
    this.drawEdges();
    this.drawNodes(false);
    this.drawOverlay();
  }

  private drawOverlay(): void {
    if (!this.labelCtx) return;
    this.labelCtx.clearRect(0, 0, this.labelCanvas.width, this.labelCanvas.height);

    this.drawConnectionPreview();
    this.drawEdgeLabels();

    for (const node of this.store.visibleNodes()) {
      this.drawHandles(node);
    }

    this.drawGroupLabels();
  }

  private drawConnectionPreview(): void {
    if (!this.labelCtx) return;

    const preview = this.getConnectionPreview();
    if (!preview) return;

    const route = buildConnectionPreviewGeometry(
      preview.sourceNodeId,
      preview.sourceHandleSide,
      preview.screenX,
      preview.screenY,
      this.store,
      this.camera
    );
    if (!route) return;

    this.labelCtx.save();
    this.labelCtx.beginPath();
    this.labelCtx.lineWidth = 2;
    this.labelCtx.strokeStyle = 'rgba(96, 165, 250, 0.95)';
    this.labelCtx.setLineDash([8, 6]);
    this.labelCtx.moveTo(route.screenPoints[0].x, route.screenPoints[0].y);
    for (let i = 1; i < route.screenPoints.length; i++) {
      this.labelCtx.lineTo(route.screenPoints[i].x, route.screenPoints[i].y);
    }
    this.labelCtx.stroke();
    this.labelCtx.restore();
  }

  private drawEdgeLabels(): void {
    if (!this.labelCtx) return;

    this.labelCtx.save();
    this.labelCtx.font = '500 12px Inter, sans-serif';
    this.labelCtx.textBaseline = 'middle';
    this.labelCtx.fillStyle = 'rgba(226, 232, 240, 0.95)';

    for (const route of this.edgeFrame) {
      if (!route.edge.label) continue;

      const x = route.labelScreenPoint.x;
      const y = route.labelScreenPoint.y - 12;
      const isSelected = route.edge.isSelected;

      const metrics = this.labelCtx.measureText(route.edge.label);
      const padX = 8;
      const padY = 4;
      const width = metrics.width + padX * 2;
      const height = 20;

      this.labelCtx.fillStyle = isSelected
        ? 'rgba(69, 26, 3, 0.92)'
        : 'rgba(15, 23, 42, 0.72)';
      this.labelCtx.beginPath();
      this.labelCtx.roundRect(x - width / 2, y - height / 2, width, height, 8);
      this.labelCtx.fill();

      this.labelCtx.fillStyle = isSelected
        ? 'rgba(255, 243, 205, 0.98)'
        : 'rgba(226, 232, 240, 0.95)';
      this.labelCtx.fillText(route.edge.label, x - metrics.width / 2, y);
    }

    this.labelCtx.restore();
  }

  private drawGroupLabels(): void {
    if (!this.labelCtx) return;

    this.labelCtx.font = '600 14px Inter, sans-serif';
    this.labelCtx.textBaseline = 'middle';

    for (const node of this.store.visibleNodes()) {
      if (node.nodeType !== 'group') continue;

      const screenPos = this.camera.worldToScreen(node.localX, node.localY);
      this.labelCtx.fillStyle = '#f8fafc';
      this.labelCtx.fillText(node.text, screenPos.x + 15, screenPos.y + 20);
    }
  }

  private drawHandles(node: NodeData): void {
    if (!this.labelCtx || node.handles.length === 0) return;

    const { x, y } = getWorldPosition(node.id, this.store.allNodesMap);
    const zoom = this.camera.zoom;
    const { panX, panY } = this.camera;

    for (const handle of node.handles) {
      const geometry = getHandleScreenGeometry(
        x,
        y,
        node,
        handle,
        zoom,
        panX,
        panY
      );
      drawHandle(this.labelCtx, handle, geometry.centerX, geometry.centerY);
    }
  }

  private drawEdges(): void {
    const gl = this.gl;
    const visibleEdges = this.edgeStore.allEdges().filter((edge) => edge.visible);
    this.edgeFrame = [];

    if (visibleEdges.length === 0) return;

    const lineVertices: number[] = [];
    const headVertices: number[] = [];
    const lineDraws: Array<{ first: number; count: number }> = [];
    const headDraws: Array<{ first: number; count: number }> = [];
    let lineCursor = 0;
    let headCursor = 0;

    for (const edge of visibleEdges) {
      const geometry = buildEdgeRouteGeometry(edge, this.store, this.camera);
      if (!geometry || geometry.worldPoints.length < 2) continue;

      this.edgeFrame.push(geometry);
      if (edge.isSelected) continue;

      lineDraws.push({ first: lineCursor, count: geometry.worldPoints.length });
      lineCursor += geometry.worldPoints.length;

      for (const point of geometry.worldPoints) {
        lineVertices.push(point.x, point.y, 0, 0);
      }

      if (geometry.arrowhead) {
        const region = this.edgeHeadTextures.getRegion(edge.headSkinId);
        headDraws.push({ first: headCursor, count: 6 });
        headCursor += 6;
        headVertices.push(...this.buildHeadQuadVertices(geometry.arrowhead, region));
      }
    }

    gl.useProgram(this.program);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.bindEdgeVertexBuffer(this.edgeVertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(lineVertices), gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    gl.uniformMatrix4fv(this.locations.u_ProjMatrix, false, this.projMatrix.elements);
    gl.uniformMatrix4fv(this.locations.u_ViewMatrix, false, this.camera.getViewMatrix().elements);
    this.modelMatrix.setIdentity();
    gl.uniformMatrix4fv(this.locations.u_ModelMatrix, false, this.modelMatrix.elements);
    gl.uniform1i(this.locations.u_UseTexture, 0);

    gl.uniform4f(this.locations.u_Color, 0.38, 0.62, 1.0, 0.72);
    let vertexOffset = 0;
    for (const draw of lineDraws) {
      gl.drawArrays(gl.LINE_STRIP, vertexOffset, draw.count);
      vertexOffset += draw.count;
    }

    if (headVertices.length > 0) {
      this.bindEdgeVertexBuffer(this.edgeHeadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(headVertices), gl.DYNAMIC_DRAW);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.edgeHeadTextures.texture);
      gl.uniform1i(this.locations.u_UseTexture, 1);
      gl.uniform1i(this.locations.u_Sampler, 0);
      gl.uniform4f(this.locations.u_Color, 1, 1, 1, 1);
      let headOffset = 0;
      for (const draw of headDraws) {
        gl.drawArrays(gl.TRIANGLES, headOffset, draw.count);
        headOffset += draw.count;
      }
    }

    const selectedEdges = visibleEdges.filter((edge) => edge.isSelected);
    for (const selectedEdge of selectedEdges) {
      const selectedGeometry = buildEdgeRouteGeometry(selectedEdge, this.store, this.camera);
      if (selectedGeometry) {
        this.drawSingleEdge(
          selectedGeometry,
          'rgba(245, 158, 11, 0.98)',
          'rgba(251, 191, 36, 1)'
        );
      }
    }
  }

  private drawSingleEdge(
    geometry: EdgeRouteGeometry,
    strokeColor: string,
    headColor: string
  ): void {
    const gl = this.gl;

    this.bindEdgeVertexBuffer(this.edgeVertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(
        geometry.worldPoints.flatMap((point) => [point.x, point.y, 0, 0])
      ),
      gl.DYNAMIC_DRAW
    );

    gl.uniformMatrix4fv(this.locations.u_ProjMatrix, false, this.projMatrix.elements);
    gl.uniformMatrix4fv(this.locations.u_ViewMatrix, false, this.camera.getViewMatrix().elements);
    this.modelMatrix.setIdentity();
    gl.uniformMatrix4fv(this.locations.u_ModelMatrix, false, this.modelMatrix.elements);
    gl.uniform1i(this.locations.u_UseTexture, 0);
    gl.uniform4f(this.locations.u_Color, ...this.parseColor(strokeColor));
    gl.drawArrays(gl.LINE_STRIP, 0, geometry.worldPoints.length);

    if (geometry.arrowhead) {
      const region = this.edgeHeadTextures.getRegion(geometry.edge.headSkinId);
      const quad = this.buildHeadQuadVertices(geometry.arrowhead, region);
      this.bindEdgeVertexBuffer(this.edgeHeadBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quad), gl.DYNAMIC_DRAW);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.edgeHeadTextures.texture);
      gl.uniform1i(this.locations.u_UseTexture, 1);
      gl.uniform1i(this.locations.u_Sampler, 0);
      gl.uniform4f(this.locations.u_Color, ...this.parseColor(headColor));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
  }

  private buildHeadQuadVertices(
    head: NonNullable<EdgeRouteGeometry["arrowhead"]>,
    region: EdgeHeadTextureRegion
  ): number[] {
    const headLength = 18;
    const headWidth = 12;
    const halfWidth = headWidth / 2;

    const tangentX = head.tangent.x;
    const tangentY = head.tangent.y;
    const backX = -tangentX;
    const backY = -tangentY;
    const normalX = -tangentY;
    const normalY = tangentX;

    const baseX = head.tip.x + backX * headLength;
    const baseY = head.tip.y + backY * headLength;

    const topLeft = {
      x: baseX + normalX * halfWidth,
      y: baseY + normalY * halfWidth,
    };
    const bottomLeft = {
      x: baseX - normalX * halfWidth,
      y: baseY - normalY * halfWidth,
    };
    const bottomRight = {
      x: head.tip.x - normalX * halfWidth,
      y: head.tip.y - normalY * halfWidth,
    };
    const topRight = {
      x: head.tip.x + normalX * halfWidth,
      y: head.tip.y + normalY * halfWidth,
    };

    return [
      topLeft.x,
      topLeft.y,
      region.u0,
      region.v0,
      bottomLeft.x,
      bottomLeft.y,
      region.u0,
      region.v1,
      bottomRight.x,
      bottomRight.y,
      region.u1,
      region.v1,
      topLeft.x,
      topLeft.y,
      region.u0,
      region.v0,
      bottomRight.x,
      bottomRight.y,
      region.u1,
      region.v1,
      topRight.x,
      topRight.y,
      region.u1,
      region.v0,
    ];
  }

  private bindEdgeVertexBuffer(buffer: WebGLBuffer): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

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
  }

  private parseColor(color: string): [number, number, number, number] {
    if (color.startsWith('rgba(')) {
      const parts = color
        .slice(5, -1)
        .split(',')
        .map((part) => part.trim());
      return [
        Number(parts[0]) / 255,
        Number(parts[1]) / 255,
        Number(parts[2]) / 255,
        Number(parts[3]),
      ];
    }

    return [0.38, 0.62, 1.0, 1.0];
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

    gl.uniform4f(this.bgLocations.u_Color, 0.1, 0.1, 0.1, 0.02); // dull gray pattern
    gl.uniform1i(
      this.bgLocations.u_UsePointMask,
      this.bgGeometry.primitiveType === gl.POINTS ? 1 : 0
    );
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
      gl.uniform4f(this.locations.u_Color, 1, 1, 1, 1);
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
