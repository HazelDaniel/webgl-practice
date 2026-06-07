import { ThemeName } from './types.js';

/** All interaction events the NodeEditor handles, expressed as plain callbacks. */
export interface ControlCallbacks {
  onAddNode(): void;
  onAddGroup(): void;
  onDeleteNode(): void;
  onBgColorChange(r: number, g: number, b: number, a: number): void;
  onThemeChange(theme: ThemeName): void;
  onLabelChange(newLabel: string): void;
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
  private addGroupButton: HTMLButtonElement;
  private deleteNodeButton: HTMLButtonElement;
  
  private sidebar: HTMLElement;
  private sidebarToggle: HTMLButtonElement;
  private nodeProperties: HTMLElement;
  private nodeLabelInput: HTMLInputElement;

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLElement, // This is now likely document.body or a higher container, we should query globally or from container if it wraps everything. Actually container passed is #controls-container, which we changed to #sidebar. Let's just query from document or update NodeEditor to pass the sidebar element. We can query within document for safety.
    callbacks: ControlCallbacks
  ) {
    this.addNodeButton    = document.querySelector('#btn-add-node')!    as HTMLButtonElement;
    this.addGroupButton   = document.querySelector('#btn-add-group')!   as HTMLButtonElement;
    this.deleteNodeButton = document.querySelector('#btn-delete-node')! as HTMLButtonElement;
    
    this.sidebar = document.querySelector('#sidebar')! as HTMLElement;
    this.sidebarToggle = document.querySelector('#sidebar-toggle')! as HTMLButtonElement;
    this.nodeProperties = document.querySelector('#node-properties')! as HTMLElement;
    this.nodeLabelInput = document.querySelector('#node-label-input')! as HTMLInputElement;

    this.addNodeButton.addEventListener('click', () => callbacks.onAddNode());
    this.addGroupButton.addEventListener('click', () => callbacks.onAddGroup());
    this.deleteNodeButton.addEventListener('click', () => callbacks.onDeleteNode());

    const bgPicker = document.querySelector('#bg-color-picker') as HTMLInputElement | null;
    bgPicker?.addEventListener('input', (e) => {
      const hex = (e.target as HTMLInputElement).value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      callbacks.onBgColorChange(r, g, b, 1.0);
    });

    const themeSelect = document.querySelector('#theme-selector') as HTMLSelectElement | null;
    themeSelect?.addEventListener('change', (e) => {
      callbacks.onThemeChange((e.target as HTMLSelectElement).value as ThemeName);
    });

    this.sidebarToggle.addEventListener('click', () => {
      this.sidebar.classList.toggle('collapsed');
    });

    this.nodeLabelInput.addEventListener('input', (e) => {
      callbacks.onLabelChange((e.target as HTMLInputElement).value);
    });

    canvas.addEventListener('mousedown', (e) => callbacks.onMouseDown(e));
    window.addEventListener('mousemove', (e) => callbacks.onMouseMove(e));
    window.addEventListener('mouseup',   (e) => callbacks.onMouseUp(e));
    canvas.addEventListener('wheel', (e) => callbacks.onWheel(e), { passive: false });
  }

  enableDelete(): void  { this.deleteNodeButton.disabled = false; }
  disableDelete(): void { this.deleteNodeButton.disabled = true;  }

  showProperties(label: string): void {
    this.nodeProperties.style.display = 'flex';
    this.nodeLabelInput.value = label;
    this.sidebar.classList.remove('collapsed');
  }

  hideProperties(): void {
    this.nodeProperties.style.display = 'none';
  }
}
