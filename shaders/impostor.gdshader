// Far trees: two crossed cards from an atlas of four kinds (INSTANCE_CUSTOM.x = kind).
// Trees closer than near_cut are drawn by the real meshes, so their cards collapse here.
shader_type spatial;
render_mode cull_disabled;

uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_disable;
uniform float near_cut = 200.0;
global uniform vec3 view_pos;

varying float v_shade;

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	float d = distance(o, view_pos);
	if (d < near_cut) {
		VERTEX = vec3(0.0);
	}
	UV.x = (INSTANCE_CUSTOM.x + clamp(UV.x, 0.01, 0.99)) * 0.25;
	v_shade = 0.85 + 0.3 * INSTANCE_CUSTOM.y;
	NORMAL = normalize(mix(NORMAL, vec3(0.0, 1.0, 0.0), 0.6));
}

void fragment() {
	vec4 c = texture(tex, UV);
	ALBEDO = c.rgb * v_shade;
	ALPHA = c.a;
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ROUGHNESS = 0.95;
	SPECULAR = 0.2;
}
