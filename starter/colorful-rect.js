document.addEventListener("DOMContentLoaded", run);
function resizeCanvasToDisplaySize(canvas) {
    const displayWidth = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;
    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
    }
}
function initShaders(gl, vertexShaderSource, fragmentShaderSource) {
    if (!vertexShaderSource || !fragmentShaderSource) {
        console.error("Invalid shader source");
        return false;
    }
    let success = false;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) {
        console.error("Failed to create shader");
        return false;
    }
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    success = gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS);
    if (!success) {
        console.error("Failed to compile vertex shader: " + gl.getShaderInfoLog(vertexShader));
        gl.deleteShader(vertexShader);
        return false;
    }
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    success = gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS);
    if (!success) {
        console.error("Failed to compile fragment shader: " +
            gl.getShaderInfoLog(fragmentShader));
        gl.deleteShader(fragmentShader);
        return false;
    }
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (!success) {
        console.error("Failed to link program: " + gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return false;
    }
    gl.useProgram(program);
    //@ts-ignore
    gl.program = program;
    return true;
}
function initVerticesBuffer(gl, componentPerVertex, componentStride) {
    //prettier-ignore
    const vertices = new Float32Array([
        0.0, 0.5, 1.0, 0.0, 0.0, 1.0,
        -0.5, 0.5, 0.0, 0.0, 1.0, 1.0,
        -0.5, -0.5, 0.0, 1.0, 1.0, 1.0,
        -0.5, -0.5, 0.0, 0.0, 1.0, 1.0,
        0.0, -0.5, 1.0, 1.0, 0.0, 1.0,
        0.0, 0.5, 1.0, 0.0, 1.0, 1.0,
    ]);
    const buffer = gl.createBuffer();
    if (!componentPerVertex) {
        console.error("Invalid number of components per vertex");
        return -1;
    }
    if (!buffer) {
        console.error("Failed to create the buffer object");
        return -1;
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
    return vertices.length / (componentPerVertex + componentStride);
}
function runTriangleRender(canvas, gl) {
    const componentPerVertex = 2;
    const componentStride = 4;
    const n = initVerticesBuffer(gl, componentPerVertex, componentStride);
    if (n < 1)
        return false;
    resizeCanvasToDisplaySize(canvas);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const a_position = gl.getAttribLocation(gl.program, "a_position");
    const a_color = gl.getAttribLocation(gl.program, "a_color");
    const u_Dim = gl.getUniformLocation(gl.program, "u_Dim");
    if (a_position < 0) {
        console.error("Failed to get the storage location of a_position");
        return false;
    }
    if (!u_Dim) {
        console.error("Failed to get the storage location of u_Dim");
        return false;
    }
    gl.vertexAttribPointer(a_position, componentPerVertex, gl.FLOAT, false, (componentPerVertex + componentStride) * Float32Array.BYTES_PER_ELEMENT, 0);
    gl.vertexAttribPointer(a_color, componentStride, gl.FLOAT, false, (componentPerVertex + componentStride) * Float32Array.BYTES_PER_ELEMENT, componentPerVertex * Float32Array.BYTES_PER_ELEMENT);
    gl.enableVertexAttribArray(a_position);
    gl.enableVertexAttribArray(a_color);
    gl.uniform2f(u_Dim, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, n);
    return true;
}
function run() {
    const canvas = document.getElementById("webgl-canvas");
    const gl = canvas.getContext("webgl");
    const fragmentShaderSource = document.getElementById("fragment-source").textContent ?? "";
    const vertexShaderSource = document.getElementById("vertex-source").textContent ?? "";
    let renderStatus = false;
    //prettier-ignore
    if (!gl) {
        console.error("your web browser does not support webgl");
        return;
    }
    const shaderInitSuccess = initShaders(gl, vertexShaderSource, fragmentShaderSource);
    if (!shaderInitSuccess)
        return;
    renderStatus = runTriangleRender(canvas, gl);
    if (!renderStatus)
        return;
}
export {};
//# sourceMappingURL=001_textures.js.map