export type ThemeName = 'dark' | 'light' | 'neon';
export type GeometryMeshType = 'rounded-square';
export type BGGeometryMeshType = 'dotted' | 'grid';
export type NodeType = 'node' | 'group';

export const NODE_LAYOUT = {
  headerHeight: 30,
  closeBtnPaddingRight: 20,
  closeBtnClickRadius: 15,
  editBtnPaddingRight: 45,
  editBtnClickRadius: 15,
  plusBtnPaddingBottom: 20,
  plusBtnClickRadius: 12,
};

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
}
