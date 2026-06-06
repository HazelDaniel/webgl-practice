/**
 * Manages an off-screen WebGL Framebuffer Object used for color-picking.
 * The FBO holds a color texture (for reading encoded node IDs) and a
 * depth renderbuffer. It must be resized whenever the canvas is resized.
 */
export class CustomFBO {
  protected fbo!: WebGLFramebuffer;
  protected width: number;
  protected height: number;
  private name: string = "CustomFBO";

  constructor(protected gl: WebGL2RenderingContext, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.allocate(width, height);
  }

  protected allocate(width: number, height: number) {
    throw new Error(`[${this.name}]: you must implement allocate function`);
  }

  bind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbo);
    this.gl.viewport(0, 0, this.width, this.height);
  }

  unbind(): void {
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  resize(width: number, height: number): void {
    throw new Error(`[${this.name}]: you must implement resize function`);
  }

  protected destroy(): void {
    throw new Error(`[${this.name}]: you must implement destroy function`);
  }
}