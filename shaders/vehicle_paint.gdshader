// Painted armour and track belts: albedo with a packed map (RG normal, B roughness), mud and dust from the vertex
// colour, wet in the rain, a UV scroll for the tracks (scroll = metres the belt has moved), soot when burnt out.
shader_type spatial;
render_mode cull_back;

uniform sampler2D alb_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D nrh_tex : filter_linear_mipmap_anisotropic, repeat_enable;
uniform float uv_scale = 1.0;
uniform float scroll = 0.0;
uniform float metallic = 0.12;
uniform bool double_sided_dark = false;
uniform float soot = 0.0;
global uniform float wetness;

void fragment() {
	vec2 uv = UV * uv_scale + vec2(0.0, scroll);
	vec3 a = texture(alb_tex, uv).rgb * COLOR.rgb;
	vec4 n = texture(nrh_tex, uv);
	float wet = wetness;
	a *= 1.0 - 0.25 * wet;
	a = mix(a, vec3(0.03, 0.028, 0.025), soot);
	ALBEDO = a;
	ROUGHNESS = mix(clamp(n.b, 0.2, 1.0), 0.25, wet * 0.6);
	METALLIC = metallic * (1.0 - soot);
	NORMAL_MAP = vec3(n.rg, 1.0);
	NORMAL_MAP_DEPTH = 1.0;
}
