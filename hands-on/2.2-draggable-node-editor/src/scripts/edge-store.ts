import {
  EdgeData,
  EdgeHeadSkinId,
  EdgeHeadType,
  EdgeType,
  HandleSide,
} from './types.js';

export interface CreateEdgeParams {
  sourceNodeId: number;
  sourceHandleSide: HandleSide;
  targetNodeId: number;
  targetHandleSide: HandleSide;
  edgeType?: EdgeType;
  headType?: EdgeHeadType;
  headSkinId?: EdgeHeadSkinId;
  label?: string;
  isSelected?: boolean;
  visible?: boolean;
  idOverride?: number;
}

type NodeSideConnections = Map<HandleSide, Set<number>>;

/**
 * Canonical edge collection with adjacency indexes for fast incident-edge
 * cleanup when nodes are deleted.
 */
export class EdgeStore {
  readonly edges: Map<number, EdgeData> = new Map();
  private adjacency: Map<number, NodeSideConnections> = new Map();
  private _nextId = 0;

  get nextEdgeId(): number {
    return this._nextId + 1;
  }

  allEdges(): EdgeData[] {
    return [...this.edges.values()];
  }

  get(id: number): EdgeData | undefined {
    return this.edges.get(id);
  }

  hasConnection(nodeId: number, side: HandleSide): boolean {
    const sideMap = this.adjacency.get(nodeId);
    if (!sideMap) return false;

    const edgeIds = sideMap.get(side);
    return Boolean(edgeIds && edgeIds.size > 0);
  }

  add(params: CreateEdgeParams): EdgeData | null {
    const {
      sourceNodeId,
      sourceHandleSide,
      targetNodeId,
      targetHandleSide,
      edgeType = 'cubic',
      headType = 'arrow',
      headSkinId = 'pill',
      label = '',
      isSelected = false,
      visible = true,
      idOverride,
    } = params;

    if (sourceNodeId === targetNodeId) return null;
    if (this.hasConnection(sourceNodeId, sourceHandleSide)) return null;
    if (this.hasConnection(targetNodeId, targetHandleSide)) return null;

    const existing = this.findEdgeByEndpoints(
      sourceNodeId,
      sourceHandleSide,
      targetNodeId,
      targetHandleSide
    );
    if (existing) return existing;

    const id = idOverride ?? ++this._nextId;
    this._nextId = Math.max(this._nextId, id);

    const edge: EdgeData = {
      id,
      sourceNodeId,
      sourceHandleSide,
      targetNodeId,
      targetHandleSide,
      edgeType,
      headType,
      headSkinId,
      label,
      isSelected,
      visible,
    };

    this.edges.set(id, edge);
    this.addAdjacency(id, sourceNodeId, sourceHandleSide);
    this.addAdjacency(id, targetNodeId, targetHandleSide);
    return edge;
  }

  remove(id: number): EdgeData | null {
    const edge = this.edges.get(id);
    if (!edge) return null;

    this.removeAdjacency(id, edge.sourceNodeId, edge.sourceHandleSide);
    this.removeAdjacency(id, edge.targetNodeId, edge.targetHandleSide);
    this.edges.delete(id);
    return edge;
  }

  removeEdgesForNode(nodeId: number): EdgeData[] {
    const sideMap = this.adjacency.get(nodeId);
    if (!sideMap) return [];

    const edgeIds = new Set<number>();
    for (const ids of sideMap.values()) {
      for (const edgeId of ids) {
        edgeIds.add(edgeId);
      }
    }

    const removed: EdgeData[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.remove(edgeId);
      if (edge) removed.push(edge);
    }
    return removed;
  }

  removeEdgesForNodes(nodeIds: Iterable<number>): EdgeData[] {
    const edgeIds = new Set<number>();

    for (const nodeId of nodeIds) {
      const sideMap = this.adjacency.get(nodeId);
      if (!sideMap) continue;

      for (const ids of sideMap.values()) {
        for (const edgeId of ids) {
          edgeIds.add(edgeId);
        }
      }
    }

    const removed: EdgeData[] = [];
    for (const edgeId of edgeIds) {
      const edge = this.remove(edgeId);
      if (edge) removed.push(edge);
    }
    return removed;
  }

  private findEdgeByEndpoints(
    sourceNodeId: number,
    sourceHandleSide: HandleSide,
    targetNodeId: number,
    targetHandleSide: HandleSide
  ): EdgeData | undefined {
    for (const edge of this.edges.values()) {
      if (
        edge.sourceNodeId === sourceNodeId &&
        edge.sourceHandleSide === sourceHandleSide &&
        edge.targetNodeId === targetNodeId &&
        edge.targetHandleSide === targetHandleSide
      ) {
        return edge;
      }
    }

    return undefined;
  }

  private addAdjacency(edgeId: number, nodeId: number, side: HandleSide): void {
    let sideMap = this.adjacency.get(nodeId);
    if (!sideMap) {
      sideMap = new Map<HandleSide, Set<number>>();
      this.adjacency.set(nodeId, sideMap);
    }

    let edgeIds = sideMap.get(side);
    if (!edgeIds) {
      edgeIds = new Set<number>();
      sideMap.set(side, edgeIds);
    }

    edgeIds.add(edgeId);
  }

  private removeAdjacency(edgeId: number, nodeId: number, side: HandleSide): void {
    const sideMap = this.adjacency.get(nodeId);
    if (!sideMap) return;

    const edgeIds = sideMap.get(side);
    if (!edgeIds) return;

    edgeIds.delete(edgeId);
    if (edgeIds.size === 0) {
      sideMap.delete(side);
    }

    if (sideMap.size === 0) {
      this.adjacency.delete(nodeId);
    }
  }
}
