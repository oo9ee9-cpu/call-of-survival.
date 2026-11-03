// Alpha-tested cards: twigs, needle clumps, dead bushes, barbed wire.
shader_type spatial;
render_mode cull_disabled;

uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform float alpha_cut = 0.45;
uniform vec3 tint : source_color = vec3(1.0);
uniform float sway = 1.0;
uniform float flutter = 1.0;
uniform float translucency = 0.2;
uniform float roughness = 0.85;
uniform float metallic = 0.0;
uniform bool wire_mode = false;
uniform float wet_affect = 1.0;
uniform float cut_far = 100000.0;
uniform float cut_near = -1.0;
uniform float fade_in = 0.0;
uniform float fade_out = 0.0;
global uniform vec3 view_pos;
global uniform vec4 wind;
global uniform float wetness;
varying float v_cut;

void vertex() {
	float dcut = distance(MODEL_MATRIX[3].xyz, view_pos);
	v_cut = dcut;
	if (dcut > cut_far || dcut < cut_near) {
		VERTEX = vec3(0.0);
	}
	vec3 o = MODEL_MATRIX[3].xyz;
	float k = clamp(VERTEX.y / 20.0, 0.0, 1.2);
	vec2 sw = wind.xy * wind.z * sway * k * k * 0.3 * sin(TIME * 0.85 + o.x * 0.13 + o.z * 0.11);
	float fl = UV2.x * flutter * wind.z * 0.05 * sin(TIME * 3.1 + VERTEX.y * 1.7 + VERTEX.x * 2.3 + o.x);
	VERTEX.xz += sw + vec2(fl, fl * 0.6);
	VERTEX.y += fl * 0.5;
	if (wire_mode) {
		UV.x *= length(MODEL_MATRIX[0].xyz) * 2.0;
	}
}

float ign(vec2 p) {
	return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void fragment() {
	// dissolve in step with the next ring of detail (same noise, complementary test)
	if (fade_in > 0.0 && ign(FRAGCOORD.xy) >= clamp((v_cut - cut_near) / fade_in, 0.0, 1.0)) {
		discard;
	}
	if (fade_out > 0.0 && ign(FRAGCOORD.xy) < clamp((v_cut - (cut_far - fade_out)) / fade_out, 0.0, 1.0)) {
		discard;
	}
	vec4 c = texture(tex, UV, -0.5);
	vec3 a = c.rgb * tint * COLOR.rgb;
	float al = (c.a - alpha_cut) / max(fwidth(c.a), 0.0001) + 0.5;
	a *= 1.0 - 0.25 * wetness * wet_affect;
	ALBEDO = a;
	ALPHA = clamp(al, 0.0, 1.0);
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ROUGHNESS = mix(roughness, 0.3, wetness * wet_affect * 0.6);
	METALLIC = metallic;
	SPECULAR = 0.3;
	BACKLIGHT = a * translucency;
	if (!FRONT_FACING) {
		NORMAL = -NORMAL;
	}
}
