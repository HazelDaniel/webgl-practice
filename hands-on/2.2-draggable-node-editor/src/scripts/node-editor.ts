import { BGGeometryNode, GeometryNode } from "./geometry.js";
import {
  createProgram,
  getBGShaderLocations,
  getShaderLocations,
} from "./shader.js";
import { PickFBO } from "./pick-fbo.js";
import { Camera } from "./camera.js";
import { EdgeStore } from "./edge-store.js";
import {
  buildEdgeRouteGeometry,
  hitTestEdgePolyline,
} from "./edge-geometry.js";
import { NodeStore } from "./node-store.js";
import { Renderer } from "./renderer.js";
import { UIControls } from "./controls.js";
import {
  ConnectionMode,
  NodeEditorConfig,
  NodeData,
  NodeHandleData,
  HandleSide,
  ThemeName,
  NodeType,
  DEFAULT_HANDLE_STYLE,
  NODE_LAYOUT,
  isCandidateNodeType,
  isContainerNodeType,
} from "./types.js";
import { HandleHit, getHandleScreenGeometry, isPointInsideHandle } from "./handle-geometry.js";
import { getWorldPosition } from "./scene-graph.js";

interface DragSnapshot {
  localX: number;
  localY: number;
  parentId: number | null;
}

interface ConnectionDragState {
  sourceNodeId: number;
  sourceHandleSide: HandleSide;
  screenX: number;
  screenY: number;
}

/**
 * NodeEditor is the single public class exposed to the entry point.
 * It owns every internal module and wires them together via callbacks.
 * No internal type leaks out of this file's public API.
 */
export class NodeEditor {
  private camera: Camera;
  private store: NodeStore;
  private edgeStore: EdgeStore;
  private pickFBO: PickFBO;
  private renderer: Renderer;
  private controls: UIControls;

  private bgColor: [number, number, number, number] = [7 / 255, 7 / 255, 8 / 255, 1.0];
  private theme: ThemeName = "dark";
  private draggingNode: NodeData | null = null;
  private dragSnapshot: DragSnapshot | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private isPanning: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;
  private connectionMode: ConnectionMode;
  private activeConnectionDrag: ConnectionDragState | null = null;
  private hoveredHandle: HandleHit | null = null;
  private selectedEdgeId: number | null = null;

  private static _instance: NodeEditor | null = null;

  static create(
    canvasId: string,
    textCanvasId: string,
    backgroundCanvasId: string,
    vsSource: string,
    fsSource: string,
    bgVsSource: string,
    bgFsSource: string,
    options: NodeEditorConfig = {}
  ): NodeEditor {
    if (this._instance) return this._instance;
    this._instance = new NodeEditor(
      canvasId,
      textCanvasId,
      backgroundCanvasId,
      vsSource,
      fsSource,
      bgVsSource,
      bgFsSource,
      options
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
    bgFsSource: string,
    options: NodeEditorConfig = {}
  ) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    const textCanvas = document.getElementById(textCanvasId) as HTMLCanvasElement;
    const backgroundCanvas = document.getElementById(
      backgroundCanvasId
    ) as HTMLCanvasElement;
    const labelCanvas = document.getElementById("2d-label-canvas") as HTMLCanvasElement;

    if (!canvas) throw new Error(`Canvas "${canvasId}" not found`);
    if (!textCanvas) throw new Error(`Canvas "${textCanvasId}" not found`);
    if (!backgroundCanvas) throw new Error(`Canvas "${backgroundCanvasId}" not found`);
    if (!labelCanvas) throw new Error(`Canvas "2d-label-canvas" not found`);

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
    this.connectionMode = options.connectionMode ?? "node";

    this.camera = new Camera();
    this.store = new NodeStore(
      gl,
      textCtx,
      textCanvas,
      this.connectionMode,
      options.handleStyle ?? DEFAULT_HANDLE_STYLE
    );
    this.edgeStore = new EdgeStore();
    this.pickFBO = new PickFBO(gl, canvas.width, canvas.height);

    //prettier-ignore
    this.renderer = new Renderer(gl, canvas, backgroundCanvas, program, locations,
      geometry, bgGeometry, this.store, this.edgeStore, this.camera, bgProgram, bgLocations, labelCanvas,
      () => this.activeConnectionDrag,
      () => this.selectedEdgeId,
      () => this.bgColor,
    );

    const container = document.getElementById("sidebar");
    if (!container) throw new Error('"sidebar" element not found');

    this.controls = new UIControls(canvas, container, {
      onAddNode: () => this.handleAddNode(canvas, "node"),
      onAddGroup: () => this.handleAddNode(canvas, "group"),
      onAddComposition: () => this.handleAddComposition(canvas),
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
        if (selected && selected.nodeType !== "composition") {
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
    this.syncToolbarState();
  }

  render(): void {
    this.renderer.startLoop();
  }

  setConnectionMode(connectionMode: ConnectionMode): void {
    this.connectionMode = connectionMode;
    this.store.setConnectionMode(connectionMode);
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
    this.syncToolbarState();
  }

  private handleAddComposition(canvas: HTMLCanvasElement): void {
    const targetGroup = this.getSelectedGroupTarget();
    if (!targetGroup) return;

    const screenX = Math.random() * (canvas.width - 240) + 120;
    const screenY = Math.random() * (canvas.height - 240) + 120;
    const { x, y } = this.camera.screenToWorld(screenX, screenY);
    const composition = this.store.add(
      x,
      y,
      `Composition ${this.store.nextNodeId}`,
      this.theme,
      "composition"
    );

    if (!this.store.setParent(composition.id, targetGroup.id)) {
      this.store.remove(composition.id);
      return;
    }

    this.refreshContainerChain(targetGroup.id);
    this.store.deselectAll();
    composition.isSelected = true;
    this.controls.hideProperties();
    this.syncToolbarState();
  }

  private handleDeleteSelected(): void {
    const selected = this.store.getSelected();
    if (selected) {
      const parentId = selected.parentId;
      this.removeNodeAndIncidentEdges(selected.id);

      if (parentId !== null) {
        this.refreshContainerChain(parentId);
      }

      this.store.deselectAll();
      this.selectedEdgeId = null;
      this.controls.hideProperties();
      this.syncToolbarState();
      return;
    }

    if (this.selectedEdgeId !== null) {
      const edge = this.edgeStore.get(this.selectedEdgeId);
      if (edge) {
        this.edgeStore.remove(edge.id);
        this.syncHandleStates(edge.sourceNodeId);
        this.syncHandleStates(edge.targetNodeId);
      }
      this.selectedEdgeId = null;
      this.syncToolbarState();
    }
  }

  private pick(screenX: number, screenY: number): number {
    this.pickFBO.bind();
    this.renderer["gl"].clearColor(1.0, 1.0, 1.0, 1.0);
    this.renderer["gl"].clear(
      this.renderer["gl"].COLOR_BUFFER_BIT | this.renderer["gl"].DEPTH_BUFFER_BIT
    );
    this.renderer.drawNodes(true);

    const pixels = this.pickFBO.readPixel(screenX, screenY);
    this.pickFBO.unbind();

    if (pixels[0] === 255 && pixels[1] === 255 && pixels[2] === 255) {
      return 0;
    }
    return pixels[0] + (pixels[1] << 8) + (pixels[2] << 16);
  }

  private hitTestHandle(screenX: number, screenY: number): HandleHit | null {
    const visibleNodes = this.store.visibleNodes();

    for (let i = visibleNodes.length - 1; i >= 0; i--) {
      const node = visibleNodes[i];
      if (!isCandidateNodeType(node.nodeType, this.connectionMode)) continue;
      if (node.handles.length === 0) continue;

      const { x, y } = getWorldPosition(node.id, this.store.allNodesMap);

      for (const handle of node.handles) {
        const geometry = getHandleScreenGeometry(
          x,
          y,
          node,
          handle,
          this.camera.zoom,
          this.camera.panX,
          this.camera.panY
        );

        if (isPointInsideHandle(screenX, screenY, geometry)) {
          return {
            nodeId: node.id,
            handle,
            geometry,
          };
        }
      }
    }

    return null;
  }

  private getHoveredContainer(
    screenX: number,
    screenY: number,
    source: NodeData
  ): NodeData | null {
    if (source.nodeType === "composition-child") return null;

    source.visible = false;
    const pickedId = this.pick(screenX, screenY);
    source.visible = true;

    if (pickedId === 0) return null;
    let pickedNode = this.store.get(pickedId);

    while (pickedNode) {
      if (
        pickedNode.id !== source.id &&
        isContainerNodeType(pickedNode.nodeType)
      ) {
        if (source.nodeType === "composition") {
          return pickedNode.nodeType === "group" ? pickedNode : null;
        }
        return pickedNode;
      }

      if (pickedNode.parentId === null) break;
      pickedNode = this.store.get(pickedNode.parentId);
    }

    return null;
  }

  private getSelectedGroupTarget(): NodeData | null {
    const selected = this.store.getSelected();
    if (!selected) return null;

    if (selected.nodeType === "group") return selected;
    if (selected.parentId === null) return null;

    const parent = this.store.get(selected.parentId);
    if (parent && parent.nodeType === "group") return parent;
    return null;
  }

  private syncToolbarState(): void {
    if (this.hasSelection()) {
      this.controls.enableDelete();
    } else {
      this.controls.disableDelete();
    }

    if (this.getSelectedGroupTarget()) {
      this.controls.enableAddComposition();
    } else {
      this.controls.disableAddComposition();
    }
  }

  private refreshContainerChain(containerId: number | null): void {
    let currentId = containerId;
    while (currentId !== null) {
      const current = this.store.get(currentId);
      if (!current || !isContainerNodeType(current.nodeType)) return;
      this.store.updateContainerBounds(currentId, this.theme);
      currentId = current.parentId;
    }
  }

  private handleMouseDown(e: MouseEvent, canvas: HTMLCanvasElement): void {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      this.startPan(e.clientX, e.clientY);
      return;
    }

    const { left, top } = canvas.getBoundingClientRect();
    const screenX = e.clientX - left;
    const screenY = e.clientY - top;

    const handleHit = this.hitTestHandle(screenX, screenY);
    if (handleHit) {
      this.activeConnectionDrag = {
        sourceNodeId: handleHit.nodeId,
        sourceHandleSide: handleHit.handle.side,
        screenX,
        screenY,
      };
      this.selectedEdgeId = null;
      this.hoveredHandle = handleHit;
      this.draggingNode = null;
      this.dragSnapshot = null;
      return;
    }

    const nodeId = this.pick(screenX, screenY);
    const node = this.store.get(nodeId);

    if (!node) {
      const edgeHit = this.hitTestEdge(screenX, screenY);
      if (edgeHit) {
        this.store.deselectAll();
        this.controls.hideProperties();
        this.selectedEdgeId = edgeHit.id;
        this.hoveredHandle = null;
        this.draggingNode = null;
        this.dragSnapshot = null;
        this.syncToolbarState();
        return;
      }

      this.store.deselectAll();
      this.controls.hideProperties();
      this.selectedEdgeId = null;
      this.draggingNode = null;
      this.dragSnapshot = null;
      this.hoveredHandle = null;
      this.syncToolbarState();
      this.startPan(e.clientX, e.clientY);
      return;
    }

    const { x: worldX, y: worldY } = this.camera.screenToWorld(screenX, screenY);
    const nodeWorld = getWorldPosition(node.id, this.store.allNodesMap);
    const localClickX = worldX - nodeWorld.x;
    const localClickY = worldY - nodeWorld.y;

    const closeX = node.width - NODE_LAYOUT.closeBtnPaddingRight;
    const closeY = isContainerNodeType(node.nodeType)
      ? 20
      : NODE_LAYOUT.headerHeight / 2;
    const closeDx = localClickX - closeX;
    const closeDy = localClickY - closeY;
    if (
      closeDx * closeDx + closeDy * closeDy <=
      NODE_LAYOUT.closeBtnClickRadius * NODE_LAYOUT.closeBtnClickRadius
    ) {
      const parentId = node.parentId;
      this.removeNodeAndIncidentEdges(node.id);
      if (parentId !== null) {
        this.refreshContainerChain(parentId);
      }
      this.store.deselectAll();
      this.controls.hideProperties();
      this.draggingNode = null;
      this.dragSnapshot = null;
      this.hoveredHandle = null;
      this.selectedEdgeId = null;
      this.syncToolbarState();
      return;
    }

    if (node.nodeType === "node" || node.nodeType === "composition-child" || node.nodeType === "group") {
      const editX = node.width - NODE_LAYOUT.editBtnPaddingRight;
      const editY = isContainerNodeType(node.nodeType)
        ? 20
        : NODE_LAYOUT.headerHeight / 2;
      const editDx = localClickX - editX;
      const editDy = localClickY - editY;
      if (
        editDx * editDx + editDy * editDy <=
        NODE_LAYOUT.editBtnClickRadius * NODE_LAYOUT.editBtnClickRadius
      ) {
        this.store.deselectAll();
        node.isSelected = true;
        this.selectedEdgeId = null;
        this.controls.showProperties(node.text);
        this.hoveredHandle = null;
        this.syncToolbarState();
        return;
      }
    }

    if (node.nodeType === "group") {
      const plusX = node.width / 2;
      const plusY = node.height - NODE_LAYOUT.plusBtnPaddingBottom;
      const plusDx = localClickX - plusX;
      const plusDy = localClickY - plusY;
      if (
        plusDx * plusDx + plusDy * plusDy <=
        NODE_LAYOUT.plusBtnClickRadius * NODE_LAYOUT.plusBtnClickRadius
      ) {
        const child = this.store.add(
          0,
          0,
          `Node ${this.store.nextNodeId}`,
          this.theme,
          "node"
        );
        if (this.store.setParent(child.id, node.id)) {
          this.refreshContainerChain(node.id);
        }
        this.selectedEdgeId = null;
        this.hoveredHandle = null;
        this.syncToolbarState();
        return;
      }
    }

    this.store.deselectAll();
    this.controls.hideProperties();
    this.selectedEdgeId = null;
    node.isSelected = true;
    this.hoveredHandle = null;
    this.draggingNode = node;
    this.dragSnapshot = {
      localX: node.localX,
      localY: node.localY,
      parentId: node.parentId,
    };
    this.dragOffsetX = worldX - nodeWorld.x;
    this.dragOffsetY = worldY - nodeWorld.y;
    this.syncToolbarState();
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

    const { left, top } = canvas.getBoundingClientRect();
    const screenX = e.clientX - left;
    const screenY = e.clientY - top;

    if (this.activeConnectionDrag) {
      this.activeConnectionDrag.screenX = screenX;
      this.activeConnectionDrag.screenY = screenY;
      this.hoveredHandle = this.hitTestHandle(screenX, screenY);
      return;
    }

    if (!this.draggingNode) return;

    const { x: worldX, y: worldY } = this.camera.screenToWorld(screenX, screenY);
    const targetX = worldX - this.dragOffsetX;
    const targetY = worldY - this.dragOffsetY;

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

    this.store.clearDropTargets();
    if (this.draggingNode.nodeType === "node" || this.draggingNode.nodeType === "composition") {
      const hoveredContainer = this.getHoveredContainer(screenX, screenY, this.draggingNode);
      if (hoveredContainer) {
        hoveredContainer.isDropTarget = true;
      }
    }
  }

  private handleMouseUp(e: MouseEvent, canvas: HTMLCanvasElement): void {
    this.isPanning = false;

    if (this.activeConnectionDrag) {
      const source = this.activeConnectionDrag;
      const target = this.hoveredHandle;

      if (
        target &&
        this.isValidConnection(
          source.sourceNodeId,
          source.sourceHandleSide,
          target.nodeId,
          target.handle.side
        )
      ) {
        const edge = this.edgeStore.add({
          sourceNodeId: source.sourceNodeId,
          sourceHandleSide: source.sourceHandleSide,
          targetNodeId: target.nodeId,
          targetHandleSide: target.handle.side,
        });

        if (edge) {
          this.syncHandleStates(edge.sourceNodeId);
          this.syncHandleStates(edge.targetNodeId);
        }
      }

      this.activeConnectionDrag = null;
      this.hoveredHandle = null;
      this.syncToolbarState();
      return;
    }

    if (this.draggingNode && this.dragSnapshot) {
      const { left, top } = canvas.getBoundingClientRect();
      const screenX = e.clientX - left;
      const screenY = e.clientY - top;
      const source = this.draggingNode;
      const snapshot = this.dragSnapshot;

      if (source.nodeType === "node") {
        const hoveredContainer = this.getHoveredContainer(screenX, screenY, source);
        if (hoveredContainer?.nodeType === "composition") {
          const clone = this.store.duplicateIntoComposition(
            source.id,
            hoveredContainer.id,
            this.theme
          );
          this.store.restoreNodePlacement(
            source.id,
            snapshot.localX,
            snapshot.localY,
            snapshot.parentId
          );
          if (clone) {
            this.store.deselectAll();
            clone.isSelected = true;
            this.refreshContainerChain(hoveredContainer.id);
          }
        } else if (hoveredContainer?.nodeType === "group") {
          const oldParentId = source.parentId;
          if (this.store.setParent(source.id, hoveredContainer.id)) {
            this.refreshContainerChain(hoveredContainer.id);
            if (oldParentId !== null && oldParentId !== hoveredContainer.id) {
              this.refreshContainerChain(oldParentId);
            }
          } else {
            this.store.restoreNodePlacement(
              source.id,
              snapshot.localX,
              snapshot.localY,
              snapshot.parentId
            );
          }
        } else {
          const oldParentId = source.parentId;
          this.store.setParent(source.id, null);
          if (oldParentId !== null) {
            this.refreshContainerChain(oldParentId);
          }
        }
      } else if (source.nodeType === "composition") {
        const hoveredContainer = this.getHoveredContainer(screenX, screenY, source);
        if (hoveredContainer?.nodeType === "group") {
          const oldParentId = source.parentId;
          if (this.store.setParent(source.id, hoveredContainer.id)) {
            this.refreshContainerChain(hoveredContainer.id);
            if (oldParentId !== null && oldParentId !== hoveredContainer.id) {
              this.refreshContainerChain(oldParentId);
            }
          } else {
            this.store.restoreNodePlacement(
              source.id,
              snapshot.localX,
              snapshot.localY,
              snapshot.parentId
            );
          }
        } else {
          this.store.restoreNodePlacement(
            source.id,
            snapshot.localX,
            snapshot.localY,
            snapshot.parentId
          );
        }
      }
    }

    this.store.clearDropTargets();
    this.draggingNode = null;
    this.dragSnapshot = null;
    this.syncToolbarState();
  }

  private isValidConnection(
    sourceNodeId: number,
    sourceHandleSide: HandleSide,
    targetNodeId: number,
    targetHandleSide: HandleSide
  ): boolean {
    if (sourceNodeId === targetNodeId) return false;

    const sourceNode = this.store.get(sourceNodeId);
    const targetNode = this.store.get(targetNodeId);
    if (!sourceNode || !targetNode) return false;

    if (this.edgeStore.hasConnection(sourceNodeId, sourceHandleSide)) return false;
    if (this.edgeStore.hasConnection(targetNodeId, targetHandleSide)) return false;

    return true;
  }

  private hitTestEdge(screenX: number, screenY: number): { id: number } | null {
    const edges = this.edgeStore.allEdges().filter((edge) => edge.visible);

    for (let i = edges.length - 1; i >= 0; i--) {
      const geometry = buildEdgeRouteGeometry(edges[i], this.store, this.camera);
      if (!geometry) continue;
      if (hitTestEdgePolyline(screenX, screenY, geometry.screenPoints)) {
        return { id: edges[i].id };
      }
    }

    return null;
  }

  private removeNodeAndIncidentEdges(nodeId: number): void {
    const removedIds = this.store.collectRemovedIds(nodeId);
    const removedIdSet = new Set(removedIds);
    const removedEdges = this.edgeStore.removeEdgesForNodes(removedIds);
    const affectedNodeIds = new Set<number>();

    for (const edge of removedEdges) {
      if (!removedIdSet.has(edge.sourceNodeId)) {
        affectedNodeIds.add(edge.sourceNodeId);
      }
      if (!removedIdSet.has(edge.targetNodeId)) {
        affectedNodeIds.add(edge.targetNodeId);
      }
    }

    this.store.remove(nodeId);

    for (const affectedNodeId of affectedNodeIds) {
      this.syncHandleStates(affectedNodeId);
    }

    if (this.selectedEdgeId !== null && removedEdges.some((edge) => edge.id === this.selectedEdgeId)) {
      this.selectedEdgeId = null;
    }
  }

  private syncHandleStates(nodeId: number): void {
    this.store.updateHandleConnectionState(
      nodeId,
      'left',
      this.edgeStore.hasConnection(nodeId, 'left')
    );
    this.store.updateHandleConnectionState(
      nodeId,
      'right',
      this.edgeStore.hasConnection(nodeId, 'right')
    );
  }

  private hasSelection(): boolean {
    return this.store.getSelected() !== undefined || this.selectedEdgeId !== null;
  }

  private handleWheel(e: WheelEvent, canvas: HTMLCanvasElement): void {
    e.preventDefault();
    const { left, top } = canvas.getBoundingClientRect();
    this.camera.zoomAt(e.clientX - left, e.clientY - top, e.deltaY);
  }
}
