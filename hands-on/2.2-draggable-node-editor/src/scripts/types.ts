export type ThemeName = 'dark' | 'light' | 'neon';
export type GeometryMeshType = 'rounded-square';
export type BGGeometryMeshType = 'dotted' | 'grid';
export type NodeType = 'node' | 'group' | 'composition' | 'composition-child';
export type ContainerNodeType = 'group' | 'composition';
export type LeafNodeType = 'node' | 'composition-child';
export type CandidateNodeType = Exclude<NodeType, 'composition-child'>;
export type ConnectionMode = 'group' | 'node';
export type HandleSide = 'left' | 'right';
export type HandleShape = 'circle' | 'square';
export type EdgeType = 'line' | 'cubic' | 'line-curve';
export type EdgeHeadType = 'none' | 'arrow';
export type EdgeHeadSkinId = 'arrow' | 'chevron' | 'diamond' | 'pill';

export interface HandleStyle {
  shape: HandleShape;
  backgroundColor: string;
  connectedBorderColor: string;
  disconnectedBorderColor: string;
  borderWidth: number;
  size: number;
}

export interface NodeHandleData {
  candidateId: number;
  side: HandleSide;
  isConnected: boolean;
  style: HandleStyle;
}

export interface EdgeData {
  id: number;
  sourceNodeId: number;
  sourceHandleSide: HandleSide;
  targetNodeId: number;
  targetHandleSide: HandleSide;
  edgeType: EdgeType;
  headType: EdgeHeadType;
  headSkinId: EdgeHeadSkinId;
  label: string;
  isSelected: boolean;
  visible: boolean;
}

export interface NodeEditorConfig {
  connectionMode?: ConnectionMode;
  handleStyle?: HandleStyle;
}

export interface ConnectionPreviewData {
  sourceNodeId: number;
  sourceHandleSide: HandleSide;
  screenX: number;
  screenY: number;
}

export const NODE_LAYOUT = {
  headerHeight: 30,
  closeBtnPaddingRight: 20,
  closeBtnClickRadius: 15,
  editBtnPaddingRight: 45,
  editBtnClickRadius: 15,
  plusBtnPaddingBottom: 20,
  plusBtnClickRadius: 12,
};

export const HANDLE_LAYOUT = {
  sideInset: 8,
  offsetX: -2,
};

export const DEFAULT_HANDLE_STYLE: HandleStyle = {
  shape: 'circle',
  backgroundColor: 'rgba(148, 163, 184, 0.95)',
  connectedBorderColor: 'rgba(34, 197, 94, 1)',
  disconnectedBorderColor: 'rgba(148, 163, 184, 0.85)',
  borderWidth: 2,
  size: 12,
};

export const NODE_SIZE = {
  node: { width: 180, height: 150 },
  group: { width: 240, height: 200 },
  composition: { width: 240, height: 200 },
  compositionChild: { width: 180, height: 92 },
} as const;

export function isContainerNodeType(nodeType: NodeType): nodeType is ContainerNodeType {
  return nodeType === 'group' || nodeType === 'composition';
}

export function isLeafNodeType(nodeType: NodeType): nodeType is LeafNodeType {
  return nodeType === 'node' || nodeType === 'composition-child';
}

export function isCandidateNodeType(
  nodeType: NodeType,
  connectionMode: ConnectionMode
): nodeType is CandidateNodeType {
  if (connectionMode === 'group') {
    return nodeType === 'group';
  }

  return nodeType === 'node' || nodeType === 'composition';
}

export function getDefaultNodeSize(nodeType: NodeType): { width: number; height: number } {
  switch (nodeType) {
    case 'group':
    case 'composition':
      return NODE_SIZE.group;
    case 'composition-child':
      return NODE_SIZE.compositionChild;
    case 'node':
    default:
      return NODE_SIZE.node;
  }
}

export interface NodeShaderLocations {
  a_Position: number;
  a_TexCoord: number;
  u_ModelMatrix: WebGLUniformLocation;
  u_ViewMatrix: WebGLUniformLocation;
  u_ProjMatrix: WebGLUniformLocation;
  u_Color: WebGLUniformLocation;
  u_UseTexture: WebGLUniformLocation;
  u_Sampler: WebGLUniformLocation;
}

export interface BGShaderLocations {
  a_Position: number;
  u_Color: WebGLUniformLocation;
  u_UsePointMask: WebGLUniformLocation;
}

export interface NodeData {
  id: number;
  nodeType: NodeType;
  isDropTarget?: boolean;
  /** Position relative to parent node (or world origin if parentId is null). */
  localX: number;
  localY: number;
  width: number;
  height: number;
  text: string;
  texture: WebGLTexture;
  pickColor: [number, number, number];
  isSelected: boolean;
  visible: boolean;
  /** Scene graph: id of the parent node, or null for root nodes. */
  parentId: number | null;
  /** Scene graph: ordered list of child node ids. */
  childIds: number[];
  /** Handle metadata for nodes that can participate in connections. */
  handles: NodeHandleData[];
}
