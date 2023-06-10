import { bakeFeature } from "../helpers/bake-feature.mjs";
import {
	alterContours,
	copyGeometryData,
	flatCloneGlyph,
	getAdvanceWidth,
	setAdvanceWidth,
	shiftContours
} from "../helpers/geometry.mjs";
import { GlyphFinder } from "../helpers/glyph-finder.mjs";

const sanitizers = {};

function CenterTo(widthF) {
	return function (font, glyph, isGothic, isType) {
		const em = font.head.unitsPerEm;
		const adw = getAdvanceWidth(glyph);

		const targetW = widthF(adw, em, isGothic, isType);
		const shift = (targetW - adw) / 2;

		shiftContours(glyph, shift);
		setAdvanceWidth(glyph, targetW);

		return glyph;
	};
}

sanitizers.auto = CenterTo((adw, em) => Math.min(em, Math.ceil(adw / (em / 2)) * (em / 2)));
sanitizers.half = CenterTo((adw, em) => em / 2);
sanitizers.full = CenterTo((adw, em) => em);
sanitizers.ellipsis = CenterTo((adw, em, isGothic, isType) =>
	isGothic ? em : isType ? adw : em / 2
);

sanitizers.halfLeft = function (font, glyph, isGothic, isType) {
	const em = font.head.unitsPerEm;
	const finder = new GlyphFinder(font);

	copyGeometryData(glyph, sanitizers.half(font, flatCloneGlyph(finder.subst("pwid", glyph))));

	if (isGothic) {
		setAdvanceWidth(glyph, em);
	} else {
		setAdvanceWidth(glyph, 0.5 * em);
	}

	return glyph;
};
sanitizers.halfRight = function (font, glyph, isGothic, isType) {
	const em = font.head.unitsPerEm;
	const finder = new GlyphFinder(font);

	copyGeometryData(glyph, sanitizers.half(font, flatCloneGlyph(finder.subst("pwid", glyph))));

	if (isGothic) {
		shiftContours(glyph, 0.5 * em);
		setAdvanceWidth(glyph, em);
	} else {
		setAdvanceWidth(glyph, 0.5 * em);
	}

	return glyph;
};

function HalfCompN(n, forceFullWidth, forceHalfWidth) {
	return function (font, glyph, isGothic, isType) {
		const em = font.head.unitsPerEm;
		const finder = new GlyphFinder(font);

		copyGeometryData(glyph, finder.subst("fwid", glyph));
		const adw = getAdvanceWidth(glyph);

		const targetW = Math.min(
			em * n,
			Math.ceil(adw / em) *
				(em * (forceHalfWidth ? 0.5 : isGothic || isType || forceFullWidth ? 1 : 0.5))
		);

		alterContours(glyph, (x, y) => [(x * targetW) / adw, y]);
		setAdvanceWidth(glyph, targetW);

		return glyph;
	};
}

sanitizers.halfComp = HalfCompN(1);
sanitizers.halfCompH = HalfCompN(1, false, true);
sanitizers.halfComp2 = HalfCompN(2);
sanitizers.halfComp3 = HalfCompN(3);

const sanitizerTypes = {
	"“": "halfRight",
	"‘": "halfRight",
	"’": "halfLeft",
	"”": "halfLeft",
	"\u2010": "halfCompH",
	"\u2011": "halfCompH",
	"\u2012": "halfCompH",
	"\u2013": "halfCompH",
	"\u2014": "halfComp",
	"\u2015": "halfComp",
	"\u2025": "ellipsis",
	"\u2026": "ellipsis",
	"\u2e3a": "halfComp2",
	"\u2e3b": "halfComp3",
	"\u31b4": "half",
	"\u31b5": "half",
	"\u31b6": "half",
	"\u31b7": "half",
	"\u31bb": "half"
};

export function sanitizeSymbols(font, isGothic, isType) {
	let san = new Map();
	for (const [c, g] of font.cmap.unicode.entries()) {
		const stt = sanitizerTypes[String.fromCodePoint(c)];
		if (stt) san.set(g, stt);
	}

	for (const g of font.glyphs.decideOrder()) {
		let sanitizer = sanitizers[san.has(g) ? san.get(g) : "auto"];
		sanitizer(font, g, isGothic, isType);
	}
}
export function toPWID(font) {
	bakeFeature("pwid", font, c => sanitizerTypes[String.fromCodePoint(c)]);
}
