import { NodeData, ThemeName } from './types.js';
import { GeometryNode }        from './geometry.js';
import { createProgram, getShaderLocations } from './shader.js';
import { PickFBO }             from './pick-fbo.js';
import { Camera }              from './camera.js';
import { NodeStore }           from './node-store.js';
import { Renderer }            from './renderer.js';
import { UIControls }          from './controls.js';
import { getWorldPosition }    from './scene-graph.js';

/**
 * NodeEditor is the single public class exposed to the entry point.
 * It owns every internal module and wires them together via callbacks.
 * No internal type leaks out of this file's public API.
 */
export class NodeEditor {
  private camera:   Camera;
  private store:    NodeStore;
  private pickFBO:  PickFBO;
  private renderer: Renderer;
  private controls: UIControls;

  // Interaction state
  private bgColor:       [number, number, number, number] = [0.06, 0.09, 0.16, 1.0];
  private theme:         ThemeName = 'dark';
  private draggingNode:  NodeData | null = null;
  private dragOffsetX:   number = 0;
  private dragOffsetY:   number = 0;
  private isPanning:     boolean = false;
  private lastMouseX:    number = 0;
  private lastMouseY:    number = 0;

  private static _instance: NodeEditor | null = null;

  static create(
    canvasId: string,
    textCanvasId: string,
    vsSource: string,
    fsSource: string
  ): NodeEditor {
    if (this._instance) return this._instance;
    this._instance = new NodeEditor(canvasId, textCanvasId, vsSource, fsSource);
    return this._instance;
  }

  private constructor(
    canvasId: string,
    textCanvasId: string,
    vsSource: string,
    fsSource: string
  ) {
    const canvas     = document.getElementById(canvasId) as HTMLCanvasElement;
    const textCanvas = document.getElementById(textCanvasId) as HTMLCanvasElement;
    if (!canvas)     throw new Error(`Canvas "${canvasId}" not found`);
    if (!textCanvas) throw new Error(`Canvas "${textCanvasId}" not found`);

    const gl = canvas.getContext('webgl2') as WebGL2RenderingContext;
    if (!gl) throw new Error('WebGL2 is not supported in this browser');

    const textCtx = textCanvas.getContext('2d');
    if (!textCtx) throw new Error('2D canvas context not supported');

    const program   = createProgram(gl, vsSource, fsSource);
    const locations = getShaderLocations(gl, program);
    const geometry  = new GeometryNode(gl, 'rounded-square');

    this.camera  = new Camera();
    this.store   = new NodeStore(gl, textCtx, textCanvas);
    this.pickFBO = new PickFBO(gl, canvas.width, canvas.height);

    this.renderer = new Renderer(
      gl, canvas, program, locations, geometry,
      this.store, this.camera,
      () => this.bgColor
    );

    const container = document.getElementById('controls-container');
    if (!container) throw new Error('"controls-container" element not found');

    //prettier-ignore
    this.controls = new UIControls(canvas, container, {
      onAddNode:        ()       => this.handleAddNode(canvas),
      onDeleteNode:     ()       => this.handleDeleteSelected(),
      onBgColorChange:  (r,g,b,a)=> { this.bgColor = [r, g, b, a]; },
      onThemeChange:    (theme)  => { this.theme = theme; this.store.regenerateTextures(theme); },
      onMouseDown:      (e)      => this.handleMouseDown(e, canvas),
      onMouseMove:      (e)      => this.handleMouseMove(e, canvas),
      onMouseUp:        ()       => this.handleMouseUp(),
      onWheel:          (e)      => this.handleWheel(e, canvas),
    });

    window.addEventListener('resize', () => this.handleResize(canvas));
    this.handleResize(canvas);
  }

  render(): void {
    this.renderer.startLoop();
  }


  private handleResize(canvas: HTMLCanvasElement): void {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    this.renderer.resize(canvas.width, canvas.height);
    this.pickFBO.resize(canvas.width, canvas.height);
  }

  private handleAddNode(canvas: HTMLCanvasElement): void {
    const screenX = Math.random() * (canvas.width  - 200) + 100;
    const screenY = Math.random() * (canvas.height - 200) + 100;
    const { x, y } = this.camera.screenToWorld(screenX, screenY);
    const label = `Node ${this.store.nextNodeId}`;
    this.store.add(x, y, label, this.theme);
  }

  private handleDeleteSelected(): void {
    const selected = this.store.getSelected();
    if (!selected) return;
    this.store.remove(selected.id);
    this.controls.disableDelete();
  }

  private pick(screenX: number, screenY: number): number {
    this.pickFBO.bind();
    this.renderer['gl'].clearColor(1.0, 1.0, 1.0, 1.0);
    this.renderer['gl'].clear(
      this.renderer['gl'].COLOR_BUFFER_BIT | this.renderer['gl'].DEPTH_BUFFER_BIT
    );
    this.renderer.drawNodes(true);

    const pixels = this.pickFBO.readPixel(screenX, screenY);
    this.pickFBO.unbind();

    if (pixels[0] === 255 && pixels[1] === 255 && pixels[2] === 255) {
      this.store.deselectAll();
      this.controls.disableDelete();
      return 0;
    }
    return pixels[0] + (pixels[1] << 8) + (pixels[2] << 16);
  }

  private handleMouseDown(e: MouseEvent, canvas: HTMLCanvasElement): void {
    // Middle mouse or Alt+Left → pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.startPan(e.clientX, e.clientY);
      return;
    }

    const { left, top } = canvas.getBoundingClientRect();
    const screenX = e.clientX - left;
    const screenY = e.clientY - top;
    const nodeId  = this.pick(screenX, screenY);
    const node    = this.store.nodes.get(nodeId);

    if (!node) {
      // Clicked empty space - pan
      this.startPan(e.clientX, e.clientY);
      return;
    }

    this.controls.enableDelete();
    this.store.deselectAll();
    node.isSelected   = true;
    this.draggingNode = node;

    // Store drag offset in world space so the node doesn't snap under the cursor
    const { x: worldX, y: worldY } = this.camera.screenToWorld(screenX, screenY);
    const nodeWorld = getWorldPosition(node.id, this.store.nodes);
    this.dragOffsetX = worldX - nodeWorld.x;
    this.dragOffsetY = worldY - nodeWorld.y;
  }

  private startPan(clientX: number, clientY: number): void {
    this.isPanning  = true;
    this.lastMouseX = clientX;
    this.lastMouseY = clientY;
  }

  private handleMouseMove(e: MouseEvent, canvas: HTMLCanvasElement): void {
    if (this.isPanning) {
      this.camera.pan(e.clientX - this.lastMouseX, e.clientY - this.lastMouseY);
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      return;
    }

    if (!this.draggingNode) return;

    const { left, top } = canvas.getBoundingClientRect();
    const { x: worldX, y: worldY } = this.camera.screenToWorld(
      e.clientX - left,
      e.clientY - top
    );

    // Target world position of the node's top-left corner
    const targetX = worldX - this.dragOffsetX;
    const targetY = worldY - this.dragOffsetY;

    // Convert target world pos - local pos relative to parent (if any)
    if (this.draggingNode.parentId === null) {
      this.draggingNode.localX = targetX;
      this.draggingNode.localY = targetY;
    } else {
      const parentWorld = getWorldPosition(this.draggingNode.parentId, this.store.nodes);
      this.draggingNode.localX = targetX - parentWorld.x;
      this.draggingNode.localY = targetY - parentWorld.y;
    }
  }

  private handleMouseUp(): void {
    this.isPanning    = false;
    this.draggingNode = null;
  }

  private handleWheel(e: WheelEvent, canvas: HTMLCanvasElement): void {
    e.preventDefault();
    const { left, top } = canvas.getBoundingClientRect();
    this.camera.zoomAt(e.clientX - left, e.clientY - top, e.deltaY);
  }
}
