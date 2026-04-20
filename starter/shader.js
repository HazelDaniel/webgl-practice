function createShader(gl, type, source) {
  let shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  let success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (success) {
    return shader;
  }

  console.log(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
}

let vertexShaderSource = document.querySelector("#vertex-shader-2d").text;
let fragmentShaderSource = document.querySelector("#fragment-shader-2d").text;

let vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
let fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

function run() {
  const canvas = document.getElementById("canvas");
  let gl = canvas.getContext("webgl");
  if (!gl) {
    console.log("no webgl for you!");
    return;
  }
  console.log("we got webgl baby!");
  let program = createProgram(gl, vertexShader, fragmentShader);
  let positionAttributeLocation = gl.getAttribLocation(program, "a_position");

  let positionBuffer = gl.createBuffer();
}

function createProgram(gl, vertexShader, fragmentShader) {
  let program = gl.createProgram();
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  let success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (success) {
    return program;
  }

  console.log(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
}

document.addEventListener("DOMContentLoaded", () => {
  run();
});
