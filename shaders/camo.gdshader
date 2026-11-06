shader_type spatial;
render_mode cull_back, depth_draw_opaque, diffuse_burley, specular_schlick_ggx;
// The soldier's uniform: camouflage printed in the body's rest space (UV = x, y; UV2.x = z), so it runs over the
// seams of the mesh like real cloth; the vertex colour marks the parts (r boots, g gloves, a trousers), UV2.y the
// padded joints. Four colours make the pattern (a palette per uniform), a fine weave close up, wear on the knees.

uniform vec3 c_base : source_color = vec3(0.47, 0.44, 0.33);
uniform vec3 c_a : source_color = vec3(0.35, 0.33, 0.22);
uniform vec3 c_b : source_color = vec3(0.58, 0.52, 0.38);
uniform vec3 c_dark : source_color = vec3(0.24, 0.21, 0.15);
uniform vec3 c_glove : source_color = vec3(0.17, 0.16, 0.14);
uniform vec3 c_boot : source_color = vec3(0.30, 0.23, 0.16);
uniform float scale = 6.5;          // blots per metre
uniform float seed = 0.0;           // shifts the pattern from soldier to soldier
uniform float trousers_shade = 0.94;

varying vec3 rp;
varying vec4 part;
varying float pad;

float h3(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.11, 0.17, 0.13));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float n3(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(h3(i), h3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(h3(i + vec3(0.0, 1.0, 0.0)), h3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
		mix(mix(h3(i + vec3(0.0, 0.0, 1.0)), h3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(h3(i + vec3(0.0, 1.0, 1.0)), h3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
	return n3(p) * 0.55 + n3(p * 2.13 + 3.1) * 0.3 + n3(p * 4.37 + 7.7) * 0.15;
}

void vertex() {
	rp = vec3(UV.x, UV.y, UV2.x);
	pad = UV2.y;
	part = COLOR;
}

void fragment() {
	vec3 p = rp * scale + vec3(seed * 3.7, seed * 1.3, seed * 2.9);
	float a = fbm(p);
	float b = fbm(p * 1.31 + vec3(5.2, 1.3, 8.1));
	float c = fbm(p * 2.2 + vec3(2.7, 9.4, 4.4));
	vec3 col = c_base;
	float ma = smoothstep(0.50, 0.535, a);
	col = mix(col, c_a, ma);
	col = mix(col, c_b, smoothstep(0.555, 0.59, b) * (1.0 - ma));
	col = mix(col, c_dark, smoothstep(0.635, 0.665, c));
	// close up: the weave of the cloth and a little dirt; far away they would only shimmer
	float near = 1.0 - smoothstep(2.5, 7.0, length(VERTEX));
	float weave = n3(rp * 650.0);
	col *= 1.0 + (weave - 0.5) * 0.16 * near;
	float dirt = n3(rp * 18.0 + 4.0);
	col *= 1.0 - 0.12 * smoothstep(0.55, 0.85, dirt) * (1.0 - rp.y * 0.5);
	col *= mix(1.0, trousers_shade, part.a);
	col *= mix(1.0, 0.8, pad);
	col = mix(col, c_glove, clamp(part.g, 0.0, 1.0));
	col = mix(col, c_boot * (0.85 + 0.3 * n3(rp * 40.0)), clamp(part.r, 0.0, 1.0));
	ALBEDO = col;
	ROUGHNESS = mix(mix(0.93, 0.8, pad), 0.5, part.r);
	SPECULAR = 0.25;
}
