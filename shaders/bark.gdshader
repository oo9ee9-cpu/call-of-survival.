// Pine bark that burnt: UV2.x = how charred the vertex is, UV2.y = where the bark fell off (bare grey wood).
shader_type spatial;
render_mode cull_back;

uniform sampler2D bark_alb : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D bark_nrh : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D bare_alb : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D bare_nrh : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float char_amount = 1.0;
uniform float sway = 1.0;
uniform float wet_affect = 1.0;
global uniform float wetness;
uniform float cut_far = 100000.0;
uniform float cut_near = -1.0;
global uniform vec3 view_pos;
global uniform vec4 wind;

varying vec3 v_obj;
varying vec2 v_cb;

void vertex() {
	float dcut = distance(MODEL_MATRIX[3].xyz, view_pos);
	if (dcut > cut_far || dcut < cut_near) {
		VERTEX = vec3(0.0);
	}
	v_obj = VERTEX;
	v_cb = UV2;
	vec3 o = MODEL_MATRIX[3].xyz;
	float k = clamp(VERTEX.y / 20.0, 0.0, 1.2);
	VERTEX.xz += wind.xy * wind.z * sway * k * k * 0.3 * sin(TIME * 0.85 + o.x * 0.13 + o.z * 0.11);
}

void fragment() {
	vec4 n = texture(noise_tex, vec2(v_obj.x + v_obj.z, v_obj.y) * vec2(0.6, 0.18));
	vec4 n2 = texture(noise_tex, vec2(v_obj.x - v_obj.z, v_obj.y) * vec2(2.2, 0.9));
	float charv = smoothstep(0.3, 0.7, v_cb.x * char_amount + (n.g - 0.5) * 0.7 + (n2.r - 0.5) * 0.25);
	float bare = smoothstep(0.42, 0.58, v_cb.y + (n.r - 0.5) * 0.6);
	vec3 a = texture(bark_alb, UV).rgb;
	vec4 nr = texture(bark_nrh, UV);
	vec3 ab = texture(bare_alb, UV).rgb;
	vec4 nb = texture(bare_nrh, UV);
	vec3 alb = mix(a, ab, bare);
	vec4 nn = mix(nr, nb, bare);
	// char: black, cracked, slightly glossy where it is fresh
	vec3 charc = vec3(0.022, 0.02, 0.018) * (0.7 + 0.8 * n2.b) + vec3(0.03, 0.028, 0.026) * nn.a;
	alb = mix(alb, charc, charv);
	float rough = mix(nn.b, 0.5 + 0.35 * n2.a, charv);
	alb *= COLOR.rgb;
	float wet = wetness * wet_affect;
	alb *= 1.0 - 0.3 * wet;
	rough = mix(rough, 0.22, wet * 0.8);
	ALBEDO = alb;
	ROUGHNESS = rough;
	SPECULAR = 0.35;
	NORMAL_MAP = vec3(nn.rg, 1.0);
	NORMAL_MAP_DEPTH = 1.3;
}
