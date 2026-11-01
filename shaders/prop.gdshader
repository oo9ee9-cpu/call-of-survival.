// Generic prop surface with a packed map: R,G normal, B roughness, A height (used as cavity AO).
shader_type spatial;
render_mode cull_back;

uniform sampler2D alb_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D nrh_tex : filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_nrh = true;
uniform vec4 tint : source_color = vec4(1.0);
uniform float metallic = 0.0;
uniform float rough_mul = 1.0;
uniform float rough_add = 0.0;
uniform float uv_scale = 1.0;
uniform float normal_depth = 1.0;
uniform float wet_affect = 1.0;
uniform vec3 emission : source_color = vec3(0.0);
uniform float emission_energy = 0.0;
global uniform float wetness;

void fragment() {
	vec2 uv = UV * uv_scale;
	vec3 a = texture(alb_tex, uv).rgb * tint.rgb * COLOR.rgb;
	vec4 n = has_nrh ? texture(nrh_tex, uv) : vec4(0.5, 0.5, 0.8, 0.6);
	float r = clamp(n.b * rough_mul + rough_add, 0.04, 1.0);
	float wet = wetness * wet_affect;
	a *= 1.0 - 0.3 * wet;
	r = mix(r, 0.18, wet * 0.75);
	ALBEDO = a;
	ROUGHNESS = r;
	METALLIC = metallic;
	if (has_nrh) {
		NORMAL_MAP = vec3(n.rg, 1.0);
		NORMAL_MAP_DEPTH = normal_depth;
	}
	AO = mix(0.65, 1.0, n.a);
	AO_LIGHT_AFFECT = 0.25;
	EMISSION = emission * emission_energy;
}
