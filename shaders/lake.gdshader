// Lakes and the sea bay: depth from the vertex colour (baked from the terrain under the water), two drifting normal
// maps, a bright sky reflection at grazing angles, rain rings, soft see-through shallows at the shore.
shader_type spatial;
render_mode cull_back, depth_draw_always, specular_schlick_ggx;

uniform sampler2D nmap : hint_normal, filter_linear_mipmap, repeat_enable;
uniform vec3 deep : source_color = vec3(0.025, 0.075, 0.09);
uniform vec3 shallow : source_color = vec3(0.13, 0.2, 0.17);
uniform vec3 sky_col : source_color = vec3(0.62, 0.68, 0.74);
uniform float scale = 0.035;
global uniform float rain;
global uniform vec4 wind;

varying float v_depth;
varying vec3 v_wp;

void vertex() {
	v_depth = COLOR.r * 20.0;
	v_wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = v_wp.xz * scale;
	vec2 drift = wind.xy * TIME * 0.012 * (0.5 + wind.z);
	vec3 n1 = texture(nmap, p + drift).rgb;
	vec3 n2 = texture(nmap, p * 2.3 - drift * 1.7 + vec2(0.31, 0.47)).rgb;
	vec3 nm = normalize(mix(n1, n2, 0.5) * 2.0 - 1.0);
	nm.xy *= 0.6 + rain * 0.8;
	float d = clamp(v_depth / 7.0, 0.0, 1.0);
	vec3 base = mix(shallow, deep, sqrt(d));
	float fres = pow(1.0 - clamp(dot(normalize(VIEW), NORMAL), 0.0, 1.0), 4.0);
	ALBEDO = mix(base, sky_col * 0.55, fres * 0.6);
	NORMAL_MAP = nm * 0.5 + 0.5;
	NORMAL_MAP_DEPTH = 0.8;
	ROUGHNESS = 0.05 + rain * 0.12;
	METALLIC = 0.0;
	SPECULAR = 0.65;
	ALPHA = clamp(0.35 + smoothstep(0.0, 1.2, v_depth) * 0.65, 0.0, 1.0);
}
