import { NodeType } from './types.js';

function describeNodeType(type: NodeType): string {
  switch (type) {
    case 'group':
      return 'Group';
    case 'composition':
      return 'Composition';
    case 'composition-child':
      return 'Composition child';
    case 'node':
    default:
      return 'Node';
  }
}

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
    li.textContent = `${describeNodeType(type)}: ${label}`;
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
      li.textContent = `${describeNodeType(type)}: ${label}`;
    }
  }
}
