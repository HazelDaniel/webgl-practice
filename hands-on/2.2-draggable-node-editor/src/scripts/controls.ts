import { ThemeName } from './types.js';

/** All interaction events the NodeEditor handles, expressed as plain callbacks. */
export interface ControlCallbacks {
  onAddNode(): void;
  onDeleteNode(): void;
  onBgColorChange(r: number, g: number, b: number, a: number): void;
  onThemeChange(theme: ThemeName): void;
  onMouseDown(e: MouseEvent): void;
  onMouseMove(e: MouseEvent): void;
  onMouseUp(e: MouseEvent): void;
  onWheel(e: WheelEvent): void;
}

/**
 * Wires all DOM event listeners.
 * Receives plain callbacks instead of direct module references — this
 * prevents UIControls from depending on any other module, keeping it
 * fully decoupled from the rest of the system.
 */
export class UIControls {
  private addNodeButton: HTMLButtonElement;
  private deleteNodeButton: HTMLButtonElement;

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    callbacks: ControlCallbacks
  ) {
    this.addNodeButton    = container.querySelector('#btn-add-node')!    as HTMLButtonElement;
    this.deleteNodeButton = container.querySelector('#btn-delete-node')! as HTMLButtonElement;

    this.addNodeButton.addEventListener('click', () => callbacks.onAddNode());
    this.deleteNodeButton.addEventListener('click', () => callbacks.onDeleteNode());

    const bgPicker = container.querySelector('#bg-color-picker') as HTMLInputElement | null;
    bgPicker?.addEventListener('input', (e) => {
      const hex = (e.target as HTMLInputElement).value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      callbacks.onBgColorChange(r, g, b, 1.0);
    });

    const themeSelect = container.querySelector('#theme-selector') as HTMLSelectElement | null;
    themeSelect?.addEventListener('change', (e) => {
      callbacks.onThemeChange((e.target as HTMLSelectElement).value as ThemeName);
    });

    canvas.addEventListener('mousedown', (e) => callbacks.onMouseDown(e));
    window.addEventListener('mousemove', (e) => callbacks.onMouseMove(e));
    window.addEventListener('mouseup',   (e) => callbacks.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => callbacks.onWheel(e), { passive: false });
  }

  enableDelete(): void  { this.deleteNodeButton.disabled = false; }
  disableDelete(): void { this.deleteNodeButton.disabled = true;  }
}
