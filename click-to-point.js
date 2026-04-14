function resizeCanvasToDisplaySize(canvas) {
  const displayWidth = canvas.clientWidth;
  const displayHeight = canvas.clientHeight;

  const needResize =
    canvas.width !== displayWidth || canvas.height !== displayHeight;

  if (needResize) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }

  return needResize;
}

function initShaders(gl, FS_SOURCE = "", VS_SOURCE = "") {
  if (!(FS_SOURCE && VS_SOURCE)) {
    console.warn("no FS_SOURCE/VS_SOURCE provided");
    return null;
  }

  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vertexShader, VS_SOURCE);
  gl.compileShader(vertexShader);
  const status = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);

  if (!status) {
    console.error(
      `vertex shader failed to compile. reason: ${gl.getShaderInfoLog(
        vertexShader
      )}`
    );
    gl.deleteShader(vertexShader);
    return null;
  }

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fragmentShader, FS_SOURCE);
  gl.compileShader(fragmentShader);
  const status2 = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);

  if (!status2) {
    console.error(
      `fragment shader failed to compile. reason: ${gl.getShaderInfoLog(
        fragmentShader
      )}`
    );
    gl.deleteShader(fragmentShader);
    return null;
  }
  const program = gl.createProgram();

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.useProgram(program);

  const status3 = gl.getProgramParameter(program, gl.LINK_STATUS);

  if (!status3) {
    console.error(
      `fragment shader failed to compile. reason: ${gl.getShaderInfoLog(
        fragmentShader
      )}`
    );
    return null;
  }

  return program;
}

function run() {
  const canvas = document.getElementById("canvas");
  const gl = canvas.getContext("webgl");
  const vertexShaderSource =
    document.getElementById("vertex-shader")?.textContent;
  const fragmentShaderSource =
    document.getElementById("fragment-shader")?.textContent;

  if (!gl) {
    console.warn("your browser doesn't support webgl");
    return;
  }

  const program = initShaders(gl, fragmentShaderSource, vertexShaderSource);
  const aPositionLocation = gl.getAttribLocation(program, "a_position");

  const positionHistory = [];

  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  resizeCanvasToDisplaySize(canvas);
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT);
  
  canvas.addEventListener("mousedown", function (event) {
    let x = event.clientX;
    let y = event.clientY;
    const rect = event.target.getBoundingClientRect();
    
    x = ((x - rect.left) - (canvas.width/2)) / (canvas.width / 2);
    y = (((y - rect.top) - (canvas.height/2)) * -1) / (canvas.height / 2);
    positionHistory.push(x);
    positionHistory.push(y);
    gl.clear(gl.COLOR_BUFFER_BIT);

    for (let ii = 0; ii < positionHistory.length; ii += 2) {
      gl.vertexAttrib3f(
        aPositionLocation,
        positionHistory[ii],
        positionHistory[ii + 1],
        0.0
      );
      gl.drawArrays(gl.POINTS, 0, 1.0);
    }
  });

  console.log("shaders running smoothly");
}

document.addEventListener("DOMContentLoaded", () => {
  run();
});
