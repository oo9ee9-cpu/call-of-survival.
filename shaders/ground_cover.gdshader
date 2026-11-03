// GPU ground cover: one MultiMesh of N instances laid on a world-anchored grid around the camera.
// Instance positions, heights and density are worked out here, so the CPU never touches them.
shader_type spatial;
render_mode skip_vertex_transform, cull_disabled;

#include "res://shaders/terrain_inc.gdshaderinc"

uniform sampler2D card_tex : source_color, filter_linear_mipmap, repeat_disable;
uniform vec3 grid_origin;
uniform float spacing = 0.45;
uniform int grid_n = 128;
uniform float max_dist = 42.0;
uniform float size = 0.55;
uniform float height_scale = 0.5;
uniform bool flat_cards = false;     // litter lies on the ground, grass stands up
uniform vec4 density_w = vec4(0.25, 0.2, 1.4, 0.05);   // weights of needles, litter, dry grass, soil
uniform vec3 tint : source_color = vec3(1.0);
// nothing grows where a layer of the second splat map is above its threshold (trench map: mud only; valley: mud, sand,
// rock and the gravel of roads, the airfield and the bases)
uniform vec4 kill_b = vec4(0.5, 2.0, 2.0, 2.0);
// floors of the buildings around the camera: x, z, half width, half depth (in the building's own axes) and the cos/sin of
// its turn; nothing grows inside them
uniform int hole_n = 0;
uniform vec4 holes[24];
uniform vec2 holes_r[24];
global uniform vec4 wind;
global uniform vec3 view_pos;

varying vec3 v_tint;

float hash12(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * 0.1031);
	p3 += dot(p3, p3.yzx + 33.33);
	return fract((p3.x + p3.y) * p3.z);
}

void vertex() {
	int id = INSTANCE_ID;
	vec2 cell = vec2(float(id % grid_n), float(id / grid_n)) - float(grid_n) * 0.5;
	vec2 basep = grid_origin.xz + cell * spacing;
	vec2 cid = floor(basep / spacing + 0.5);
	float r1 = hash12(cid);
	float r2 = hash12(cid + 17.31);
	float r3 = hash12(cid + 41.77);
	float r4 = hash12(cid + 7.13);
	vec2 xz = basep + (vec2(r1, r2) - 0.5) * spacing * 0.95;
	vec4 wa;
	vec4 wb;
	splat_weights(xz, wa, wb);
	float dens = dot(wa, density_w);
	float h = terrain_height(xz);
	float dig = dig_depth(xz, h);
	float d = distance(xz, view_pos.xz);
	float keep = step(r3, dens) * (1.0 - step(0.08, dig)) * (1.0 - smoothstep(max_dist * 0.65, max_dist, d)) * (1.0 - step(kill_b.x, wb.x)) * (1.0 - step(kill_b.y, wb.y)) * (1.0 - step(kill_b.z, wb.z)) * (1.0 - step(kill_b.w, wb.w));
	for (int i = 0; i < hole_n; i++) {
		vec2 dd = xz - holes[i].xy;
		vec2 l = vec2(dd.x * holes_r[i].x - dd.y * holes_r[i].y, dd.x * holes_r[i].y + dd.y * holes_r[i].x);
		if (abs(l.x) < holes[i].z && abs(l.y) < holes[i].w) {
			keep = 0.0;
		}
	}
	float sc = keep * size * mix(0.65, 1.25, r4);
	float yaw = r1 * 6.2831;
	mat2 rot = mat2(vec2(cos(yaw), sin(yaw)), vec2(-sin(yaw), cos(yaw)));
	vec3 v;
	if (flat_cards) {
		v = vec3(VERTEX.x, 0.0, VERTEX.y - 0.5) * sc;
		v.xz = rot * v.xz;
		v.y = 0.025;
	} else {
		v = VERTEX * vec3(sc, sc * height_scale * 2.0, sc);
		v.xz = rot * v.xz;
		float top = clamp(VERTEX.y, 0.0, 1.0);
		v.xz += wind.xy * wind.z * top * top * 0.16 * sin(TIME * 1.9 + xz.x * 0.8 + xz.y * 0.6) * sc;
	}
	vec3 wpos = vec3(xz.x, h - 0.03, xz.y) + v;
	VERTEX = (VIEW_MATRIX * vec4(wpos, 1.0)).xyz;
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	v_tint = tint * mix(vec3(0.82, 0.8, 0.72), vec3(1.08, 1.02, 0.9), r2) * (1.0 - 0.3 * wb.y);
}

void fragment() {
	vec4 c = texture(card_tex, UV, -0.7);
	ALBEDO = c.rgb * v_tint;
	ALPHA = clamp((c.a - 0.5) / max(fwidth(c.a), 0.0001) + 0.5, 0.0, 1.0);
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	ROUGHNESS = 0.92;
	SPECULAR = 0.2;
	BACKLIGHT = c.rgb * 0.25;
}
