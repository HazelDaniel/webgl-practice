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
import { HistoryStack, HistoryEntry } from "./history.js";
import {
  ConnectionMode,
  EdgeHeadSkinId,
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

interface NodePlacementSnapshot {
  localX: number;
  localY: number;
  parentId: number | null;
}

interface NodeHistorySnapshot {
  id: number;
  nodeType: NodeType;
  localX: number;
  localY: number;
  width: number;
  height: number;
  text: string;
  visible: boolean;
  isSelected: boolean;
  isDropTarget: boolean;
  parentId: number | null;
  childIds: number[];
  handleStates: Array<{
    side: HandleSide;
    isConnected: boolean;
  }>;
}

interface EdgeHistorySnapshot {
  id: number;
  sourceNodeId: number;
  sourceHandleSide: HandleSide;
  targetNodeId: number;
  targetHandleSide: HandleSide;
  edgeType: "line" | "cubic" | "line-curve";
  headType: "none" | "arrow";
  headSkinId: EdgeHeadSkinId;
  label: string;
  isSelected: boolean;
  visible: boolean;
}

type SelectionKind = "node" | "edge" | null;

interface SelectionSnapshot {
  kind: SelectionKind;
  nodeIds: number[];
  edgeIds: number[];
}

interface ActiveLabelEdit {
  nodeId: number;
  previousLabel: string;
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
  private history: HistoryStack;

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
  private selectedNodeIds: Set<number> = new Set();
  private selectedEdgeIds: Set<number> = new Set();
  private selectionKind: SelectionKind = null;
  private isMultiSelectMode: boolean = false;
  private activeLabelEdit: ActiveLabelEdit | null = null;

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
    const bgGeometry = new BGGeometryNode(gl, "grid", backgroundCanvas);
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
    this.history = new HistoryStack();
    this.pickFBO = new PickFBO(gl, canvas.width, canvas.height);

    //prettier-ignore
    this.renderer = new Renderer(gl, canvas, backgroundCanvas, program, locations,
      geometry, bgGeometry, this.store, this.edgeStore, this.camera, bgProgram, bgLocations, labelCanvas,
      () => this.activeConnectionDrag,
      () => this.bgColor,
    );

    const container = document.getElementById("sidebar");
    const historyPane = document.getElementById("undo-redo-wrapper")!;
    const toolPane = document.getElementById("tool-panel");
    if (!container) throw new Error('"sidebar" element not found');
    if (!toolPane) throw new Error('"tool-panel" element not found');

    this.controls = new UIControls(canvas, container, historyPane, toolPane, {
      onAddNode: () => this.handleAddNode(canvas, "node"),
      onAddGroup: () => this.handleAddNode(canvas, "group"),
      onAddComposition: () => this.handleAddComposition(canvas),
      onToggleMultiSelect: () => this.toggleMultiSelectMode(),
      onUndo: () => this.undo(),
      onRedo: () => this.redo(),
      onDeleteNode: () => this.handleDeleteSelected(),
      onBgColorChange: (r, g, b, a) => {
        this.bgColor = [r, g, b, a];
      },
      onThemeChange: (theme) => {
        this.theme = theme;
        this.store.regenerateTextures(theme);
      },
      onLabelChange: (newLabel) => {
        const selected = this.getSingleSelectedNode();
        if (selected && selected.nodeType !== "composition") {
          this.store.updateLabel(selected.id, newLabel, this.theme);
        }
      },
      onLabelCommit: () => this.commitLabelEdit(),
      onMouseDown: (e) => this.handleMouseDown(e, canvas),
      onMouseMove: (e) => this.handleMouseMove(e, canvas),
      onMouseUp: (e) => this.handleMouseUp(e, canvas),
      onWheel: (e) => this.handleWheel(e, canvas),
    });
    this.controls.setMultiSelectActive(this.isMultiSelectMode);

    window.addEventListener("resize", () => this.handleResize(canvas));
    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
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

  private undo(): void {
    if (!this.history.undo()) return;
    this.syncToolbarState();
  }

  private redo(): void {
    if (!this.history.redo()) return;
    this.syncToolbarState();
  }

  private handleResize(canvas: HTMLCanvasElement): void {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.renderer.resize(canvas.width, canvas.height);
    this.pickFBO.resize(canvas.width, canvas.height);
  }

  private pushHistory(entry: HistoryEntry): void {
    this.history.push(entry);
    this.syncToolbarState();
  }

  private captureSelectionSnapshot(): SelectionSnapshot {
    return {
      kind: this.selectionKind,
      nodeIds: [...this.selectedNodeIds],
      edgeIds: [...this.selectedEdgeIds],
    };
  }

  private clearSelectionState(): void {
    this.selectedNodeIds.forEach((nodeId) => {
      const node = this.store.get(nodeId);
      if (node) node.isSelected = false;
    });
    this.selectedEdgeIds.forEach((edgeId) => {
      const edge = this.edgeStore.get(edgeId);
      if (edge) edge.isSelected = false;
    });

    this.selectedNodeIds.clear();
    this.selectedEdgeIds.clear();
    this.selectionKind = null;
  }

  private syncSelectionKind(): void {
    if (this.selectedNodeIds.size > 0 && this.selectedEdgeIds.size > 0) {
      return;
    }

    if (this.selectedNodeIds.size > 0) {
      this.selectionKind = "node";
      return;
    }

    if (this.selectedEdgeIds.size > 0) {
      this.selectionKind = "edge";
      return;
    }

    this.selectionKind = null;
  }

  private setNodeSelected(nodeId: number, isSelected: boolean): void {
    const node = this.store.get(nodeId);
    if (!node) return;

    node.isSelected = isSelected;
    if (isSelected) {
      this.selectedNodeIds.add(nodeId);
    } else {
      this.selectedNodeIds.delete(nodeId);
    }
    this.syncSelectionKind();
  }

  private setEdgeSelected(edgeId: number, isSelected: boolean): void {
    const edge = this.edgeStore.get(edgeId);
    if (!edge) return;

    edge.isSelected = isSelected;
    if (isSelected) {
      this.selectedEdgeIds.add(edgeId);
    } else {
      this.selectedEdgeIds.delete(edgeId);
    }
    this.syncSelectionKind();
  }

  private selectOnlyNode(nodeId: number): void {
    this.clearSelectionState();
    this.setNodeSelected(nodeId, true);
  }

  private selectOnlyEdge(edgeId: number): void {
    this.clearSelectionState();
    this.setEdgeSelected(edgeId, true);
  }

  private getSingleSelectedNode(): NodeData | null {
    if (this.selectedNodeIds.size !== 1 || this.selectedEdgeIds.size > 0) {
      return null;
    }

    const nodeId = this.selectedNodeIds.values().next().value as number | undefined;
    if (nodeId === undefined) return null;
    return this.store.get(nodeId) ?? null;
  }

  private getSelectedGroupTarget(): NodeData | null {
    const selected = this.getSingleSelectedNode();
    if (!selected) return null;

    if (selected.nodeType === "group") return selected;
    if (selected.parentId === null) return null;

    const parent = this.store.get(selected.parentId);
    if (parent && parent.nodeType === "group") return parent;
    return null;
  }

  private restoreSelectionSnapshot(snapshot: SelectionSnapshot): void {
    this.clearSelectionState();

    for (const nodeId of snapshot.nodeIds) {
      const node = this.store.get(nodeId);
      if (node) {
        node.isSelected = true;
        this.selectedNodeIds.add(nodeId);
      }
    }

    for (const edgeId of snapshot.edgeIds) {
      const edge = this.edgeStore.get(edgeId);
      if (edge) {
        edge.isSelected = true;
        this.selectedEdgeIds.add(edgeId);
      }
    }

    this.selectionKind = snapshot.kind;
    this.syncSelectionKind();
  }

  private clearSelectionAndHideProperties(): void {
    this.clearSelectionState();
    this.controls.hideProperties();
  }

  private toggleMultiSelectMode(): void {
    this.isMultiSelectMode = !this.isMultiSelectMode;
    this.controls.setMultiSelectActive(this.isMultiSelectMode);
  }

  private selectNodeByClick(nodeId: number): void {
    const canExtendSelection =
      this.isMultiSelectMode && (this.selectionKind === null || this.selectionKind === "node");

    if (!canExtendSelection) {
      this.clearSelectionState();
      this.setNodeSelected(nodeId, true);
      return;
    }

    if (this.selectedNodeIds.has(nodeId)) {
      if (this.selectedNodeIds.size === 1) {
        this.clearSelectionState();
      } else {
        this.setNodeSelected(nodeId, false);
      }
      return;
    }

    this.setNodeSelected(nodeId, true);
  }

  private selectEdgeByClick(edgeId: number): void {
    const canExtendSelection =
      this.isMultiSelectMode && (this.selectionKind === null || this.selectionKind === "edge");

    if (!canExtendSelection) {
      this.clearSelectionState();
      this.setEdgeSelected(edgeId, true);
      return;
    }

    if (this.selectedEdgeIds.has(edgeId)) {
      if (this.selectedEdgeIds.size === 1) {
        this.clearSelectionState();
      } else {
        this.setEdgeSelected(edgeId, false);
      }
      return;
    }

    this.setEdgeSelected(edgeId, true);
  }

  private beginLabelEdit(node: NodeData): void {
    this.activeLabelEdit = {
      nodeId: node.id,
      previousLabel: node.text,
    };
  }

  private commitLabelEdit(): void {
    const session = this.activeLabelEdit;
    if (!session) return;

    this.activeLabelEdit = null;
    const node = this.store.get(session.nodeId);
    if (!node || node.text === session.previousLabel) return;

    const nextLabel = node.text;
    this.pushHistory({
      undo: () => {
        this.store.updateLabel(node.id, session.previousLabel, this.theme);
        if (this.getSingleSelectedNode()?.id === node.id && node.nodeType !== "composition") {
          this.controls.showProperties(session.previousLabel);
        }
        this.syncToolbarState();
      },
      redo: () => {
        this.store.updateLabel(node.id, nextLabel, this.theme);
        if (this.getSingleSelectedNode()?.id === node.id && node.nodeType !== "composition") {
          this.controls.showProperties(nextLabel);
        }
        this.syncToolbarState();
      },
    });
  }

  private captureNodeSnapshot(node: NodeData): NodeHistorySnapshot {
    return {
      id: node.id,
      nodeType: node.nodeType,
      localX: node.localX,
      localY: node.localY,
      width: node.width,
      height: node.height,
      text: node.text,
      visible: node.visible,
      isSelected: node.isSelected,
      isDropTarget: Boolean(node.isDropTarget),
      parentId: node.parentId,
      childIds: [...node.childIds],
      handleStates: node.handles.map((handle) => ({
        side: handle.side,
        isConnected: handle.isConnected,
      })),
    };
  }

  private captureSubtreeSnapshots(rootId: number): NodeHistorySnapshot[] {
    const root = this.store.get(rootId);
    if (!root) return [];

    const snapshots: NodeHistorySnapshot[] = [];
    const visit = (node: NodeData): void => {
      snapshots.push(this.captureNodeSnapshot(node));
      for (const childId of node.childIds) {
        const child = this.store.get(childId);
        if (child) visit(child);
      }
    };

    visit(root);
    return snapshots;
  }

  private captureNodeSnapshots(nodeIds: Iterable<number>): NodeHistorySnapshot[] {
    const snapshots: NodeHistorySnapshot[] = [];
    const visited = new Set<number>();

    for (const nodeId of nodeIds) {
      const root = this.store.get(nodeId);
      if (!root || visited.has(root.id)) continue;

      const visit = (node: NodeData): void => {
        if (visited.has(node.id)) return;
        visited.add(node.id);
        snapshots.push(this.captureNodeSnapshot(node));
        for (const childId of node.childIds) {
          const child = this.store.get(childId);
          if (child) visit(child);
        }
      };

      visit(root);
    }

    return snapshots;
  }

  private captureEdgeSnapshots(nodeIds: Iterable<number>): EdgeHistorySnapshot[] {
    const nodeIdSet = new Set(nodeIds);
    return this.edgeStore
      .allEdges()
      .filter(
        (edge) =>
          nodeIdSet.has(edge.sourceNodeId) || nodeIdSet.has(edge.targetNodeId)
      )
      .map((edge) => ({ ...edge }));
  }

  private captureEdgeSnapshotsForSelection(
    nodeIds: Iterable<number>,
    edgeIds: Iterable<number>
  ): EdgeHistorySnapshot[] {
    const nodeIdSet = new Set(nodeIds);
    const edgeIdSet = new Set(edgeIds);
    const snapshots: EdgeHistorySnapshot[] = [];

    for (const edge of this.edgeStore.allEdges()) {
      if (edgeIdSet.has(edge.id) || nodeIdSet.has(edge.sourceNodeId) || nodeIdSet.has(edge.targetNodeId)) {
        snapshots.push({ ...edge });
      }
    }

    return snapshots;
  }

  private applyNodeSnapshot(snapshot: NodeHistorySnapshot): void {
    let node = this.store.get(snapshot.id);
    if (!node) {
      node = this.store.add(
        snapshot.localX,
        snapshot.localY,
        snapshot.text,
        this.theme,
        snapshot.nodeType,
        snapshot.id
      );
    }

    node.nodeType = snapshot.nodeType;
    node.localX = snapshot.localX;
    node.localY = snapshot.localY;
    node.width = snapshot.width;
    node.height = snapshot.height;
    node.text = snapshot.text;
    node.visible = snapshot.visible;
    node.isSelected = snapshot.isSelected;
    node.isDropTarget = snapshot.isDropTarget;
    node.childIds = [...snapshot.childIds];
    node.handles = node.handles.map((handle) => ({
      ...handle,
      isConnected:
        snapshot.handleStates.find((entry) => entry.side === handle.side)?.isConnected ??
        false,
    }));
    this.store.refreshNodeTexture(node, this.theme);

    this.store.forceRestoreNodePlacement(
      snapshot.id,
      snapshot.localX,
      snapshot.localY,
      snapshot.parentId
    );
  }

  private restoreNodeSnapshots(snapshots: NodeHistorySnapshot[]): void {
    for (const snapshot of snapshots) {
      this.applyNodeSnapshot(snapshot);
    }
  }

  private restoreEdgeSnapshots(snapshots: EdgeHistorySnapshot[]): void {
    for (const snapshot of snapshots) {
      const edge = this.edgeStore.add({
        ...snapshot,
        sourceHandleSide: snapshot.sourceHandleSide,
        targetHandleSide: snapshot.targetHandleSide,
        edgeType: snapshot.edgeType,
        headType: snapshot.headType,
        label: snapshot.label,
        isSelected: snapshot.isSelected,
        visible: snapshot.visible,
        idOverride: snapshot.id,
      });

      if (edge) {
        this.syncHandleStates(edge.sourceNodeId);
        this.syncHandleStates(edge.targetNodeId);
      }
    }
  }

  private refreshAfterRestoration(rootParentId: number | null): void {
    if (rootParentId !== null) {
      this.refreshContainerChain(rootParentId);
    }
    this.syncToolbarState();
  }

  private deleteNodeTreeWithHistory(nodeId: number): void {
    const node = this.store.get(nodeId);
    if (!node) return;

    this.activeLabelEdit = null;
    const selectionBefore = this.captureSelectionSnapshot();
    const snapshots = this.captureSubtreeSnapshots(nodeId);
    const removedIds = this.store.collectRemovedIds(nodeId);
    const edgeSnapshots = this.captureEdgeSnapshotsForSelection(removedIds, []);
    const parentId = node.parentId;

    this.removeNodeAndIncidentEdges(nodeId);
    this.clearSelectionAndHideProperties();
    if (parentId !== null) {
      this.refreshContainerChain(parentId);
    }

    this.pushHistory({
      undo: () => {
        this.restoreNodeSnapshots(snapshots);
        this.restoreEdgeSnapshots(edgeSnapshots);
        this.restoreSelectionSnapshot(selectionBefore);
        this.refreshAfterRestoration(parentId);
      },
      redo: () => {
        this.removeNodeAndIncidentEdges(nodeId);
        this.clearSelectionAndHideProperties();
        if (parentId !== null) {
          this.refreshContainerChain(parentId);
        }
        this.syncToolbarState();
      },
    });
  }

  private deleteEdgeWithHistory(edgeId: number): void {
    const edge = this.edgeStore.get(edgeId);
    if (!edge) return;

    this.activeLabelEdit = null;
    const selectionBefore = this.captureSelectionSnapshot();
    const snapshot: EdgeHistorySnapshot = { ...edge };

    this.edgeStore.remove(edgeId);
    this.syncHandleStates(edge.sourceNodeId);
    this.syncHandleStates(edge.targetNodeId);
    this.clearSelectionAndHideProperties();

    this.pushHistory({
      undo: () => {
        const restored = this.edgeStore.add({
          ...snapshot,
          idOverride: snapshot.id,
        });

        if (restored) {
          this.syncHandleStates(restored.sourceNodeId);
          this.syncHandleStates(restored.targetNodeId);
        }
        this.restoreSelectionSnapshot(selectionBefore);
        this.syncToolbarState();
      },
      redo: () => {
        const removed = this.edgeStore.remove(edgeId);
        if (removed) {
          this.syncHandleStates(removed.sourceNodeId);
          this.syncHandleStates(removed.targetNodeId);
        }
        this.clearSelectionAndHideProperties();
        this.syncToolbarState();
      },
    });
  }

  private deleteCurrentSelectionWithHistory(): void {
    const nodeIds = [...this.selectedNodeIds];
    const edgeIds = [...this.selectedEdgeIds];

    if (nodeIds.length === 0 && edgeIds.length === 0) {
      return;
    }

    if (nodeIds.length === 1 && edgeIds.length === 0) {
      this.deleteNodeTreeWithHistory(nodeIds[0]);
      return;
    }

    if (nodeIds.length === 0 && edgeIds.length === 1) {
      this.deleteEdgeWithHistory(edgeIds[0]);
      return;
    }

    this.activeLabelEdit = null;
    const selectionBefore = this.captureSelectionSnapshot();
    const snapshots = this.captureNodeSnapshots(nodeIds);
    const removedIds = new Set<number>();
    for (const nodeId of nodeIds) {
      for (const removedId of this.store.collectRemovedIds(nodeId)) {
        removedIds.add(removedId);
      }
    }
    const edgeSnapshots = this.captureEdgeSnapshotsForSelection(removedIds, edgeIds);
    const parentIds = new Set<number>();
    for (const nodeId of nodeIds) {
      const node = this.store.get(nodeId);
      if (node && node.parentId !== null) {
        parentIds.add(node.parentId);
      }
    }

    this.removeNodesAndEdges(removedIds, edgeIds);
    this.clearSelectionAndHideProperties();
    for (const parentId of parentIds) {
      this.refreshContainerChain(parentId);
    }

    this.pushHistory({
      undo: () => {
        this.restoreNodeSnapshots(snapshots);
        this.restoreEdgeSnapshots(edgeSnapshots);
        this.restoreSelectionSnapshot(selectionBefore);
        for (const parentId of parentIds) {
          this.refreshContainerChain(parentId);
        }
        this.syncToolbarState();
      },
      redo: () => {
        this.removeNodesAndEdges(removedIds, edgeIds);
        this.clearSelectionAndHideProperties();
        for (const parentId of parentIds) {
          this.refreshContainerChain(parentId);
        }
        this.syncToolbarState();
      },
    });
  }

  private createNodeWithHistory(
    nodeType: NodeType,
    worldX: number,
    worldY: number,
    parentId: number | null = null
  ): NodeData | null {
    const selectionBefore = this.captureSelectionSnapshot();
    const label =
      nodeType === "group"
        ? `Group ${this.store.nextNodeId}`
        : `Node ${this.store.nextNodeId}`;
    const node = this.store.add(worldX, worldY, label, this.theme, nodeType);

    if (parentId !== null && !this.store.setParent(node.id, parentId)) {
      this.store.remove(node.id);
      return null;
    }

    if (parentId !== null) {
      this.refreshContainerChain(parentId);
    }

    const snapshot = this.captureNodeSnapshot(node);

    this.pushHistory({
      undo: () => {
        this.removeNodeAndIncidentEdges(snapshot.id);
        this.restoreSelectionSnapshot(selectionBefore);
        if (parentId !== null) {
          this.refreshContainerChain(parentId);
        }
        this.syncToolbarState();
      },
      redo: () => {
        this.applyNodeSnapshot(snapshot);
        if (parentId !== null) {
          this.refreshContainerChain(parentId);
        }
        this.restoreSelectionSnapshot(selectionBefore);
        this.syncToolbarState();
      },
    });

    return node;
  }

  private handleAddNode(canvas: HTMLCanvasElement, nodeType: NodeType): void {
    const screenX = Math.random() * (canvas.width - 200) + 100;
    const screenY = Math.random() * (canvas.height - 200) + 100;
    const { x, y } = this.camera.screenToWorld(screenX, screenY);
    this.createNodeWithHistory(nodeType, x, y);
  }

  private handleAddComposition(canvas: HTMLCanvasElement): void {
    const selectionBefore = this.captureSelectionSnapshot();
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
    const snapshot = this.captureNodeSnapshot(composition);
    this.clearSelectionState();
    this.setNodeSelected(composition.id, true);
    this.controls.hideProperties();

    this.pushHistory({
      undo: () => {
        this.removeNodeAndIncidentEdges(snapshot.id);
        this.restoreSelectionSnapshot(selectionBefore);
        this.refreshContainerChain(snapshot.parentId);
        this.controls.hideProperties();
        this.syncToolbarState();
      },
      redo: () => {
        this.applyNodeSnapshot(snapshot);
        this.clearSelectionState();
        this.setNodeSelected(snapshot.id, true);
        this.controls.hideProperties();
        this.refreshContainerChain(snapshot.parentId);
        this.syncToolbarState();
      },
    });
  }

  private handleDeleteSelected(): void {
    this.deleteCurrentSelectionWithHistory();
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

    if (this.history.canUndo()) {
      this.controls.enableUndo();
    } else {
      this.controls.disableUndo();
    }

    if (this.history.canRedo()) {
      this.controls.enableRedo();
    } else {
      this.controls.disableRedo();
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
      this.selectedEdgeIds.forEach((edgeId) => {
        const edge = this.edgeStore.get(edgeId);
        if (edge) edge.isSelected = false;
      });
      this.selectedEdgeIds.clear();
      this.selectionKind = this.selectedNodeIds.size > 0 ? "node" : null;
      this.hoveredHandle = handleHit;
      this.draggingNode = null;
      this.dragSnapshot = null;
      this.syncToolbarState();
      return;
    }

    const nodeId = this.pick(screenX, screenY);
    const node = this.store.get(nodeId);

    if (!node) {
      const edgeHit = this.hitTestEdge(screenX, screenY);
      if (edgeHit) {
        this.controls.hideProperties();
        this.selectEdgeByClick(edgeHit.id);
        this.hoveredHandle = null;
        this.draggingNode = null;
        this.dragSnapshot = null;
        this.syncToolbarState();
        return;
      }

      this.clearSelectionAndHideProperties();
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
      this.deleteNodeTreeWithHistory(node.id);
      this.draggingNode = null;
      this.dragSnapshot = null;
      this.hoveredHandle = null;
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
        this.beginLabelEdit(node);
        this.selectOnlyNode(node.id);
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
        this.createNodeWithHistory("node", 0, 0, node.id);
        this.hoveredHandle = null;
        this.syncToolbarState();
        return;
      }
    }

    this.controls.hideProperties();
    this.selectNodeByClick(node.id);
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
          const snapshot: EdgeHistorySnapshot = { ...edge };
          this.pushHistory({
            undo: () => {
              const removed = this.edgeStore.remove(snapshot.id);
              if (removed) {
                this.syncHandleStates(removed.sourceNodeId);
                this.syncHandleStates(removed.targetNodeId);
              }
              this.syncToolbarState();
            },
            redo: () => {
              const restored = this.edgeStore.add({
                ...snapshot,
                idOverride: snapshot.id,
              });
              if (restored) {
                this.syncHandleStates(restored.sourceNodeId);
                this.syncHandleStates(restored.targetNodeId);
              }
              this.syncToolbarState();
            },
          });
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
      const selectionBefore = this.captureSelectionSnapshot();
      let historyEntry: HistoryEntry | null = null;

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
            const cloneSnapshot = this.captureNodeSnapshot(clone);
            this.clearSelectionState();
            this.setNodeSelected(clone.id, true);
            this.refreshContainerChain(hoveredContainer.id);
            historyEntry = {
              undo: () => {
                this.removeNodeAndIncidentEdges(cloneSnapshot.id);
                this.restoreSelectionSnapshot(selectionBefore);
                this.refreshContainerChain(hoveredContainer.id);
                this.syncToolbarState();
              },
              redo: () => {
                this.store.restoreNodePlacement(
                  source.id,
                  snapshot.localX,
                  snapshot.localY,
                  snapshot.parentId
                );
                const createdClone = this.store.duplicateIntoComposition(
                  source.id,
                  hoveredContainer.id,
                  this.theme
                );
                if (createdClone) {
                  this.clearSelectionState();
                  this.setNodeSelected(createdClone.id, true);
                  this.refreshContainerChain(hoveredContainer.id);
                }
                this.syncToolbarState();
              },
            };
          }
        } else if (hoveredContainer?.nodeType === "group") {
          const oldParentId = source.parentId;
          const beforePlacement: NodePlacementSnapshot = {
            localX: snapshot.localX,
            localY: snapshot.localY,
            parentId: snapshot.parentId,
          };
          if (this.store.setParent(source.id, hoveredContainer.id)) {
            const afterPlacement: NodePlacementSnapshot = {
              localX: source.localX,
              localY: source.localY,
              parentId: source.parentId,
            };
            this.refreshContainerChain(hoveredContainer.id);
            if (oldParentId !== null && oldParentId !== hoveredContainer.id) {
              this.refreshContainerChain(oldParentId);
            }
            if (
              beforePlacement.localX !== afterPlacement.localX ||
              beforePlacement.localY !== afterPlacement.localY ||
              beforePlacement.parentId !== afterPlacement.parentId
            ) {
              historyEntry = {
                undo: () => {
                  this.store.restoreNodePlacement(
                    source.id,
                    beforePlacement.localX,
                    beforePlacement.localY,
                    beforePlacement.parentId
                  );
                  this.refreshContainerChain(afterPlacement.parentId);
                  this.refreshContainerChain(beforePlacement.parentId);
                  this.restoreSelectionSnapshot(selectionBefore);
                  this.syncToolbarState();
                },
                redo: () => {
                  this.store.restoreNodePlacement(
                    source.id,
                    afterPlacement.localX,
                    afterPlacement.localY,
                    afterPlacement.parentId
                  );
                  this.refreshContainerChain(beforePlacement.parentId);
                  this.refreshContainerChain(afterPlacement.parentId);
                  this.restoreSelectionSnapshot(selectionBefore);
                  this.syncToolbarState();
                },
              };
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
          const beforePlacement: NodePlacementSnapshot = {
            localX: snapshot.localX,
            localY: snapshot.localY,
            parentId: snapshot.parentId,
          };
          if (this.store.setParent(source.id, null)) {
            const afterPlacement: NodePlacementSnapshot = {
              localX: source.localX,
              localY: source.localY,
              parentId: source.parentId,
            };
            if (oldParentId !== null) {
              this.refreshContainerChain(oldParentId);
            }
            if (
              beforePlacement.localX !== afterPlacement.localX ||
              beforePlacement.localY !== afterPlacement.localY ||
              beforePlacement.parentId !== afterPlacement.parentId
            ) {
              historyEntry = {
                undo: () => {
                  this.store.restoreNodePlacement(
                    source.id,
                    beforePlacement.localX,
                    beforePlacement.localY,
                    beforePlacement.parentId
                  );
                  this.refreshContainerChain(afterPlacement.parentId);
                  this.refreshContainerChain(beforePlacement.parentId);
                  this.restoreSelectionSnapshot(selectionBefore);
                  this.syncToolbarState();
                },
                redo: () => {
                  this.store.restoreNodePlacement(
                    source.id,
                    afterPlacement.localX,
                    afterPlacement.localY,
                    afterPlacement.parentId
                  );
                  this.refreshContainerChain(beforePlacement.parentId);
                  this.refreshContainerChain(afterPlacement.parentId);
                  this.restoreSelectionSnapshot(selectionBefore);
                  this.syncToolbarState();
                },
              };
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
      } else if (source.nodeType === "composition") {
        const hoveredContainer = this.getHoveredContainer(screenX, screenY, source);
        if (hoveredContainer?.nodeType === "group") {
          const oldParentId = source.parentId;
          const beforePlacement: NodePlacementSnapshot = {
            localX: snapshot.localX,
            localY: snapshot.localY,
            parentId: snapshot.parentId,
          };
          if (this.store.setParent(source.id, hoveredContainer.id)) {
            const afterPlacement: NodePlacementSnapshot = {
              localX: source.localX,
              localY: source.localY,
              parentId: source.parentId,
            };
            this.refreshContainerChain(hoveredContainer.id);
            if (oldParentId !== null && oldParentId !== hoveredContainer.id) {
              this.refreshContainerChain(oldParentId);
            }
            if (
              beforePlacement.localX !== afterPlacement.localX ||
              beforePlacement.localY !== afterPlacement.localY ||
              beforePlacement.parentId !== afterPlacement.parentId
            ) {
              historyEntry = {
                undo: () => {
                  this.store.restoreNodePlacement(
                    source.id,
                    beforePlacement.localX,
                    beforePlacement.localY,
                    beforePlacement.parentId
                  );
                  this.refreshContainerChain(afterPlacement.parentId);
                  this.refreshContainerChain(beforePlacement.parentId);
                  this.restoreSelectionSnapshot(selectionBefore);
                  this.syncToolbarState();
                },
                redo: () => {
                  this.store.restoreNodePlacement(
                    source.id,
                    afterPlacement.localX,
                    afterPlacement.localY,
                    afterPlacement.parentId
                  );
                  this.refreshContainerChain(beforePlacement.parentId);
                  this.refreshContainerChain(afterPlacement.parentId);
                  this.restoreSelectionSnapshot(selectionBefore);
                  this.syncToolbarState();
                },
              };
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

      if (historyEntry) {
        this.pushHistory(historyEntry);
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

  private removeNodesAndEdges(nodeIds: Iterable<number>, edgeIds: Iterable<number>): void {
    const removedNodeIds = new Set<number>();
    for (const nodeId of nodeIds) {
      for (const removedId of this.store.collectRemovedIds(nodeId)) {
        removedNodeIds.add(removedId);
      }
    }

    const removedIdSet = new Set(removedNodeIds);
    const removedEdges = this.edgeStore.removeEdgesForNodes(removedNodeIds);
    const affectedNodeIds = new Set<number>();

    const selectedEdgeIdSet = new Set(edgeIds);
    for (const edgeId of selectedEdgeIdSet) {
      const removed = this.edgeStore.remove(edgeId);
      if (removed) {
        removedEdges.push(removed);
      }
    }

    for (const edge of removedEdges) {
      if (!removedIdSet.has(edge.sourceNodeId)) {
        affectedNodeIds.add(edge.sourceNodeId);
      }
      if (!removedIdSet.has(edge.targetNodeId)) {
        affectedNodeIds.add(edge.targetNodeId);
      }
    }

    for (const nodeId of removedNodeIds) {
      this.store.remove(nodeId);
    }

    for (const affectedNodeId of affectedNodeIds) {
      this.syncHandleStates(affectedNodeId);
    }
  }

  private removeNodeAndIncidentEdges(nodeId: number): void {
    this.removeNodesAndEdges([nodeId], []);
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
    return this.selectedNodeIds.size > 0 || this.selectedEdgeIds.size > 0;
  }

  private handleWheel(e: WheelEvent, canvas: HTMLCanvasElement): void {
    e.preventDefault();
    const { left, top } = canvas.getBoundingClientRect();
    this.camera.zoomAt(e.clientX - left, e.clientY - top, e.deltaY);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    const target = e.target as HTMLElement | null;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      target?.isContentEditable
    ) {
      return;
    }

    const isUndo = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey;
    const isRedo =
      (e.ctrlKey || e.metaKey) &&
      (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey));

    if (isUndo) {
      e.preventDefault();
      this.undo();
      return;
    }

    if (isRedo) {
      e.preventDefault();
      this.redo();
    }
  }
}
