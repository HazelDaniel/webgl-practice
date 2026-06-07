import { HANDLE_LAYOUT, HandleShape, NodeData, NodeHandleData } from './types.js';

export interface HandleScreenGeometry {
  centerX: number;
  centerY: number;
  radius: number;
  size: number;
  shape: HandleShape;
}

export interface HandleHit {
  nodeId: number;
  handle: NodeHandleData;
  geometry: HandleScreenGeometry;
}

export function getHandleScreenGeometry(
  worldX: number,
  worldY: number,
  node: NodeData,
  handle: NodeHandleData,
  zoom: number,
  panX: number,
  panY: number
): HandleScreenGeometry {
  const originX = worldX * zoom + panX;
  const originY = worldY * zoom + panY;
  const radius = handle.style.size / 2;

  return {
    centerX:
      handle.side === 'left'
        ? originX - HANDLE_LAYOUT.offsetX
        : originX + node.width * zoom + HANDLE_LAYOUT.offsetX,
    centerY: originY + (node.height * zoom) / 2,
    radius,
    size: handle.style.size,
    shape: handle.style.shape,
  };
}

export function isPointInsideHandle(
  screenX: number,
  screenY: number,
  geometry: HandleScreenGeometry
): boolean {
  if (geometry.shape === 'circle') {
    const dx = screenX - geometry.centerX;
    const dy = screenY - geometry.centerY;
    return dx * dx + dy * dy <= geometry.radius * geometry.radius;
  }

  const halfSize = geometry.size / 2;
  return (
    Math.abs(screenX - geometry.centerX) <= halfSize &&
    Math.abs(screenY - geometry.centerY) <= halfSize
  );
}
