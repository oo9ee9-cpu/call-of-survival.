// Buildings of the valley: packed maps (RG normal, B roughness, A height), a colour per house for the plaster,
// weathering (grime at the foot of walls, rain streaks), and a distance window so each house draws in exactly one
// level of detail (the window follows the camera through the global view_pos).
shader_type spatial;
render_mode cull_back;

uniform sampler2D alb_tex : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D nrh_tex : filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_nrh = true;
uniform vec4 tint : source_color = vec4(1.0);
uniform bool house_tint = false;          // plaster: take the house's own colour
uniform float metallic = 0.0;
uniform float rough_add = 0.0;
uniform float grime = 1.0;
uniform float wet_affect = 1.0;
uniform vec3 emission : source_color = vec3(0.0);
uniform float emission_energy = 0.0;
uniform float cut_near = -1.0;
uniform float cut_far = 100000.0;
global uniform vec3 view_pos;
global uniform float wetness;

varying float v_h;
varying vec3 v_tint;
varying vec3 v_wp;

void vertex() {
	float d = distance(MODEL_MATRIX[3].xyz, view_pos);
	if (d > cut_far || d < cut_near) {
		VERTEX = vec3(0.0);
	}
	v_h = VERTEX.y;
	v_tint = house_tint ? INSTANCE_CUSTOM.rgb : vec3(1.0);
	v_wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

float hash1(float n) { return fract(sin(n) * 43758.5453); }

void fragment() {
	// (no vertex colour here: in the Compatibility renderer a MultiMesh with custom data but no colours hands the shader
	// garbage in COLOR, and the building meshes carry none anyway)
	vec3 a = texture(alb_tex, UV).rgb * tint.rgb * v_tint;
	vec4 n = has_nrh ? texture(nrh_tex, UV) : vec4(0.5, 0.5, 0.8, 0.6);
	// grime: darker and browner near the ground, faint streaks running down from above
	float foot = 1.0 - smoothstep(0.0, 1.1, v_h);
	float col_id = floor(v_wp.x * 1.7 + v_wp.z * 1.3);
	float streak = smoothstep(0.55, 1.0, hash1(col_id)) * (0.5 + 0.5 * sin(v_wp.y * 0.7 + col_id));
	float g = clamp(foot * 0.45 + streak * 0.12, 0.0, 0.6) * grime;
	a = mix(a, a * vec3(0.55, 0.5, 0.42), g);
	float r = clamp(n.b + rough_add, 0.04, 1.0);
	float wet = wetness * wet_affect;
	a *= 1.0 - 0.28 * wet;
	r = mix(r, 0.2, wet * 0.7);
	ALBEDO = a;
	ROUGHNESS = r;
	METALLIC = metallic;
	if (has_nrh) {
		NORMAL_MAP = vec3(n.rg, 1.0);
		NORMAL_MAP_DEPTH = 1.0;
	}
	AO = mix(0.7, 1.0, n.a);
	AO_LIGHT_AFFECT = 0.2;
	EMISSION = emission * emission_energy;
}
