import * as TypoGeom from "typo-geom";

import GlyphPoint from "./support/glyph-point.mjs";

function convertContours(shape) {
	const sink = new FairizedShapeSink();
	TypoGeom.ShapeConv.transferGenericShape(convertShapeToArcs(shape), sink, 1 / 4);
	return sink.contours;
}
function convertShapeToArcs(shape) {
	return shape.map(convertContourToArcs);
}
function convertContourToArcs(_contour) {
	if (!_contour || !_contour.length) return [];
	const contour = [..._contour];
	if (!contour[contour.length - 1].on) contour.push(GlyphPoint.from(contour[0]));
	const arcs = [];
	let z0 = contour[0];
	for (let j = 1; j < contour.length; j++) {
		const z = contour[j];
		if (z.on) {
			arcs.push(new TypoGeom.Arcs.StraightSegment(z0, z));
			z0 = z;
		} else {
			const z1 = z;
			const z2 = contour[j + 1];
			const z3 = contour[j + 2];
			arcs.push(new TypoGeom.Arcs.Bez3(z0, z1, z2, z3));
			z0 = z3;
			j += 2;
		}
	}
	return arcs;
}
class FairizedShapeSink {
	constructor() {
		this.contours = [];
		this.lastContour = [];
	}
	beginShape() {}
	endShape() {
		if (this.lastContour.length > 2) {
			const c = this.lastContour.reverse();
			const zFirst = c[0],
				zLast = c[c.length - 1];
			if (isOccurrent(zFirst, zLast)) c.pop();
			this.contours.push(c);
		}
		this.lastContour = [];
	}
	moveTo(x, y) {
		this.endShape();
		this.lineTo(x, y);
	}
	lineTo(x, y) {
		const z = GlyphPoint.cornerFromXY(roundToGear(x), roundToGear(y));
		while (this.lastContour.length >= 2) {
			const a = this.lastContour[this.lastContour.length - 2],
				b = this.lastContour[this.lastContour.length - 1];
			if (isLineExtend(a, b, z)) {
				this.lastContour.pop();
			} else {
				break;
			}
		}
		this.lastContour.push(z);
	}
	arcTo(arc, x, y) {
		const offPoints = TypoGeom.Quadify.auto(arc, 1, 8);
		if (offPoints) {
			for (const z of offPoints)
				this.lastContour.push(GlyphPoint.offFromXY(roundToGear(z.x), roundToGear(z.y)));
		}
		this.lineTo(x, y);
	}
}
function isOccurrent(zFirst, zLast) {
	return zFirst.on && zLast.on && zFirst.x === zLast.x && zFirst.y === zLast.y;
}
function isLineExtend(a, b, c) {
	return (
		a.on &&
		c.on &&
		((aligned(a.x, b.x, c.x) && between(a.y, b.y, c.y)) ||
			(aligned(a.y, b.y, c.y) && between(a.x, b.x, c.x)))
	);
}
function geometryPrecisionEqual(a, b) {
	return roundToGear(a) === roundToGear(b);
}
function aligned(a, b, c) {
	return geometryPrecisionEqual(a, b) && geometryPrecisionEqual(b, c);
}
function between(a, b, c) {
	return (a <= b && b <= c) || (a >= b && b >= c);
}
function roundToGear(x) {
	return Math.round(x * 4) / 4;
}
export default (function (font) {
	font.maxp.version = 1.0;
	font.CFF_ = null;
	for (let k in font.glyf) {
		let g = font.glyf[k];
		if (g.contours) g.contours = convertContours(g.contours);
		g.stemH = null;
		g.stemV = null;
		g.hintMasks = null;
		g.contourMasks = null;
	}
});
