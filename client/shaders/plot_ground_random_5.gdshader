shader_type spatial;
render_mode cull_disabled;

uniform sampler2D tex0 : source_color;
uniform sampler2D tex1 : source_color;
uniform sampler2D tex2 : source_color;
uniform sampler2D tex3 : source_color;
uniform sampler2D tex4 : source_color;

uniform float texture_repeat_x = 4.0;
uniform float texture_repeat_y = 4.0;

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

vec2 rotate_tile_uv(vec2 uv, float r) {
	// Random 0/90/180/270 rotation per tile for less visible repetition
	if (r < 0.25) {
		return uv;
	} else if (r < 0.5) {
		return vec2(uv.y, 1.0 - uv.x);
	} else if (r < 0.75) {
		return vec2(1.0 - uv.x, 1.0 - uv.y);
	}
	return vec2(1.0 - uv.y, uv.x);
}

vec4 sample_ground_texture(float pick, vec2 tiled_uv) {
	if (pick < 0.2) {
		return texture(tex0, tiled_uv);
	} else if (pick < 0.4) {
		return texture(tex1, tiled_uv);
	} else if (pick < 0.6) {
		return texture(tex2, tiled_uv);
	} else if (pick < 0.8) {
		return texture(tex3, tiled_uv);
	}
	return texture(tex4, tiled_uv);
}

void fragment() {
	// UV across the whole plane, scaled by desired repeat count
	vec2 tiled = vec2(
		UV.x * texture_repeat_x,
		UV.y * texture_repeat_y
	);

	// Which repeated tile are we in?
	vec2 tile_id = floor(tiled);

	// Local UV inside that tile (0..1)
	vec2 local_uv = fract(tiled);

	// Randomly choose which texture this tile uses
	float tex_pick = hash21(tile_id);

	// Randomly rotate the local tile UV too, so repetition is less obvious
	float rot_pick = hash21(tile_id + vec2(19.17, 73.41));
	vec2 final_uv = rotate_tile_uv(local_uv, rot_pick);

	vec4 tex_color = sample_ground_texture(tex_pick, final_uv);

	ALBEDO = tex_color.rgb;
	ALPHA = tex_color.a;
	ROUGHNESS = 1.0;
	METALLIC = 0.0;
}