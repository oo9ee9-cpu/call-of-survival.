// Chest camera look: wide-lens barrel distortion, colour fringes towards the edges, a short smear when the camera
// turns fast, a cold muted grade, vignette and sensor noise that grows in the dark.
shader_type canvas_item;

uniform sampler2D screen : hint_screen_texture, filter_linear, repeat_disable;
uniform float strength = 1.0;
uniform float barrel = 0.2;
uniform float ca = 0.0032;
uniform float vignette = 0.6;
uniform float grain = 0.05;
uniform vec2 smear = vec2(0.0);
uniform float exposure = 1.0;
uniform float saturation = 0.82;
uniform float contrast = 1.05;
uniform vec3 shadow_tint : source_color = vec3(0.92, 0.97, 1.05);
uniform vec3 light_tint : source_color = vec3(1.04, 1.0, 0.95);
uniform float flash = 0.0;
uniform float time_s = 0.0;

float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

void fragment() {
	vec2 uv = SCREEN_UV;
	vec2 c = uv - 0.5;
	float aspect = SCREEN_PIXEL_SIZE.y / SCREEN_PIXEL_SIZE.x;
	vec2 ca_ = vec2(c.x * aspect, c.y);
	float r2 = dot(ca_, ca_) / (0.25 * aspect * aspect + 0.25);
	float k = barrel * strength;
	vec2 duv = c * (1.0 + k * r2) / (1.0 + k * 0.75);
	vec2 u = 0.5 + duv;
	vec2 off = c * ca * strength * (0.1 + 1.6 * r2 * r2);
	vec3 col;
	if (dot(smear, smear) > 1e-7) {
		col = vec3(0.0);
		for (int i = 0; i < 5; i++) {
			float t = float(i) / 4.0 - 0.5;
			vec2 su = u + smear * t;
			col.r += texture(screen, su + off).r;
			col.g += texture(screen, su).g;
			col.b += texture(screen, su - off).b;
		}
		col *= 0.2;
	} else {
		col.r = texture(screen, u + off).r;
		col.g = texture(screen, u).g;
		col.b = texture(screen, u - off).b;
	}
	col *= exposure;
	float l = dot(col, vec3(0.299, 0.587, 0.114));
	col = mix(vec3(l), col, mix(1.0, saturation, strength));
	col = (col - 0.5) * mix(1.0, contrast, strength) + 0.5;
	col *= mix(shadow_tint, light_tint, smoothstep(0.1, 0.7, l));
	float vg = 1.0 - smoothstep(0.35, 1.05, length(c * vec2(1.25, 1.0)) * 1.25);
	col *= mix(1.0, vg, vignette * strength);
	float g = hash12(FRAGCOORD.xy + fract(time_s * 7.31) * 517.0) - 0.5;
	col += g * grain * strength * (0.45 + 1.1 * (1.0 - smoothstep(0.0, 0.5, l)));
	col += vec3(1.0, 0.85, 0.6) * flash;
	COLOR = vec4(max(col, vec3(0.0)), 1.0);
}
