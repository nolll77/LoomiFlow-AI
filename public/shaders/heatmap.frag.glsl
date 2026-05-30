// heatmap.frag.glsl
precision mediump float;

varying vec3 v_color;
varying float v_alpha;

uniform float u_redTint;
uniform float u_time;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  
  if (dist > 0.5) discard;
  
  float alpha = (1.0 - dist * 2.0) * v_alpha;
  
  // Red tint for fraud spike
  vec3 tintedColor = mix(v_color, vec3(1.0, 0.23, 0.23), u_redTint * 0.6);
  
  gl_FragColor = vec4(tintedColor, alpha);
}
