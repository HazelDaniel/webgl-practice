import { NodeData, ThemeName } from './types.js';
import { createTextTexture } from './texture.js';
import { reparent } from './scene-graph.js';

/**
 * Owns the canonical node list. Handles creation, deletion,
 * selection state, and texture regeneration.
 *
 * Nodes are stored in a Map keyed by id for O(1) lookup.
 * Render order is insertion order (Map preserves this).
 */
export class NodeStore {
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

  /** Create a new root node at world coordinates (localX, localY). */
  add(localX: number, localY: number, text: string, theme: ThemeName): NodeData {
    const id = ++this._nextId;
    const width = 180;
    const height = 150;

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
      texture: createTextTexture(this.gl, this.ctx, this.textCanvas, text, width, height, theme),
      pickColor: [r / 255, g / 255, b / 255],
      isSelected: false,
      visible: true,
      parentId: null,
      childIds: [],
    };

    this.nodes.set(id, node);
    return node;
  }

  /**
   * Remove a node and free its GPU texture.
   * Any children of the deleted node are promoted to the deleted node's
   * parent (or to the root if it had none), preserving their world position.
   */
  remove(id: number): void {
    const node = this.nodes.get(id);
    if (!node) return;

    // Promote children before removal so reparent() can still find the node
    const childrenToReparent = [...node.childIds];
    for (const childId of childrenToReparent) {
      reparent(childId, node.parentId, this.nodes);
    }

    // Detach from parent's childIds list
    if (node.parentId !== null) {
      const parent = this.nodes.get(node.parentId);
      if (parent) {
        parent.childIds = parent.childIds.filter((cid) => cid !== id);
      }
    }

    this.gl.deleteTexture(node.texture);
    this.nodes.delete(id);
  }

  /** Returns the currently selected node, if any. */
  getSelected(): NodeData | undefined {
    return [...this.nodes.values()].find((n) => n.isSelected);
  }

  /** Deselect every node. */
  deselectAll(): void {
    this.nodes.forEach((n) => (n.isSelected = false));
  }

  /** Rebuild textures for all nodes under a new theme. */
  regenerateTextures(theme: ThemeName): void {
    this.nodes.forEach((node) => {
      this.gl.deleteTexture(node.texture);
      node.texture = createTextTexture(
        this.gl, this.ctx, this.textCanvas,
        node.text, node.width, node.height, theme
      );
    });
  }

  /** Assign a new parent to a child node, preserving world position. */
  setParent(childId: number, newParentId: number | null): void {
    reparent(childId, newParentId, this.nodes);
  }

  /** All visible nodes in insertion order (for rendering). */
  visibleNodes(): NodeData[] {
    return [...this.nodes.values()].filter((n) => n.visible);
  }
}
