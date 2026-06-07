import { NodeType } from './types.js';

export class AccessibilityTree {
  private listElement: HTMLUListElement;

  constructor() {
    this.listElement = document.getElementById('sr-node-list') as HTMLUListElement;
    if (!this.listElement) {
      console.warn('Screen reader node list not found');
    }
  }

  addNode(id: number, label: string, type: NodeType) {
    if (!this.listElement) return;
    const li = document.createElement('li');
    li.id = `sr-node-${id}`;
    li.textContent = `${type === 'group' ? 'Group' : 'Node'}: ${label}`;
    this.listElement.appendChild(li);
  }

  removeNode(id: number) {
    if (!this.listElement) return;
    const li = document.getElementById(`sr-node-${id}`);
    if (li) {
      li.remove();
    }
  }

  updateLabel(id: number, label: string, type: NodeType) {
    if (!this.listElement) return;
    const li = document.getElementById(`sr-node-${id}`);
    if (li) {
      li.textContent = `${type === 'group' ? 'Group' : 'Node'}: ${label}`;
    }
  }
}
