// Geometry-clipmap terrain: every level is a ring of cells around the camera; heights come from the height textures.
// Outer cells of each level morph towards the next coarser level so neighbouring levels meet without cracks.
shader_type spatial;
render_mode skip_vertex_transform, cull_back;

#include "res://shaders/terrain_inc.gdshaderinc"

uniform vec2 centers[12];
uniform float clip_m = 64.0;
uniform float s0 = 0.25;

varying vec3 v_world;
varying vec3 v_nrm;
varying float v_dig;

void vertex() {
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float s = MODEL_MATRIX[0][0];
	int lv = clamp(int(round(log2(s / s0))), 0, 11);
	vec2 c = centers[lv];
	vec2 lc = (wp.xz - c) / s;
	float d = max(abs(lc.x), abs(lc.y));
	float band = clip_m * 0.25;
	float alpha = clamp((d - (clip_m - band)) / (band - 1.0), 0.0, 1.0);
	ivec2 gi = ivec2(round(wp.xz / s));
	bool ox = (gi.x & 1) == 1;
	bool oz = (gi.y & 1) == 1;
	float h = terrain_height(wp.xz);
	if (alpha > 0.0 && (ox || oz)) {
		float hc;
		if (ox && oz) {
			hc = 0.5 * (terrain_height(wp.xz + vec2(-s, -s)) + terrain_height(wp.xz + vec2(s, s)));
		} else if (ox) {
			hc = 0.5 * (terrain_height(wp.xz + vec2(-s, 0.0)) + terrain_height(wp.xz + vec2(s, 0.0)));
		} else {
			hc = 0.5 * (terrain_height(wp.xz + vec2(0.0, -s)) + terrain_height(wp.xz + vec2(0.0, s)));
		}
		h = mix(h, hc, alpha);
	}
	wp.y = h;
	float e = max(s, 0.25);
	float hx0 = terrain_height(wp.xz - vec2(e, 0.0));
	float hx1 = terrain_height(wp.xz + vec2(e, 0.0));
	float hz0 = terrain_height(wp.xz - vec2(0.0, e));
	float hz1 = terrain_height(wp.xz + vec2(0.0, e));
	vec3 n = normalize(vec3(hx0 - hx1, 2.0 * e, hz0 - hz1));
	v_world = wp;
	v_nrm = n;
	v_dig = dig_depth(wp.xz, h);
	VERTEX = (VIEW_MATRIX * vec4(wp, 1.0)).xyz;
	NORMAL = normalize((VIEW_MATRIX * vec4(n, 0.0)).xyz);
}

void fragment() {
	float dist = length(v_world - CAMERA_POSITION_WORLD);
	vec3 alb;
	float rough;
	vec3 nw;
	float ao;
	terrain_material(v_world, normalize(v_nrm), v_dig, dist, alb, rough, nw, ao);
	ALBEDO = alb;
	ROUGHNESS = rough;
	SPECULAR = 0.28;
	AO = ao;
	AO_LIGHT_AFFECT = 0.35;
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
}
