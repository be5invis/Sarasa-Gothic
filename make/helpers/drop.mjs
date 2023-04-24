import { Ot } from "ot-builder";

export function dropGlyphNames(a) {
	const oldPost = a.post;
	a.post = new Ot.Post.Table(3, 0);
	a.post.italicAngle = oldPost.italicAngle;
	a.post.underlinePosition = oldPost.underlinePosition;
	a.post.underlineThickness = oldPost.underlineThickness;
	a.post.isFixedPitch = oldPost.isFixedPitch;
}

export function dropCharacters(a, fn) {
	for (const [ch, g] of a.cmap.unicode.entries()) {
		if (fn(ch)) a.cmap.unicode.delete(ch);
	}
	for (const [ch, vs, g] of a.cmap.vs.entries()) {
		if (fn(ch)) a.cmap.vs.delete(ch, vs);
	}
}

export function dropHints(a) {
	a.cvt = a.fpgm = a.prep = null;
	for (const g of a.glyphs.decideOrder()) g.hints = null;
}

export function dropOtl(a) {
	a.gsub = a.gpos = null;
}

export function dropFeature(table, featureSet) {
	const fs = new Set(featureSet);
	for (const feature of table.features) {
		if (fs.has(feature.tag)) {
			feature.lookups.length = 0;
			feature.params = null;
		}
	}
}
