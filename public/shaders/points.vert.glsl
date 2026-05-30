// points.vert.glsl
attribute vec2 a_position;
attribute float a_size;
attribute vec3 a_color;

varying vec3 v_color;
varying float v_alpha;

// Slight wave distortion based on turbulence
uniform float u_turbulence;
uniform float u_time;

void main() {
  vec2 pos = a_position;
  
  // Slight wave distortion based on turbulence
  float wave = sin(u_time * 2.0 + pos.x * 3.0) * u_turbulence * 0.02;
  pos.y += wave;
  
  gl_Position = vec4(pos, 0.0, 1.0);
  gl_PointSize = a_size * (1.0 + u_turbulence * 0.5);
  v_color = a_color;
  v_alpha = 0.6 + (1.0 - length(pos)) * 0.4;
}
