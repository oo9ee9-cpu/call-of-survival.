// The far ring of the valley's forest: one card per tree, always turned to the camera, cut from the atlas that
// tools/bake_impostors8.gd renders from the real trees (unlit colours). Lit here by the game's own sun through a
// rounded crown normal, darker low in the crown, swaying with the wind like the near trees. Each card lives only
// between cut_near and cut_far (distance of its tree from the camera) and dissolves in and out over fade_in /
// fade_out metres, in step with the dissolve of the mid-distance trees, so the switch is never a jump.
// Seen from above (a parachute jump, an aircraft) the card leans back about its crown so it still faces the camera:
// straight down it lies flat at the crown's height, a round canopy, instead of vanishing edge-on.
// Instance custom data: x = atlas cell, y = card width (m), z = card height (m), w = brightness variation 0..1.
shader_type spatial;
render_mode cull_disabled, world_vertex_coords;

uniform sampler2D atlas : source_color, filter_linear_mipmap, repeat_disable;
uniform vec2 grid = vec2(9.0, 2.0);
uniform float cut_near = 300.0;
uniform float cut_far = 2600.0;
uniform float fade_in = 40.0;
uniform float fade_out = 200.0;
uniform float translucency = 0.3;
global uniform vec3 view_pos;
global uniform vec4 wind;
global uniform float wetness;

varying vec2 v_local;
varying float v_var;
varying float v_dist;
varying vec3 v_right;
varying vec3 v_toward;

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	float s = length(MODEL_MATRIX[1].xyz);
	vec2 to = view_pos.xz - o.xz;
	float d = distance(view_pos, o);
	vec2 h = to / max(length(to), 0.001);
	vec3 right = vec3(h.y, 0.0, -h.x);
	vec2 lp = vec2(UV.x - 0.5, 1.0 - UV.y);
	float w = INSTANCE_CUSTOM.y * s;
	float hh = INSTANCE_CUSTOM.z * s;
	vec3 crown = o + vec3(0.0, 0.55 * hh, 0.0);
	vec3 tv = view_pos - crown;
	float tilt = clamp(atan(tv.y, max(length(tv.xz), 0.001)) - 0.3, 0.0, 1.45);
	vec3 toward = vec3(h.x, 0.0, h.y);
	vec3 up = vec3(0.0, cos(tilt), 0.0) - toward * sin(tilt);
	vec3 p = crown + right * (lp.x * w) + up * ((lp.y - 0.55) * hh);
	float k = lp.y * lp.y;
	p.xz += wind.xy * wind.z * k * 0.25 * (hh / 18.0) * sin(TIME * 0.85 + o.x * 0.13 + o.z * 0.11);
	if (d < cut_near || d > cut_far) {
		p = vec3(0.0);
	}
	VERTEX = p;
	NORMAL = toward * cos(tilt) + vec3(0.0, sin(tilt), 0.0);
	float cell = INSTANCE_CUSTOM.x + 0.5;
	float row = floor(cell / grid.x);
	float col = floor(cell - row * grid.x);
	UV = (vec2(col, row) + UV) / grid;
	v_local = lp;
	v_var = INSTANCE_CUSTOM.w;
	v_dist = d;
	v_right = right;
	v_toward = toward;
}

float ign(vec2 p) {
	return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}

void fragment() {
	float n = ign(FRAGCOORD.xy);
	if (fade_in > 0.0 && n >= clamp((v_dist - cut_near) / fade_in, 0.0, 1.0)) {
		discard;
	}
	if (fade_out > 0.0 && n < clamp((v_dist - (cut_far - fade_out)) / fade_out, 0.0, 1.0)) {
		discard;
	}
	vec4 c = texture(atlas, UV);
	// mip levels thin the leaves out: keep the crowns full far away
	float cut = mix(0.5, 0.28, clamp(v_dist / 1800.0, 0.0, 1.0));
	ALPHA = clamp((c.a - cut) / max(fwidth(c.a), 0.0001) + 0.5, 0.0, 1.0);
	ALPHA_SCISSOR_THRESHOLD = 0.5;
	vec3 a = c.rgb * mix(0.86, 1.1, v_var);
	a *= mix(0.5, 1.0, smoothstep(0.04, 0.8, v_local.y));
	a *= 1.0 - 0.25 * wetness;
	ALBEDO = a;
	// a rounded crown: the side towards the sun is lit, the far side and the bottom fall into shade
	vec3 nw = normalize(v_right * (v_local.x * 1.7) + vec3(0.0, 0.25 + (v_local.y - 0.45) * 0.7, 0.0) + v_toward * 0.75);
	NORMAL = normalize((VIEW_MATRIX * vec4(nw, 0.0)).xyz);
	ROUGHNESS = 0.85;
	SPECULAR = 0.2;
	BACKLIGHT = a * translucency;
}
