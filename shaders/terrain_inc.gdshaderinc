// Shared by the clipmap terrain, the ground-cover cards and static ground meshes.
// Heights: two float textures read with texelFetch + manual bilinear (exactly what the game's CPU side does).
uniform sampler2D base_h : filter_nearest, repeat_disable;
uniform sampler2D war_h : filter_nearest, repeat_disable;
uniform vec4 base_rect = vec4(-1536.0, -1536.0, 0.5, 1536.0);   // x0, z0, 1/spacing, last texel index
uniform vec4 war_rect = vec4(-256.0, -256.0, 4.0, 2048.0);
uniform vec4 splat_rects = vec4(-1536.0, 3072.0, -256.0, 512.0);   // base x0 (= z0), base size, war x0, war size

// ground layers: 0 needles 1 litter 2 dry grass 3 soil 4 mud 5 ash 6 clay (walls) 7 gravel
uniform sampler2DArray t_alb : filter_linear_mipmap_anisotropic, repeat_enable;   // sRGB data, converted below
uniform sampler2DArray t_nrh : filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D splat_ba : filter_linear_mipmap, repeat_disable;
uniform sampler2D splat_bb : filter_linear_mipmap, repeat_disable;
uniform sampler2D splat_wa : filter_linear_mipmap, repeat_disable;
uniform sampler2D splat_wb : filter_linear_mipmap, repeat_disable;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float tex_scale = 0.42;
uniform float detail_fade = 140.0;
uniform float albedo_gain = 1.75;
global uniform float wetness;
global uniform float rain;

vec3 to_linear(vec3 c) {
	return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878);
}

float fetch_h(sampler2D t, vec2 p, float nmax) {
	p = clamp(p, vec2(0.0), vec2(nmax - 0.0005));
	vec2 f = floor(p);
	vec2 fr = p - f;
	ivec2 i = ivec2(f);
	float h00 = texelFetch(t, i, 0).r;
	float h10 = texelFetch(t, i + ivec2(1, 0), 0).r;
	float h01 = texelFetch(t, i + ivec2(0, 1), 0).r;
	float h11 = texelFetch(t, i + ivec2(1, 1), 0).r;
	return mix(mix(h00, h10, fr.x), mix(h01, h11, fr.x), fr.y);
}

float base_height(vec2 xz) {
	return fetch_h(base_h, (xz - base_rect.xy) * base_rect.z, base_rect.w);
}

bool in_war(vec2 xz) {
	vec2 p = (xz - war_rect.xy) * war_rect.z;
	return p.x >= 0.0 && p.y >= 0.0 && p.x <= war_rect.w && p.y <= war_rect.w;
}

float terrain_height(vec2 xz) {
	vec2 p = (xz - war_rect.xy) * war_rect.z;
	if (p.x >= 0.0 && p.y >= 0.0 && p.x <= war_rect.w && p.y <= war_rect.w) {
		return fetch_h(war_h, p, war_rect.w);
	}
	return base_height(xz);
}

// depth below the untouched ground (trenches, pits, craters' dug part) - 0 outside the war area
float dig_depth(vec2 xz, float h) {
	if (in_war(xz)) {
		return max(base_height(xz) - h, 0.0);
	}
	return 0.0;
}

void splat_weights(vec2 xz, out vec4 wa, out vec4 wb) {
	vec2 pw = (xz - splat_rects.z) / splat_rects.w;
	if (pw.x > 0.0 && pw.y > 0.0 && pw.x < 1.0 && pw.y < 1.0) {
		wa = texture(splat_wa, pw);
		wb = texture(splat_wb, pw);
	} else {
		vec2 pb = (xz - splat_rects.x) / splat_rects.y;
		wa = texture(splat_ba, pb);
		wb = texture(splat_bb, pb);
	}
}

// full ground material at a world point; nw = geometric world normal
void terrain_material(vec3 wp, vec3 nw, float dig, float dist, out vec3 albedo, out float rough, out vec3 n_out, out float ao) {
	vec4 wa;
	vec4 wb;
	splat_weights(wp.xz, wa, wb);
	vec4 mac = texture(noise_tex, wp.xz * 0.0105);
	// trench floors are trampled mud, the lips of the cuts loose soil
	float floor_k = smoothstep(0.55, 1.3, dig) * smoothstep(0.55, 0.85, nw.y);
	wb.x += floor_k * 1.6;
	wa.w += smoothstep(0.04, 0.35, dig) * (1.0 - floor_k) * 0.6;
	wb.x += smoothstep(0.62, 0.8, mac.b) * 0.35 * (wa.w + wb.y);
	float w[8] = float[8](wa.x, wa.y, wa.z, wa.w, wb.x, wb.y, 0.0, wb.w);
	vec2 uv = wp.xz * tex_scale;
	// break the tiling: rotate the uv a little per macro region
	float ang = (mac.r - 0.5) * 1.2;
	uv = mat2(vec2(cos(ang), sin(ang)), vec2(-sin(ang), cos(ang))) * uv;
	vec4 al[8];
	vec4 nr[8];
	float hv[8];
	float best = -10.0;
	for (int i = 0; i < 8; i++) {
		hv[i] = -10.0;
		if (w[i] > 0.02) {
			al[i] = texture(t_alb, vec3(uv, float(i)));
			nr[i] = texture(t_nrh, vec3(uv, float(i)));
			hv[i] = nr[i].a * 0.55 + w[i];
			best = max(best, hv[i]);
		}
	}
	vec3 a = vec3(0.0);
	vec2 n2 = vec2(0.0);
	float r = 0.0;
	float hgt = 0.0;
	float tot = 0.0;
	for (int i = 0; i < 8; i++) {
		if (hv[i] > -9.0) {
			float b = max(hv[i] - best + 0.22, 0.0);
			a += al[i].rgb * b;
			n2 += (nr[i].rg * 2.0 - 1.0) * b;
			r += nr[i].b * b;
			hgt += nr[i].a * b;
			tot += b;
		}
	}
	tot = max(tot, 0.0001);
	a /= tot; n2 /= tot; r /= tot; hgt /= tot;
	a = to_linear(a) * albedo_gain;
	a *= 0.86 + 0.28 * mac.g;
	vec3 pert = vec3(n2.x, 0.0, -n2.y) * (1.0 - smoothstep(detail_fade * 0.35, detail_fade, dist));
	// steep cuts: clay walls, projected from the side
	float wall = smoothstep(0.38, 0.62, 1.0 - nw.y);
	if (wall > 0.01) {
		vec3 bw = pow(abs(nw), vec3(4.0));
		bw /= max(bw.x + bw.z, 0.0001);
		vec2 ux = vec2(wp.z, -wp.y) * 0.8;
		vec2 uz = vec2(wp.x, -wp.y) * 0.8;
		vec4 cx = texture(t_alb, vec3(ux, 6.0));
		vec4 kx = texture(t_nrh, vec3(ux, 6.0));
		vec4 cz = texture(t_alb, vec3(uz, 6.0));
		vec4 kz = texture(t_nrh, vec3(uz, 6.0));
		vec3 wc = to_linear(cx.rgb * bw.x + cz.rgb * bw.z) * albedo_gain;
		vec4 wk = kx * bw.x + kz * bw.z;
		vec2 wn = (kx.rg * 2.0 - 1.0) * bw.x;
		vec2 zn = (kz.rg * 2.0 - 1.0) * bw.z;
		vec3 wpert = vec3(zn.x * sign(nw.z), wn.y + zn.y, wn.x * sign(nw.x)) * 1.2;
		a = mix(a, wc * (0.85 + 0.3 * mac.g), wall);
		r = mix(r, wk.b, wall);
		hgt = mix(hgt, wk.a, wall);
		pert = mix(pert, wpert, wall);
	}
	// wet: mud, puddles' rims, rain
	float wet = clamp(wetness * (0.55 + 0.45 * mac.a) + wb.x * 0.18 * (1.0 - wall) + floor_k * 0.2, 0.0, 1.0);
	a *= 1.0 - 0.42 * wet;
	r = mix(r, 0.14, wet * 0.85);
	pert *= 1.0 - 0.6 * wet;
	albedo = a;
	rough = clamp(r, 0.05, 1.0);
	n_out = normalize(nw + pert * 1.15);
	ao = (1.0 - 0.3 * smoothstep(0.3, 1.9, dig)) * mix(0.75, 1.0, hgt);
}
