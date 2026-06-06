import { NodeData, ThemeName, NodeType } from './types.js';
import { createTextTexture } from './texture.js';
import { reparent } from './scene-graph.js';

/**
 * Owns the canonical node list. Groups and regular nodes are stored
 * in separate Maps so that render order is always:
 *   groups first (back) → nodes second (front)
 * This guarantees children are always clickable on top of their parent group.
 */
export class NodeStore {
  /** Group nodes — drawn first (behind everything). */
  readonly groups: Map<number, NodeData> = new Map();
  /** Regular nodes — drawn second (in front of groups). */
  readonly nodes: Map<number, NodeData> = new Map();
  private _nextId: number = 0;

  constructor(
    private gl: WebGL2RenderingContext,
    private ctx: CanvasRenderingContext2D,
    private textCanvas: HTMLCanvasElement
  ) {}

  /** The id that the next call to add() will assign. Useful for labelling. */
  get nextNodeId(): number {
    return this._nextId + 1;
  }

  /**
   * Returns a combined Map view of all nodes (groups + regular).
   * Used by scene-graph functions that need to traverse the full tree.
   */
  get allNodesMap(): Map<number, NodeData> {
    const combined = new Map<number, NodeData>();
    this.groups.forEach((n, id) => combined.set(id, n));
    this.nodes.forEach((n, id) => combined.set(id, n));
    return combined;
  }

  /** O(1) lookup across both maps. */
  get(id: number): NodeData | undefined {
    return this.nodes.get(id) ?? this.groups.get(id);
  }

  /** Create a new root node at world coordinates (localX, localY). */
  add(localX: number, localY: number, text: string, theme: ThemeName, nodeType: NodeType = 'node'): NodeData {
    const id = ++this._nextId;
    const width = nodeType === 'group' ? 240 : 180;
    const height = nodeType === 'group' ? 200 : 150;

    // Encode id as RGB for the pick texture (up to 16.7 million unique nodes)
    const r = id & 0xff;
    const g = (id >> 8) & 0xff;
    const b = (id >> 16) & 0xff;

    const node: NodeData = {
      id,
      localX,
      localY,
      width,
      height,
      text,
      texture: createTextTexture(this.gl, this.ctx, this.textCanvas, text, width, height, theme, nodeType),
      pickColor: [r / 255, g / 255, b / 255],
      isSelected: false,
      visible: true,
      parentId: null,
      childIds: [],
      nodeType,
      isDropTarget: false,
    };

    if (nodeType === 'group') {
      this.groups.set(id, node);
    } else {
      this.nodes.set(id, node);
    }
    return node;
  }

  /**
   * Remove a node and free its GPU texture.
   * Any children of the deleted node are promoted to the deleted node's
   * parent (or to the root if it had none), preserving their world position.
   */
  remove(id: number): void {
    const node = this.get(id);
    if (!node) return;

    const allNodes = this.allNodesMap;

    if (node.nodeType === 'group') {
      // Cascading deletion: recursively delete children
      const childrenToRemove = [...node.childIds];
      for (const childId of childrenToRemove) {
        this.remove(childId);
      }
    } else {
      // Promote children before removal so reparent() can still find the node
      const childrenToReparent = [...node.childIds];
      for (const childId of childrenToReparent) {
        reparent(childId, node.parentId, allNodes);
        // Sync the reparented child back into the correct map
        const child = allNodes.get(childId);
        if (child) this.syncToMap(child);
      }
    }

    // Detach from parent's childIds list
    if (node.parentId !== null) {
      const parent = this.get(node.parentId);
      if (parent) {
        parent.childIds = parent.childIds.filter((cid) => cid !== id);
      }
    }

    this.gl.deleteTexture(node.texture);
    this.groups.delete(id);
    this.nodes.delete(id);
  }

  /** Returns the currently selected node, if any. */
  getSelected(): NodeData | undefined {
    for (const n of this.groups.values()) { if (n.isSelected) return n; }
    for (const n of this.nodes.values())  { if (n.isSelected) return n; }
    return undefined;
  }

  /** Deselect every node. */
  deselectAll(): void {
    this.groups.forEach((n) => (n.isSelected = false));
    this.nodes.forEach((n) => (n.isSelected = false));
  }

  /** Clear isDropTarget on every node. */
  clearDropTargets(): void {
    this.groups.forEach((n) => (n.isDropTarget = false));
    this.nodes.forEach((n) => (n.isDropTarget = false));
  }

  /** Rebuild textures for all nodes under a new theme. */
  regenerateTextures(theme: ThemeName): void {
    const regen = (node: NodeData) => {
      this.gl.deleteTexture(node.texture);
      node.texture = createTextTexture(
        this.gl, this.ctx, this.textCanvas,
        node.text, node.width, node.height, theme, node.nodeType
      );
    };
    this.groups.forEach(regen);
    this.nodes.forEach(regen);
  }

  /** Assign a new parent to a child node, preserving world position. */
  setParent(childId: number, newParentId: number | null): boolean {
    return reparent(childId, newParentId, this.allNodesMap);
  }

  /**
   * All visible nodes in render order: groups first, then regular nodes.
   * This ensures groups are always behind their children in the z-stack.
   */
  visibleNodes(): NodeData[] {
    const result: NodeData[] = [];
    this.groups.forEach((n) => { if (n.visible) result.push(n); });
    this.nodes.forEach((n) =>  { if (n.visible) result.push(n); });
    return result;
  }

  /** Re-calculates bounds of a group node based on its children, and centers children. */
  updateGroupBounds(groupId: number, theme: ThemeName): void {
    const group = this.groups.get(groupId);
    if (!group || group.nodeType !== 'group') return;

    if (group.childIds.length === 0) {
      group.width = 240;
      group.height = 200;
      this.gl.deleteTexture(group.texture);
      group.texture = createTextTexture(this.gl, this.ctx, this.textCanvas, group.text, group.width, group.height, theme, group.nodeType);
      return;
    }

    const paddingX = 20;
    const paddingY = 50; // top padding for header
    const paddingBottom = 40;
    const gapY = 10;

    let totalChildHeight = 0;
    let maxChildWidth = 0;

    const children = group.childIds.map(id => this.get(id)!).filter(Boolean);
    for (const child of children) {
      maxChildWidth = Math.max(maxChildWidth, child.width);
      totalChildHeight += child.height;
    }
    totalChildHeight += Math.max(0, children.length - 1) * gapY;

    // Update group bounds
    group.width = Math.max(240, maxChildWidth + paddingX * 2);
    group.height = Math.max(200, totalChildHeight + paddingY + paddingBottom);

    // Second pass: center children
    let currentY = paddingY;
    for (const child of children) {
      child.localX = (group.width - child.width) / 2;
      child.localY = currentY;
      currentY += child.height + gapY;
    }

    // Regenerate texture
    this.gl.deleteTexture(group.texture);
    group.texture = createTextTexture(this.gl, this.ctx, this.textCanvas, group.text, group.width, group.height, theme, group.nodeType);
  }

  /** Ensure a node is stored in the correct map based on its nodeType. */
  private syncToMap(node: NodeData): void {
    if (node.nodeType === 'group') {
      this.groups.set(node.id, node);
    } else {
      this.nodes.set(node.id, node);
    }
  }
}
