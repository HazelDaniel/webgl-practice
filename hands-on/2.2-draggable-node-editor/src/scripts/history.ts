export interface HistoryEntry {
  undo(): void;
  redo(): void;
}

/**
 * Minimal undo/redo stack for editor actions.
 *
 * The caller is responsible for applying the action before pushing it onto
 * the stack. Undo and redo simply replay the captured closures.
 */
export class HistoryStack {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  push(entry: HistoryEntry): void {
    this.undoStack.push(entry);
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(): boolean {
    const entry = this.undoStack.pop();
    if (!entry) return false;

    entry.undo();
    this.redoStack.push(entry);
    return true;
  }

  redo(): boolean {
    const entry = this.redoStack.pop();
    if (!entry) return false;

    entry.redo();
    this.undoStack.push(entry);
    return true;
  }
}
