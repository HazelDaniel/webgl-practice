/**
 * Manages all viewport camera state: pan (translation) and zoom (scale).
 * The view matrix produced here is applied per-frame as u_ViewMatrix in the shader.
 *
 * Coordinate convention: screen space has origin at top-left, y-down.
 * The orthographic projection handles the flip; the camera only deals in pixels.
 */
export class Camera {
  panX: number = 0;
  panY: number = 0;
  zoom: number = 1;

  private _viewMatrix: Matrix4 = new Matrix4();

  /** Translate the viewport by (dx, dy) in screen pixels. */
  pan(dx: number, dy: number): void {
    this.panX += dx;
    this.panY += dy;
  }

  /**
   * Zoom toward/away from a specific screen point so that the world position
   * under the mouse cursor stays fixed after the zoom.
   */
  zoomAt(mouseX: number, mouseY: number, deltaY: number): void {
    const sensitivity = 0.001;
    const factor = 1.0 - deltaY * sensitivity;
    const newZoom = Math.max(0.1, Math.min(this.zoom * factor, 5.0));
    const scaleChange = newZoom / this.zoom;
    // Adjust pan so the point under the cursor remains stationary
    this.panX = mouseX - (mouseX - this.panX) * scaleChange;
    this.panY = mouseY - (mouseY - this.panY) * scaleChange;
    this.zoom = newZoom;
  }

  /**
   * Convert a screen-space coordinate to a world-space coordinate.
   * Used to correctly place nodes when adding or dragging, regardless of pan/zoom.
   */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: (sx - this.panX) / this.zoom,
      y: (sy - this.panY) / this.zoom,
    };
  }

  /**
   * Compute and return the current view matrix.
   * The matrix is: Translate(panX, panY) * Scale(zoom, zoom, 1).
   */
  getViewMatrix(): Matrix4 {
    this._viewMatrix.setIdentity();
    this._viewMatrix.translate(this.panX, this.panY, 0);
    this._viewMatrix.scale(this.zoom, this.zoom, 1.0);
    return this._viewMatrix;
  }
}
