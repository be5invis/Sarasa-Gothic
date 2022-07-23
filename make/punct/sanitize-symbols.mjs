import createFinder from "../common/glyph-finder.mjs";

function deleteGPOS(font, gid) {
	if (!font.GPOS) return;
	for (let l in font.GPOS.lookups) {
		let lut = font.GPOS.lookups[l];
		switch (lut.type) {
			case "gpos_single":
				for (let st of lut.subtables) st[gid] = null;
				break;
		}
	}
}
const sanitizers = {};
sanitizers.auto = function (font, glyph) {
	const targetW = Math.min(
		font.em,
		Math.ceil(glyph.advanceWidth / (font.em / 2)) * (font.em / 2)
	);
	const shift = (targetW - glyph.advanceWidth) / 2;
	if (!glyph.contours) return glyph;
	for (let c of glyph.contours) for (let z of c) z.x += shift;
	glyph.advanceWidth = targetW;
	return glyph;
};
sanitizers.half = function (font, glyph) {
	const targetW = font.em / 2;
	const shift = (targetW - glyph.advanceWidth) / 2;
	if (!glyph.contours) return glyph;
	for (let c of glyph.contours) for (let z of c) z.x += shift;
	glyph.advanceWidth = targetW;
	return glyph;
};
sanitizers.full = function (font, glyph) {
	const targetW = font.em;
	const shift = (targetW - glyph.advanceWidth) / 2;
	glyph.advanceWidth = targetW;
	if (!glyph.contours) return glyph;
	for (let c of glyph.contours) for (let z of c) z.x += shift;
	return glyph;
};
sanitizers.ellipsis = function (font, glyph, gid, isGothic, isType) {
	const targetW = isGothic ? font.em : isType ? glyph.advanceWidth : font.em / 2;
	const shift = (targetW - glyph.advanceWidth) / 2;
	glyph.advanceWidth = targetW;
	if (!glyph.contours) return glyph;
	for (let c of glyph.contours) for (let z of c) z.x += shift;
	return glyph;
};
sanitizers.halfLeft = function (font, glyph, gid, isGothic) {
	const find = createFinder(font);
	const g1 = sanitizers.half(font, find.glyph$(find.gname.subst("pwid", gid)));
	Object.assign(glyph, g1);
	deleteGPOS(font, gid);
	if (isGothic) glyph.advanceWidth = font.em;
	return glyph;
};
sanitizers.halfRight = function (font, glyph, gid, isGothic) {
	const find = createFinder(font);
	const g1 = sanitizers.half(font, find.glyph$(find.gname.subst("pwid", gid)));
	Object.assign(glyph, g1);
	deleteGPOS(font, gid);
	if (isGothic) {
		glyph.advanceWidth = font.em;
		for (let c of glyph.contours) for (let z of c) z.x += font.em / 2;
	}
	return glyph;
};
function HalfCompN(n, forceFullWidth, forceHalfWidth) {
	return function (font, glyph, gid, isGothic, isType) {
		const find = createFinder(font);
		const g1 = find.glyph$(find.gname.subst("fwid", gid));
		Object.assign(glyph, g1);
		const targetW = Math.min(
			font.em * n,
			Math.ceil(glyph.advanceWidth / font.em) *
				(font.em *
					(forceHalfWidth ? 1 / 2 : isGothic || isType || forceFullWidth ? 1 : 1 / 2))
		);
		if (glyph.contours) {
			for (let c of glyph.contours) for (let z of c) z.x *= targetW / glyph.advanceWidth;
		}
		glyph.advanceWidth = targetW;
		deleteGPOS(font, gid);
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
	for (let c in font.cmap) {
		if (!font.cmap[c]) continue;
		const stt = sanitizerTypes[String.fromCodePoint(c - 0)];
		if (stt) san.set(font.cmap[c], stt);
	}
	for (let g in font.glyf) {
		let sanitizer = sanitizers[san.has(g) ? san.get(g) : "auto"];
		const glyph = font.glyf[g];
		if (!glyph) continue;
		sanitizer(font, glyph, g, isGothic, isType);
	}
}
export const toPWID = function (font) {
	const find = createFinder(font);
	for (let c in font.cmap) {
		if (!font.cmap[c]) continue;
		if (!sanitizerTypes[String.fromCodePoint(c - 0)]) continue;
		font.cmap[c] = find.gname.subst("pwid", font.cmap[c]);
	}
};
