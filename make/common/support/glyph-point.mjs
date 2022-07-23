export default (class GlyphPoint {
	constructor(x, y, on) {
		this.x = x;
		this.y = y;
		this.on = on;
	}
	static cornerFromXY(x, y) {
		return new GlyphPoint(x, y, true);
	}
	static offFromXY(x, y) {
		return new GlyphPoint(x, y, false);
	}
	static from(z) {
		return new GlyphPoint(z.x || 0, z.y || 0, !!z.on);
	}
	static transformedFrom(z, tfm) {
		return new GlyphPoint(
			tfm.a * z.x + tfm.b * z.y + tfm.x,
			tfm.c * z.x + tfm.d * z.y + tfm.y,
			!!z.on
		);
	}
});
