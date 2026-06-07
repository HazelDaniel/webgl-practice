import { NodeShaderLocations, BGShaderLocations } from './types.js';

/**
 * Compiles vertex and fragment shaders, links them into a program, and returns it.
 * Throws a descriptive Error on any compilation or linking failure.
 */
export function createProgram(
  gl: WebGL2RenderingContext,
  vsSource: string,
  fsSource: string
): WebGLProgram {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (!vertexShader || !fragmentShader) throw new Error('could not create shader object');

  gl.shaderSource(vertexShader, vsSource);
  gl.compileShader(vertexShader);
  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(vertexShader);
    gl.deleteShader(vertexShader);
    throw new Error(`failed to compile vertex shader: ${log}`);
  }

  gl.shaderSource(fragmentShader, fsSource);
  gl.compileShader(fragmentShader);
  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(fragmentShader);
    gl.deleteShader(fragmentShader);
    throw new Error(`failed to compile fragment shader: ${log}`);
  }

  const program = gl.createProgram()!;
  if (!program) {
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    throw new Error('failed to create WebGL program');
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = `failed to link program: ${gl.getProgramInfoLog(program)}`;
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

/**
 * Queries and validates all attribute and uniform locations for the program.
 * Throws if any location is invalid.
 */
export function getShaderLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram
): NodeShaderLocations {
  const locations: NodeShaderLocations = {
    a_Position:   gl.getAttribLocation(program, 'a_Position'),
    a_TexCoord:   gl.getAttribLocation(program, 'a_TexCoord'),
    u_Color:      gl.getUniformLocation(program, 'u_Color')!,
    u_ModelMatrix:gl.getUniformLocation(program, 'u_ModelMatrix')!,
    u_ViewMatrix: gl.getUniformLocation(program, 'u_ViewMatrix')!,
    u_ProjMatrix: gl.getUniformLocation(program, 'u_ProjMatrix')!,
    u_Sampler:    gl.getUniformLocation(program, 'u_Sampler')!,
    u_UseTexture: gl.getUniformLocation(program, 'u_UseTexture')!,
  };
  validateShaderLocations(locations);
  return locations;
}

export function getBGShaderLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram
): BGShaderLocations {
  const locations: BGShaderLocations = {
    a_Position: gl.getAttribLocation(program, 'a_Position'),
    u_Color: gl.getUniformLocation(program, 'u_Color')!,
    u_UsePointMask: gl.getUniformLocation(program, 'u_UsePointMask')!,
  };
  validateShaderLocations(locations);
  return locations;
}


function validateShaderLocations(
  locs: object
): void {
  for (const [key, val] of Object.entries(
    locs as Record<string, number | WebGLUniformLocation | null>
  )) {
    if (key.startsWith('a_') && (val as number) < 0) {
      throw new Error(`Shader attribute ${key} has an invalid location`);
    } else if (key.startsWith('u_') && !val) {
      throw new Error(`Shader uniform ${key} has an invalid location`);
    }
  }
}
