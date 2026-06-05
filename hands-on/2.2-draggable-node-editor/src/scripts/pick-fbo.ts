/**
 * Manages an off-screen WebGL Framebuffer Object used for color-picking.
 * The FBO holds a color texture (for reading encoded node IDs) and a
 * depth renderbuffer. It must be resized whenever the canvas is resized.
 */
export class PickFBO {
  private fbo!: WebGLFramebuffer;
  private texture!: WebGLTexture;
  private renderBuffer!: WebGLRenderbuffer;
  private width: number;
  private height: number;

  constructor(private gl: WebGL2RenderingContext, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.allocate(width, height);
  }

  private allocate(width: number, height: number): void {
    const gl = this.gl;

    this.fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);

    // Color attachment - receives the color-coded node ID draw
    this.texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0);

    // Depth attachment - required for depth testing during pick render
    this.renderBuffer = gl.createRenderbuffer()!;
    gl.bindRenderbuffer(gl.RENDERBUFFER, this.renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, width, height);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.renderBuffer);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  /**
   * Read one pixel from the pick texture at canvas coordinates (x, y).
   * Note: WebGL's origin is bottom-left, so y is flipped.
   * Must be called while the FBO is bound.
   */
  readPixel(x: number, y: number): Uint8Array {
    const pixels = new Uint8Array(4);
    this.gl.readPixels(x, this.height - y, 1, 1, this.gl.RGBA, this.gl.UNSIGNED_BYTE, pixels);
    return pixels;
  }

  resize(width: number, height: number): void {
    this.destroy();
    this.width = width;
    this.height = height;
    this.allocate(width, height);
  }

  destroy(): void {
    this.gl.deleteFramebuffer(this.fbo);
    this.gl.deleteTexture(this.texture);
    this.gl.deleteRenderbuffer(this.renderBuffer);
  }
}
