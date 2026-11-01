// Static meshes that must look like the ground around them (earth mounds over the dugouts).
shader_type spatial;
render_mode cull_back;

#include "res://shaders/terrain_inc.gdshaderinc"

varying vec3 v_world;
varying vec3 v_nrm;

void vertex() {
	v_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	v_nrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	float dist = length(v_world - CAMERA_POSITION_WORLD);
	vec3 alb;
	float rough;
	vec3 nw;
	float ao;
	terrain_material(v_world, normalize(v_nrm), 0.0, dist, alb, rough, nw, ao);
	ALBEDO = alb;
	ROUGHNESS = rough;
	SPECULAR = 0.35;
	AO = ao;
	AO_LIGHT_AFFECT = 0.35;
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
}
