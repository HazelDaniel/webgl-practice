import { Camera } from './camera.js';
import { getHandleScreenGeometry } from './handle-geometry.js';
import { NodeStore } from './node-store.js';
import { getWorldPosition } from './scene-graph.js';
import { EdgeData, HandleSide, NodeHandleData } from './types.js';

export interface Point2D {
  x: number;
  y: number;
}

export interface ArrowheadGeometry {
  tip: Point2D;
  tangent: Point2D;
}

export interface EdgeRouteGeometry {
  edge: EdgeData;
  worldPoints: Point2D[];
  screenPoints: Point2D[];
  labelWorldPoint: Point2D;
  labelScreenPoint: Point2D;
  arrowhead: ArrowheadGeometry | null;
}

const MIN_SAMPLE_COUNT = 48;
const MAX_SAMPLE_COUNT = 72;
const SAMPLE_DISTANCE_STEP = 42;

export function buildEdgeRouteGeometry(
  edge: EdgeData,
  store: NodeStore,
  camera: Camera
): EdgeRouteGeometry | null {
  const sourceNode = store.get(edge.sourceNodeId);
  const targetNode = store.get(edge.targetNodeId);
  if (!sourceNode || !targetNode) return null;

  const sourceHandle = sourceNode.handles.find(
    (handle) => handle.side === edge.sourceHandleSide
  );
  const targetHandle = targetNode.handles.find(
    (handle) => handle.side === edge.targetHandleSide
  );
  if (!sourceHandle || !targetHandle) return null;

  const sourceWorld = getHandleWorldPoint(sourceNode.id, sourceHandle, store, camera);
  const targetWorld = getHandleWorldPoint(targetNode.id, targetHandle, store, camera);

  const route = buildCubicRoute(
    sourceWorld,
    edge.sourceHandleSide,
    targetWorld,
    edge.targetHandleSide,
    edge.edgeType
  );
  const screenPoints = route.worldPoints.map((point) => camera.worldToScreen(point.x, point.y));
  const labelWorldPoint = getPolylineMidpoint(route.worldPoints);
  const labelScreenPoint = camera.worldToScreen(labelWorldPoint.x, labelWorldPoint.y);

  return {
    edge,
    worldPoints: route.worldPoints,
    screenPoints,
    labelWorldPoint,
    labelScreenPoint,
    arrowhead: edge.headType === 'arrow' ? route.arrowhead : null,
  };
}

export function buildConnectionPreviewGeometry(
  sourceNodeId: number,
  sourceHandleSide: HandleSide,
  screenX: number,
  screenY: number,
  store: NodeStore,
  camera: Camera
): EdgeRouteGeometry | null {
  const sourceNode = store.get(sourceNodeId);
  if (!sourceNode) return null;

  const sourceHandle = sourceNode.handles.find((handle) => handle.side === sourceHandleSide);
  if (!sourceHandle) return null;

  const sourceWorld = getHandleWorldPoint(sourceNode.id, sourceHandle, store, camera);
  const targetWorld = camera.screenToWorld(screenX, screenY);
  const oppositeSide: HandleSide = sourceHandleSide === 'left' ? 'right' : 'left';
  const route = buildCubicRoute(sourceWorld, sourceHandleSide, targetWorld, oppositeSide, 'cubic');
  const screenPoints = route.worldPoints.map((point) => camera.worldToScreen(point.x, point.y));
  const labelWorldPoint = getPolylineMidpoint(route.worldPoints);
  const labelScreenPoint = camera.worldToScreen(labelWorldPoint.x, labelWorldPoint.y);

  return {
    edge: {
      id: -1,
      sourceNodeId,
      sourceHandleSide,
      targetNodeId: -1,
      targetHandleSide: oppositeSide,
      edgeType: 'cubic',
      headType: 'none',
      headSkinId: 'arrow',
      label: '',
      isSelected: false,
      visible: true,
    },
    worldPoints: route.worldPoints,
    screenPoints,
    labelWorldPoint,
    labelScreenPoint,
    arrowhead: null,
  };
}

export function hitTestEdgePolyline(
  screenX: number,
  screenY: number,
  polyline: Point2D[],
  thresholdPx = 8
): boolean {
  if (polyline.length < 2) return false;

  const thresholdSq = thresholdPx * thresholdPx;
  for (let i = 0; i < polyline.length - 1; i++) {
    if (distancePointToSegmentSquared(screenX, screenY, polyline[i], polyline[i + 1]) <= thresholdSq) {
      return true;
    }
  }

  return false;
}

function buildCubicRoute(
  sourceWorld: Point2D,
  sourceSide: HandleSide,
  targetWorld: Point2D,
  targetSide: HandleSide,
  edgeType: EdgeData['edgeType']
): { worldPoints: Point2D[]; arrowhead: ArrowheadGeometry | null } {
  if (edgeType === 'line') {
    return {
      worldPoints: [sourceWorld, targetWorld],
      arrowhead: buildEdgeHeadGeometry(sourceWorld, targetWorld),
    };
  }

  const sourceDirection = sideDirection(sourceSide);
  const targetDirection = sideDirection(targetSide);
  const dx = targetWorld.x - sourceWorld.x;
  const dy = targetWorld.y - sourceWorld.y;
  const distance = Math.hypot(dx, dy);
  const bend = clamp(distance * (edgeType === 'line-curve' ? 0.24 : 0.34), 64, 260);
  const verticalBias = clamp(dy * 0.12, -80, 80);

  const control1: Point2D = {
    x: sourceWorld.x + sourceDirection * bend,
    y: sourceWorld.y + verticalBias,
  };

  const control2: Point2D = {
    x: targetWorld.x + targetDirection * bend,
    y: targetWorld.y - verticalBias,
  };

  const sampleCount = clamp(
    Math.ceil(distance / SAMPLE_DISTANCE_STEP) + 8,
    MIN_SAMPLE_COUNT,
    MAX_SAMPLE_COUNT
  );

  const worldPoints: Point2D[] = [];
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount;
    worldPoints.push(sampleCubic(sourceWorld, control1, control2, targetWorld, t));
  }

  return {
    worldPoints,
    arrowhead: buildEdgeHeadGeometry(
      targetWorld,
      targetWorld,
      derivativeAtEnd(control2, targetWorld)
    ),
  };
}

function buildEdgeHeadGeometry(
  tip: Point2D,
  previousPoint: Point2D,
  tangentOverride?: Point2D
): ArrowheadGeometry | null {
  const tangent = normalize(
    tangentOverride ?? {
      x: tip.x - previousPoint.x,
      y: tip.y - previousPoint.y,
    }
  );

  if (tangent.x === 0 && tangent.y === 0) return null;

  return {
    tip,
    tangent,
  };
}

function derivativeAtEnd(control2: Point2D, end: Point2D): Point2D {
  return {
    x: 3 * (end.x - control2.x),
    y: 3 * (end.y - control2.y),
  };
}

function getHandleWorldPoint(
  nodeId: number,
  handle: NodeHandleData,
  store: NodeStore,
  camera: Camera
): Point2D {
  const node = store.get(nodeId);
  if (!node) return { x: 0, y: 0 };

  const { x, y } = getWorldPosition(node.id, store.allNodesMap);
  const geometry = getHandleScreenGeometry(x, y, node, handle, camera.zoom, camera.panX, camera.panY);
  return camera.screenToWorld(geometry.centerX, geometry.centerY);
}

function getPolylineMidpoint(points: Point2D[]): Point2D {
  if (points.length === 0) return { x: 0, y: 0 };
  if (points.length === 1) return points[0];

  let total = 0;
  const lengths: number[] = [0];
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].y - points[i].y);
    lengths.push(total);
  }

  const halfway = total / 2;
  for (let i = 0; i < lengths.length - 1; i++) {
    if (lengths[i + 1] < halfway) continue;
    const segmentLength = lengths[i + 1] - lengths[i];
    const ratio = segmentLength === 0 ? 0 : (halfway - lengths[i]) / segmentLength;
    return {
      x: lerp(points[i].x, points[i + 1].x, ratio),
      y: lerp(points[i].y, points[i + 1].y, ratio),
    };
  }

  return points[points.length - 1];
}

function sampleCubic(
  p0: Point2D,
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  t: number
): Point2D {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;

  return {
    x:
      uuu * p0.x +
      3 * uu * t * p1.x +
      3 * u * tt * p2.x +
      ttt * p3.x,
    y:
      uuu * p0.y +
      3 * uu * t * p1.y +
      3 * u * tt * p2.y +
      ttt * p3.y,
  };
}

function sideDirection(side: HandleSide): number {
  return side === 'left' ? -1 : 1;
}

function distancePointToSegmentSquared(
  px: number,
  py: number,
  a: Point2D,
  b: Point2D
): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (px - a.x) * (px - a.x) + (py - a.y) * (py - a.y);

  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const distX = px - projX;
  const distY = py - projY;
  return distX * distX + distY * distY;
}

function normalize(point: Point2D): Point2D {
  const length = Math.hypot(point.x, point.y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: point.x / length, y: point.y / length };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
