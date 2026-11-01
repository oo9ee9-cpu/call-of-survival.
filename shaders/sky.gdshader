// Overcast sky: a soft gradient under a heavy cloud deck from a tiling noise texture.
shader_type sky;

uniform vec3 zenith : source_color = vec3(0.40, 0.43, 0.47);
uniform vec3 horizon : source_color = vec3(0.60, 0.61, 0.62);
uniform vec3 ground : source_color = vec3(0.24, 0.24, 0.23);
uniform vec3 cloud_light : source_color = vec3(0.70, 0.71, 0.72);
uniform vec3 cloud_dark : source_color = vec3(0.36, 0.38, 0.41);
uniform sampler2D clouds : filter_linear_mipmap, repeat_enable;
uniform float cover = 0.85;
uniform float sun_glow = 0.18;
uniform float sun_disc = 0.0;
uniform vec2 cloud_offset = vec2(0.0);
uniform float brightness = 1.0;

void sky() {
	vec3 d = EYEDIR;
	float up = max(d.y, 0.0);
	vec3 col = mix(horizon, zenith, pow(up, 0.55));
	if (d.y > 0.0) {
		vec2 uv = d.xz / (d.y + 0.12) * 0.18 + cloud_offset;
		vec3 c = texture(clouds, uv).rgb;
		vec3 c2 = texture(clouds, uv * 2.7 + 0.31).rgb;
		float body = c.r * 0.75 + c2.r * 0.25;
		float dens = smoothstep(1.0 - cover - 0.15, 1.0 - cover + 0.35, body);
		vec3 cc = mix(cloud_light, cloud_dark, clamp(c.g * 0.8 + (1.0 - body) * 0.5, 0.0, 1.0));
		float fade = smoothstep(0.0, 0.18, d.y);
		col = mix(col, mix(horizon, cc, fade), dens);
	} else {
		col = mix(horizon, ground, smoothstep(0.0, -0.25, d.y));
	}
	float s = max(dot(d, LIGHT0_DIRECTION), 0.0);
	col += LIGHT0_COLOR * min(LIGHT0_ENERGY, 2.0) * (pow(s, 6.0) * sun_glow + pow(s, 400.0) * sun_disc);
	COLOR = col * brightness;
}
