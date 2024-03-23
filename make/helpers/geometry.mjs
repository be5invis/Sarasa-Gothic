import { Ot } from "ot-builder";

export function flatCloneGlyph(g) {
	const g1 = new Ot.Glyph();
	g1.name = g.name;
	copyGeometryData(g1, g);
	return g1;
}

export function copyGeometryData(gDst, gSrc) {
	if (gSrc.horizontal) gDst.horizontal = { ...gSrc.horizontal };
	if (gSrc.vertical) gDst.vertical = { ...gSrc.vertical };
	if (gSrc.geometry) {
		gDst.geometry = new Ot.Glyph.ContourSet(
			Ot.GeometryUtil.apply(Ot.GeometryUtil.Flattener, gSrc.geometry)
		);
	}
}

export function italize(font, degrees) {
	const slope = Math.tan((degrees / 180) * Math.PI);
	for (const glyph of font.glyphs.decideOrder()) {
		if (!glyph.geometry) continue;
		const contours = Ot.GeometryUtil.apply(Ot.GeometryUtil.Flattener, glyph.geometry);
		for (const c of contours) {
			for (const z of c) z.x += (z.y - font.head.unitsPerEm / 3) * slope;
		}
		glyph.geometry = new Ot.Glyph.ContourSet(contours);
	}
}

export function alterContours(glyph, fn) {
	if (!glyph.geometry) return;
	const contours = Ot.GeometryUtil.apply(Ot.GeometryUtil.Flattener, glyph.geometry);
	for (const c of contours) {
		for (let i = 0; i < c.length; i++) {
			const [x, y] = fn(c[i].x, c[i].y);
			c[i] = Ot.Glyph.Point.create(x, y, c[i].kind);
		}
	}
	glyph.geometry = new Ot.Glyph.ContourSet(contours);
}
export function shiftContours(glyph, delta) {
	if (!glyph.geometry) return;
	const contours = Ot.GeometryUtil.apply(Ot.GeometryUtil.Flattener, glyph.geometry);
	for (const c of contours) {
		for (const z of c) z.x += delta;
	}
	glyph.geometry = new Ot.Glyph.ContourSet(contours);
}

export function getAdvanceWidth(glyph) {
	if (glyph.horizontal) return glyph.horizontal.end;
	else return 0;
}
export function getAdvanceHeight(glyph) {
	if (glyph.vertical) return glyph.vertical.start - glyph.vertical.end;
	else return 0;
}

export function setAdvanceWidth(glyph, w) {
	glyph.horizontal = { start: 0, end: w };
}
