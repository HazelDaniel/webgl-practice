import { NodeData, isContainerNodeType } from './types.js';

/**
 * Computes the absolute world-space position of a node by recursively
 * walking up the parent chain. Root nodes (parentId === null) return their
 * localX/localY directly as world coordinates.
 *
 * This is intentionally a pure function — it has no side effects and does
 * not mutate any node. Renderers and drag handlers call it on demand.
 */
export function getWorldPosition(
  nodeId: number,
  nodes: Map<number, NodeData>
): { x: number; y: number } {
  const node = nodes.get(nodeId);
  if (!node) return { x: 0, y: 0 };

  // Base case: root node — local coords are world coords
  if (node.parentId === null) {
    return { x: node.localX, y: node.localY };
  }

  // Recursive case: add this node's local offset onto the parent's world position
  const parentWorld = getWorldPosition(node.parentId, nodes);
  return {
    x: parentWorld.x + node.localX,
    y: parentWorld.y + node.localY,
  };
}

/**
 * Re-parents a node to a new parent (or to the root if newParentId is null).
 *
 * The node's visual (world) position is preserved: we compute the current
 * world position first, then derive the new local offset that produces
 * the same world position under the new parent. This prevents the node
 * from "jumping" when it is re-parented.
 */
export function reparent(
  childId: number,
  newParentId: number | null,
  nodes: Map<number, NodeData>
): boolean {
  const child = nodes.get(childId);
  if (!child) return false;

  if (newParentId === null) {
    if (child.nodeType === 'composition' || child.nodeType === 'composition-child') {
      return false;
    }
  } else {
    const newParent = nodes.get(newParentId);
    if (!newParent) return false;
    if (!isContainerNodeType(newParent.nodeType)) return false;

    if (child.nodeType === 'group') return false;

    if (child.nodeType === 'composition') {
      if (newParent.nodeType !== 'group') return false;
    }

    if (child.nodeType === 'composition-child') {
      if (newParent.nodeType !== 'composition') return false;
    }

    if (child.nodeType === 'node') {
      if (newParent.nodeType === 'composition') return false;
    }
  }

  // Prevent a node from being its own ancestor (cycle guard)
  if (newParentId !== null && isAncestor(newParentId, childId, nodes)) return false;

  // Snapshot the child's current world position before anything changes
  const childWorld = getWorldPosition(childId, nodes);

  // Detach from the old parent
  if (child.parentId !== null) {
    const oldParent = nodes.get(child.parentId);
    if (oldParent) {
      oldParent.childIds = oldParent.childIds.filter((id) => id !== childId);
    }
  }

  // Compute and assign the new local offset
  if (newParentId !== null) {
    const newParentWorld = getWorldPosition(newParentId, nodes);
    child.localX = childWorld.x - newParentWorld.x;
    child.localY = childWorld.y - newParentWorld.y;

    const newParent = nodes.get(newParentId);
    if (newParent && !newParent.childIds.includes(childId)) {
      newParent.childIds.push(childId);
    }
  } else {
    // Promoted to root: local coords become world coords
    child.localX = childWorld.x;
    child.localY = childWorld.y;
  }

  child.parentId = newParentId;
  return true;
}

/**
 * Returns true if `ancestorId` is an ancestor of `nodeId` in the tree.
 * Used to prevent cycles when re-parenting.
 */
function isAncestor(
  ancestorId: number,
  nodeId: number,
  nodes: Map<number, NodeData>
): boolean {
  let current = nodes.get(nodeId);
  while (current && current.parentId !== null) {
    if (current.parentId === ancestorId) return true;
    current = nodes.get(current.parentId);
  }
  return false;
}
