import { NodeData, ThemeName, NodeType, NODE_LAYOUT } from "./types.js";
import { BGGeometryNode, GeometryNode } from "./geometry.js";
import {
  createProgram,
  getBGShaderLocations,
  getShaderLocations,
} from "./shader.js";
import { PickFBO } from "./pick-fbo.js";
import { Camera } from "./camera.js";
import { NodeStore } from "./node-store.js";
import { Renderer } from "./renderer.js";
import { UIControls } from "./controls.js";
import { getWorldPosition } from "./scene-graph.js";

/**
 * NodeEditor is the single public class exposed to the entry point.
 * It owns every internal module and wires them together via callbacks.
 * No internal type leaks out of this file's public API.
 */
export class NodeEditor {
  private camera: Camera;
  private store: NodeStore;
  private pickFBO: PickFBO;
  private renderer: Renderer;
  private controls: UIControls;

  // Interaction state
  private bgColor: [number, number, number, number] = [7/255, 7/255, 8/255, 1.0];
  private theme: ThemeName = "dark";
  private draggingNode: NodeData | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private isPanning: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  private static _instance: NodeEditor | null = null;

  static create(
    canvasId: string,
    textCanvasId: string,
    backgroundCanvasId: string,
    vsSource: string,
    fsSource: string,
    bgVsSource: string,
    bgFsSource: string
  ): NodeEditor {
    if (this._instance) return this._instance;
    this._instance = new NodeEditor(
      canvasId,
      textCanvasId,
      backgroundCanvasId,
      vsSource,
      fsSource,
      bgVsSource,
      bgFsSource
    );
    return this._instance;
  }

  private constructor(
    canvasId: string,
    textCanvasId: string,
    backgroundCanvasId: string,
    vsSource: string,
    fsSource: string,
    bgVsSource: string,
    bgFsSource: string
  ) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const textCanvas = document.getElementById(
      textCanvasId
    ) as HTMLCanvasElement;
    const backgroundCanvas = document.getElementById(
      backgroundCanvasId
    ) as HTMLCanvasElement;
    if (!canvas) throw new Error(`Canvas "${canvasId}" not found`);
    if (!textCanvas) throw new Error(`Canvas "${textCanvasId}" not found`);
    if (!backgroundCanvas)
      throw new Error(`Canvas "${backgroundCanvasId}" not found`);

    const gl = canvas.getContext("webgl2") as WebGL2RenderingContext;
    if (!gl) throw new Error("WebGL2 is not supported in this browser");

    const textCtx = textCanvas.getContext("2d");
    if (!textCtx) throw new Error("2D canvas context not supported");

    const program = createProgram(gl, vsSource, fsSource);
    const bgProgram = createProgram(gl, bgVsSource, bgFsSource);
    const locations = getShaderLocations(gl, program);
    const bgLocations = getBGShaderLocations(gl, bgProgram);
    const geometry = new GeometryNode(gl, "rounded-square");
    const bgGeometry = new BGGeometryNode(gl, "dotted", backgroundCanvas);

    this.camera = new Camera();
    this.store = new NodeStore(gl, textCtx, textCanvas);
    this.pickFBO = new PickFBO(gl, canvas.width, canvas.height);

    //prettier-ignore
    this.renderer = new Renderer(gl, canvas, backgroundCanvas, program, locations,
      geometry, bgGeometry, this.store, this.camera, bgProgram, bgLocations,
      () => this.bgColor,
    );

    const container = document.getElementById("sidebar");
    if (!container) throw new Error('"sidebar" element not found');

    this.controls = new UIControls(canvas, container, {
      onAddNode: () => this.handleAddNode(canvas, "node"),
      onAddGroup: () => this.handleAddNode(canvas, "group"),
      onDeleteNode: () => this.handleDeleteSelected(),
      onBgColorChange: (r, g, b, a) => {
        this.bgColor = [r, g, b, a];
      },
      onThemeChange: (theme) => {
        this.theme = theme;
        this.store.regenerateTextures(theme);
      },
      onLabelChange: (newLabel) => {
        const selected = this.store.getSelected();
        if (selected) {
          this.store.updateLabel(selected.id, newLabel, this.theme);
        }
      },
      onMouseDown: (e) => this.handleMouseDown(e, canvas),
      onMouseMove: (e) => this.handleMouseMove(e, canvas),
      onMouseUp: (e) => this.handleMouseUp(e, canvas),
      onWheel: (e) => this.handleWheel(e, canvas),
    });

    window.addEventListener("resize", () => this.handleResize(canvas));
    this.handleResize(canvas);
  }

  render(): void {
    this.renderer.startLoop();
  }

  private handleResize(canvas: HTMLCanvasElement): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.renderer.resize(canvas.width, canvas.height);
    this.pickFBO.resize(canvas.width, canvas.height);
  }

  private handleAddNode(canvas: HTMLCanvasElement, nodeType: NodeType): void {
    const screenX = Math.random() * (canvas.width - 200) + 100;
    const screenY = Math.random() * (canvas.height - 200) + 100;
    const { x, y } = this.camera.screenToWorld(screenX, screenY);
    const label =
      nodeType === "group"
        ? `Group ${this.store.nextNodeId}`
        : `Node ${this.store.nextNodeId}`;
    this.store.add(x, y, label, this.theme, nodeType);
  }

  private handleDeleteSelected(): void {
    const selected = this.store.getSelected();
    if (!selected) return;
    this.store.remove(selected.id);
    this.controls.disableDelete();
  }

  private pick(screenX: number, screenY: number): number {
    this.pickFBO.bind();
    this.renderer["gl"].clearColor(1.0, 1.0, 1.0, 1.0);
    this.renderer["gl"].clear(
      this.renderer["gl"].COLOR_BUFFER_BIT |
        this.renderer["gl"].DEPTH_BUFFER_BIT
    );
    this.renderer.drawNodes(true);

    const pixels = this.pickFBO.readPixel(screenX, screenY);
    this.pickFBO.unbind();

    if (pixels[0] === 255 && pixels[1] === 255 && pixels[2] === 255) {
      return 0;
    }
    return pixels[0] + (pixels[1] << 8) + (pixels[2] << 16);
  }

  private getHoveredGroup(screenX: number, screenY: number): NodeData | null {
    if (!this.draggingNode) return null;

    // Temporarily hide dragging node so we can pick what's behind it
    this.draggingNode.visible = false;
    const pickedId = this.pick(screenX, screenY);
    this.draggingNode.visible = true;

    if (pickedId === 0) return null;
    const pickedNode = this.store.get(pickedId);
    if (
      pickedNode &&
      pickedNode.nodeType === "group" &&
      pickedNode.id !== this.draggingNode.id
    )
      return pickedNode;
    return null;
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
    const nodeId = this.pick(screenX, screenY);
    const node = this.store.get(nodeId);

    if (!node) {
      this.store.deselectAll();
      this.controls.disableDelete();
      this.controls.hideProperties();
      // Clicked empty space - pan
      this.startPan(e.clientX, e.clientY);
      return;
    }

    this.controls.enableDelete();

    // Store click coordinates relative to node origin
    const { x: worldX, y: worldY } = this.camera.screenToWorld(
      screenX,
      screenY
    );
    const nodeWorld = getWorldPosition(node.id, this.store.allNodesMap);
    const localClickX = worldX - nodeWorld.x;
    const localClickY = worldY - nodeWorld.y;

    // Check for close icon (✕) click (distance-based hit-test)
    const closeX = node.width - NODE_LAYOUT.closeBtnPaddingRight;
    const iconY = node.nodeType === "group" ? 20 : NODE_LAYOUT.headerHeight / 2;
    const cDx = localClickX - closeX;
    const cDy = localClickY - iconY;
    if (
      cDx * cDx + cDy * cDy <=
      NODE_LAYOUT.closeBtnClickRadius * NODE_LAYOUT.closeBtnClickRadius
    ) {
      const oldParentId = node.parentId;
      this.store.remove(node.id);
      this.controls.disableDelete();
      this.controls.hideProperties();
      if (oldParentId !== null) {
        this.store.updateGroupBounds(oldParentId, this.theme);
      }
      return;
    }

    // Check for edit icon (✎) click
    const editX = node.width - NODE_LAYOUT.editBtnPaddingRight;
    const eDx = localClickX - editX;
    const eDy = localClickY - iconY;
    if (
      eDx * eDx + eDy * eDy <=
      NODE_LAYOUT.editBtnClickRadius * NODE_LAYOUT.editBtnClickRadius
    ) {
      this.store.deselectAll();
      node.isSelected = true;
      this.controls.showProperties(node.text);
      return;
    }

    // Check for plus icon (+) click (groups only, distance-based hit-test)
    if (node.nodeType === "group") {
      const plusX = node.width / 2;
      const plusY = node.height - NODE_LAYOUT.plusBtnPaddingBottom;
      const pDx = localClickX - plusX;
      const pDy = localClickY - plusY;
      if (
        pDx * pDx + pDy * pDy <=
        NODE_LAYOUT.plusBtnClickRadius * NODE_LAYOUT.plusBtnClickRadius
      ) {
        const child = this.store.add(
          0,
          0,
          `Node ${this.store.nextNodeId}`,
          this.theme,
          "node"
        );
        const success = this.store.setParent(child.id, node.id);
        if (success) {
          this.store.updateGroupBounds(node.id, this.theme);
        }
        return;
      }
    }

    this.store.deselectAll();
    node.isSelected = true;
    this.draggingNode = node;
    this.dragOffsetX = worldX - nodeWorld.x;
    this.dragOffsetY = worldY - nodeWorld.y;
  }

  private startPan(clientX: number, clientY: number): void {
    this.isPanning = true;
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
      const parentWorld = getWorldPosition(
        this.draggingNode.parentId,
        this.store.allNodesMap
      );
      this.draggingNode.localX = targetX - parentWorld.x;
      this.draggingNode.localY = targetY - parentWorld.y;
    }

    // Check for drop targets if it's a node
    if (this.draggingNode.nodeType === "node") {
      const hoveredGroup = this.getHoveredGroup(
        e.clientX - left,
        e.clientY - top
      );

      this.store.clearDropTargets();
      if (hoveredGroup) {
        hoveredGroup.isDropTarget = true;
      }
    }
  }

  private handleMouseUp(e: MouseEvent, canvas: HTMLCanvasElement): void {
    this.isPanning = false;

    if (this.draggingNode) {
      if (this.draggingNode.nodeType === "node") {
        const { left, top } = canvas.getBoundingClientRect();
        const hoveredGroup = this.getHoveredGroup(
          e.clientX - left,
          e.clientY - top
        );
        const oldParentId = this.draggingNode.parentId;

        if (hoveredGroup) {
          const success = this.store.setParent(
            this.draggingNode.id,
            hoveredGroup.id
          );
          if (success) {
            this.store.updateGroupBounds(hoveredGroup.id, this.theme);
          }
        } else {
          // Detach
          this.store.setParent(this.draggingNode.id, null);
        }

        if (
          oldParentId !== null &&
          oldParentId !== this.draggingNode.parentId
        ) {
          this.store.updateGroupBounds(oldParentId, this.theme);
        }
      }

      this.store.clearDropTargets();
      this.draggingNode = null;
    }
  }

  private handleWheel(e: WheelEvent, canvas: HTMLCanvasElement): void {
    e.preventDefault();
    const { left, top } = canvas.getBoundingClientRect();
    this.camera.zoomAt(e.clientX - left, e.clientY - top, e.deltaY);
  }
}
