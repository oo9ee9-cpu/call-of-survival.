// Bark of the valley's green trees: packed map, trunk sway with the wind, distance window per tree (rings).
shader_type spatial;
render_mode cull_back;

uniform sampler2D alb_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D nrh_tex : filter_linear_mipmap_anisotropic, repeat_enable;
uniform vec3 tint : source_color = vec3(1.0);
uniform float sway = 1.0;
uniform float cut_near = -1.0;
uniform float cut_far = 100000.0;
uniform float fade_out = 0.0;
global uniform vec3 view_pos;
global uniform vec4 wind;
global uniform float wetness;
varying float v_cut;

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	float d = distance(o, view_pos);
	v_cut = d;
	if (d > cut_far || d < cut_near) {
		VERTEX = vec3(0.0);
	}
	float k = clamp(VERTEX.y / 18.0, 0.0, 1.2);
	VERTEX.xz += wind.xy * wind.z * sway * k * k * 0.25 * sin(TIME * 0.85 + o.x * 0.13 + o.z * 0.11);
}

void fragment() {
	// the far end of the ring dissolves into the impostor cards (same noise as impostor8)
	if (fade_out > 0.0 && fract(52.9829189 * fract(dot(FRAGCOORD.xy, vec2(0.06711056, 0.00583715)))) < clamp((v_cut - (cut_far - fade_out)) / fade_out, 0.0, 1.0)) {
		discard;
	}
	vec3 a = texture(alb_tex, UV).rgb * tint;
	vec4 n = texture(nrh_tex, UV);
	a *= 1.0 - 0.3 * wetness;
	ALBEDO = a;
	ROUGHNESS = mix(clamp(n.b, 0.3, 1.0), 0.3, wetness * 0.6);
	NORMAL_MAP = vec3(n.rg, 1.0);
	NORMAL_MAP_DEPTH = 1.2;
	AO = mix(0.6, 1.0, n.a);
	AO_LIGHT_AFFECT = 0.3;
}
