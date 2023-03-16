import type { SketchPlugin } from '../plugins/interface';

const glsl = String.raw;

export default function writeScreen<CanvasState, UserConfig>(
  data: {
    ctx: CanvasRenderingContext2D | null;
    gl: WebGLRenderingContext | null;
    width: number;
    height: number;
    sketchConfig: {
      plugins: SketchPlugin<CanvasState, UserConfig>[];
    };
  },
  cb: (ctx: CanvasRenderingContext2D) => void
) {
  for (const plugin of data.sketchConfig.plugins) {
    if (plugin.onWriteScreen) {
      const hasWritten = plugin.onWriteScreen(cb);
      if (hasWritten) return;
    }
  }

  if (data.ctx) {
    cb(data.ctx);
  } else if (data.gl) {
    const gl = data.gl;

    const vertexShaderSource = glsl`
        attribute vec4 aLoadingPosition;
        void main() {
          gl_Position = aLoadingPosition;
        }
      `;
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) throw new Error('???');
    gl.shaderSource(vertexShader, vertexShaderSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error(
        `An error occurred compiling the vertex shader: ${gl.getShaderInfoLog(
          vertexShader
        )}`
      );
      gl.deleteShader(vertexShader);
    }

    const fragmentShaderSource = glsl`
        precision mediump float;
        uniform vec2 uLoadingResolution;
        uniform sampler2D uLoadingTexture;

        void main() {
          vec2 uv = gl_FragCoord.xy / uLoadingResolution;
          gl_FragColor = texture2D(uLoadingTexture, uv);
        }
      `;
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!fragmentShader) throw new Error('???');
    gl.shaderSource(fragmentShader, fragmentShaderSource);
    gl.compileShader(fragmentShader);
    if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
      console.error(
        `An error occurred compiling the vertex shader: ${gl.getShaderInfoLog(
          fragmentShader
        )}`
      );
      gl.deleteShader(fragmentShader);
    }

    const program = gl.createProgram();
    if (!program) throw new Error('???');
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(
        `Unable to initialize the shader program: ${gl.getProgramInfoLog(
          program
        )}`
      );
    }

    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) throw new Error('???');
    ctx.canvas.width = data.width;
    ctx.canvas.height = data.height;
    cb(ctx);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.activeTexture(gl.TEXTURE0);
    const loadingTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, loadingTexture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      ctx.canvas
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    const textureLocation = gl.getUniformLocation(program, 'uLoadingTexture');
    gl.uniform1i(textureLocation, 0);

    const resolutionLocation = gl.getUniformLocation(
      program,
      'uLoadingResolution'
    );
    gl.uniform2f(resolutionLocation, data.width, data.height);

    const positionLoc = gl.getAttribLocation(program, 'aLoadingPosition');
    gl.enableVertexAttribArray(positionLoc);
    const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // I think it's okay to delete straight away?
    gl.deleteShader(fragmentShader);
    gl.deleteShader(vertexShader);
    gl.deleteBuffer(positionBuffer);
    gl.deleteTexture(loadingTexture);
    gl.deleteProgram(program);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  } else {
    throw new Error('writing to screen not supported for this type yet');
  }
}
