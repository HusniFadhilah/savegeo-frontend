/**
 * Small, legal browser-side visual enhancer. It is deliberately a shader
 * rather than a downloaded foundation model: no imagery leaves the browser,
 * and no synthetic detail is presented as native resolution.
 */
export type ShaderQuality = "low" | "medium" | "high";

export interface GpuEnhancer {
  enhance(source: HTMLImageElement, target: HTMLCanvasElement, quality: ShaderQuality): boolean;
  dispose(): void;
}

const vertex = `#version 300 es\n in vec2 a_position; out vec2 v_uv; void main(){v_uv=(a_position+1.0)*0.5; gl_Position=vec4(a_position,0.0,1.0);}`;
const fragment = `#version 300 es
precision highp float; uniform sampler2D u_image; uniform vec2 u_texel; uniform float u_strength;
in vec2 v_uv; out vec4 outColor;
void main(){ vec4 c=texture(u_image,v_uv); vec3 n=texture(u_image,v_uv+vec2(0.0,-u_texel.y)).rgb; vec3 s=texture(u_image,v_uv+vec2(0.0,u_texel.y)).rgb; vec3 e=texture(u_image,v_uv+vec2(-u_texel.x,0.0)).rgb; vec3 w=texture(u_image,v_uv+vec2(u_texel.x,0.0)).rgb; vec3 edge=c.rgb-(n+s+e+w)*0.25; outColor=vec4(clamp(c.rgb+edge*u_strength,0.0,1.0),c.a);}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("WebGL shader unavailable");
  gl.shaderSource(shader, source); gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { const message = gl.getShaderInfoLog(shader) ?? "compile error"; gl.deleteShader(shader); throw new Error(message); }
  return shader;
}

export function createGpuEnhancer(canvas: HTMLCanvasElement): GpuEnhancer | null {
  const gl = canvas.getContext("webgl2", { premultipliedAlpha: false, preserveDrawingBuffer: true });
  if (!gl) return null;
  try {
    const program = gl.createProgram(); if (!program) return null;
    const vs = compile(gl, gl.VERTEX_SHADER, vertex); const fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
    gl.attachShader(program, vs); gl.attachShader(program, fs); gl.linkProgram(program);
    gl.deleteShader(vs); gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error("WebGL program unavailable");
    const buffer = gl.createBuffer(); const texture = gl.createTexture(); if (!buffer || !texture) throw new Error("WebGL resources unavailable");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
    gl.useProgram(program); const position = gl.getAttribLocation(program, "a_position"); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    return { enhance(source, target, quality) {
      target.width = source.naturalWidth || source.width; target.height = source.naturalHeight || source.height;
      gl.bindTexture(gl.TEXTURE_2D, texture); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.viewport(0, 0, target.width, target.height); gl.useProgram(program); gl.uniform1i(gl.getUniformLocation(program, "u_image"), 0); gl.uniform2f(gl.getUniformLocation(program, "u_texel"), 1 / target.width, 1 / target.height); gl.uniform1f(gl.getUniformLocation(program, "u_strength"), quality === "high" ? 0.9 : quality === "medium" ? 0.55 : 0.25); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); return true;
    }, dispose() { gl.deleteTexture(texture); gl.deleteBuffer(buffer); gl.deleteProgram(program); gl.getExtension("WEBGL_lose_context")?.loseContext(); } };
  } catch { return null; }
}
