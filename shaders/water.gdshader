// Muddy standing water: opaque, glossy, slow ripples from the wind, rings when it rains.
shader_type spatial;
render_mode cull_back;

uniform sampler2D nmap : hint_normal, filter_linear_mipmap, repeat_enable;
uniform vec3 color : source_color = vec3(0.055, 0.05, 0.04);
uniform float ripple_scale = 1.0;
global uniform float rain;
global uniform vec4 wind;

varying vec3 v_world;

float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

vec2 drops(vec2 p, float t) {
	vec2 cell = floor(p);
	vec2 f = fract(p) - 0.5;
	float h = hash12(cell);
	float tt = fract(t * 0.9 + h);
	vec2 c = (vec2(hash12(cell + 1.3), hash12(cell + 7.1)) - 0.5) * 0.5;
	vec2 dv = f - c;
	float r = length(dv);
	float wave = sin((r - tt * 0.45) * 55.0) * (1.0 - tt) * (1.0 - smoothstep(0.0, 0.08, abs(r - tt * 0.45)));
	return dv / max(r, 0.001) * wave;
}

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = v_world.xz;
	float ws = 0.3 + wind.z;
	vec3 n1 = texture(nmap, p * 0.09 + TIME * vec2(0.010, 0.006) * ws).rgb * 2.0 - 1.0;
	vec3 n2 = texture(nmap, p * 0.21 - TIME * vec2(0.008, 0.012) * ws).rgb * 2.0 - 1.0;
	vec2 slope = (n1.xy + n2.xy) * 0.06 * ripple_scale;
	if (rain > 0.01) {
		slope += (drops(p * 3.0, TIME) + drops(p * 3.0 + 0.5, TIME + 0.37)) * 0.25 * rain;
	}
	vec3 nw = normalize(vec3(slope.x, 1.0, -slope.y));
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
	ALBEDO = color;
	ROUGHNESS = 0.035 + 0.05 * rain;
	SPECULAR = 0.6;
	METALLIC = 0.0;
}
