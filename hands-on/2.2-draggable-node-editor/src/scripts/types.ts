export type ThemeName = 'dark' | 'light' | 'neon';
export type GeometryMeshType = 'rounded-square';

export interface ShaderLocations {
  a_Position: number;
  a_TexCoord: number;
  u_ModelMatrix: WebGLUniformLocation;
  u_ViewMatrix: WebGLUniformLocation;
  u_ProjMatrix: WebGLUniformLocation;
  u_Color: WebGLUniformLocation;
  u_UseTexture: WebGLUniformLocation;
  u_Sampler: WebGLUniformLocation;
}

export interface NodeData {
  id: number;
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
