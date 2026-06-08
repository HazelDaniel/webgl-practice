import { ThemeName } from "./types.js";

/** All interaction events the NodeEditor handles, expressed as plain callbacks. */
export interface ControlCallbacks {
  onAddNode(): void;
  onAddGroup(): void;
  onAddComposition(): void;
  onToggleMultiSelect(): void;
  onUndo(): void;
  onRedo(): void;
  onDeleteNode(): void;
  onBgColorChange(r: number, g: number, b: number, a: number): void;
  onThemeChange(theme: ThemeName): void;
  onLabelChange(newLabel: string): void;
  onLabelCommit(): void;
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
  private addCompositionButton: HTMLButtonElement;
  private multiSelectButton: HTMLButtonElement;
  private undoButton: HTMLButtonElement;
  private redoButton: HTMLButtonElement;
  private deleteNodeButton: HTMLButtonElement;

  private sidebar: HTMLElement;
  private sidebarToggle: HTMLButtonElement;
  private nodeProperties: HTMLElement;
  private nodeLabelInput: HTMLInputElement;

  constructor(
    canvas: HTMLCanvasElement,
    container: HTMLElement,
    historyPane: HTMLElement,
    toolPane: HTMLElement,
    callbacks: ControlCallbacks
  ) {
    this.sidebar = container;
    this.addNodeButton = toolPane.querySelector(
      "#btn-add-node"
    )! as HTMLButtonElement;
    this.addGroupButton = toolPane.querySelector(
      "#btn-add-group"
    )! as HTMLButtonElement;
    this.addCompositionButton = toolPane.querySelector(
      "#btn-add-composition"
    )! as HTMLButtonElement;
    this.multiSelectButton = toolPane.querySelector(
      "#btn-multi-select"
    )! as HTMLButtonElement;
    this.undoButton = historyPane.querySelector(
      "#btn-undo"
    )! as HTMLButtonElement;
    this.redoButton = historyPane.querySelector(
      "#btn-redo"
    )! as HTMLButtonElement;
    this.deleteNodeButton = toolPane.querySelector(
      "#btn-delete-node"
    )! as HTMLButtonElement;
    this.sidebarToggle = container.querySelector(
      "#sidebar-toggle"
    )! as HTMLButtonElement;
    this.nodeProperties = container.querySelector(
      "#node-properties"
    )! as HTMLDivElement;
    this.nodeLabelInput = container.querySelector(
      "#node-label-input"
    )! as HTMLInputElement;

    this.addNodeButton.addEventListener("click", () => callbacks.onAddNode());
    this.addGroupButton.addEventListener("click", () => callbacks.onAddGroup());
    this.addCompositionButton.addEventListener("click", () =>
      callbacks.onAddComposition()
    );
    this.multiSelectButton.addEventListener("click", () =>
      callbacks.onToggleMultiSelect()
    );
    this.undoButton.addEventListener("click", () => callbacks.onUndo());
    this.redoButton.addEventListener("click", () => callbacks.onRedo());
    this.deleteNodeButton.addEventListener("click", () =>
      callbacks.onDeleteNode()
    );

    const bgPicker = document.querySelector(
      "#bg-color-picker"
    ) as HTMLInputElement | null;
    bgPicker?.addEventListener("input", (e) => {
      const hex = (e.target as HTMLInputElement).value;
      const r = parseInt(hex.slice(1, 3), 16) / 255;
      const g = parseInt(hex.slice(3, 5), 16) / 255;
      const b = parseInt(hex.slice(5, 7), 16) / 255;
      callbacks.onBgColorChange(r, g, b, 1.0);
    });

    const themeSelect = document.querySelector(
      "#theme-selector"
    ) as HTMLSelectElement | null;
    themeSelect?.addEventListener("change", (e) => {
      callbacks.onThemeChange(
        (e.target as HTMLSelectElement).value as ThemeName
      );
    });

    this.sidebarToggle.addEventListener("click", () => {
      this.sidebar.classList.toggle("collapsed");
    });

    this.nodeLabelInput.addEventListener("input", (e) => {
      callbacks.onLabelChange((e.target as HTMLInputElement).value);
    });
    this.nodeLabelInput.addEventListener("blur", () =>
      callbacks.onLabelCommit()
    );
    this.nodeLabelInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.nodeLabelInput.blur();
      }
    });

    canvas.addEventListener("mousedown", (e) => callbacks.onMouseDown(e));
    window.addEventListener("mousemove", (e) => callbacks.onMouseMove(e));
    window.addEventListener("mouseup", (e) => callbacks.onMouseUp(e));
    canvas.addEventListener("wheel", (e) => callbacks.onWheel(e), {
      passive: false,
    });
  }

  enableDelete(): void {
    this.deleteNodeButton.disabled = false;
  }
  disableDelete(): void {
    this.deleteNodeButton.disabled = true;
  }
  enableAddComposition(): void {
    this.addCompositionButton.disabled = false;
  }
  disableAddComposition(): void {
    this.addCompositionButton.disabled = true;
  }
  setMultiSelectActive(active: boolean): void {
    this.multiSelectButton.classList.toggle("active", active);
  }
  enableUndo(): void {
    this.undoButton.disabled = false;
  }
  disableUndo(): void {
    this.undoButton.disabled = true;
  }
  enableRedo(): void {
    this.redoButton.disabled = false;
  }
  disableRedo(): void {
    this.redoButton.disabled = true;
  }

  showProperties(label: string): void {
    this.nodeProperties.style.display = "flex";
    this.nodeLabelInput.value = label;
    this.sidebar.classList.remove("collapsed");
  }

  hideProperties(): void {
    this.nodeProperties.style.display = "none";
  }
}
