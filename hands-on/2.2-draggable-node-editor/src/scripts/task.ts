import { NodeEditor } from './node-editor.js';

function init(): void {
  const vsSource = document.getElementById('v-shader')?.textContent;
  const fsSource = document.getElementById('f-shader')?.textContent;
  if (!vsSource || !fsSource) throw new Error('Shader source missing from DOM');
  NodeEditor.create('webgl-canvas', '2d-text-canvas', vsSource, fsSource).render();
}

document.addEventListener('DOMContentLoaded', init);
