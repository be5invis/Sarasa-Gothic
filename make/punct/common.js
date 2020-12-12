"use strict";

const createFinder = require("../common/glyph-finder");

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
	"\u2e3a": "halfComp2",
	"\u2e3b": "halfComp3"
};

exports.sanitizeSymbols = function sanitizeSymbols(font, isGothic, isType) {
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
};

function removeUnusedFeature(table, tag) {
	if (!table) return;
	for (let f in table.features) {
		if (f.slice(0, 4) === tag) {
			table.features[f] = null;
		}
	}
}

exports.removeUnusedFeatures = function (a, kind, mono) {
	removeUnusedFeature(a.GSUB, "aalt");
	removeUnusedFeature(a.GSUB, "pwid");
	removeUnusedFeature(a.GSUB, "fwid");
	removeUnusedFeature(a.GSUB, "hwid");
	removeUnusedFeature(a.GSUB, "twid");
	removeUnusedFeature(a.GSUB, "qwid");

	if (mono) {
		removeUnusedFeature(a.GSUB, "locl");
		removeUnusedFeature(a.GPOS, "kern");
		removeUnusedFeature(a.GPOS, "vkrn");
		removeUnusedFeature(a.GPOS, "palt");
		removeUnusedFeature(a.GPOS, "vpal");
	}

	if (mono && kind === "WS") {
		removeUnusedFeature(a.GSUB, "ccmp");
	}
};

exports.removeDashCcmp = function (a) {
	if (!a.GSUB || !a.GSUB.features || !a.GSUB.lookups) return;

	let affectedLookups = new Set();
	for (const fid in a.GSUB.features) {
		if (fid.slice(0, 4) === "ccmp") {
			const feature = a.GSUB.features[fid];
			if (!feature) continue;
			for (const lid of feature) affectedLookups.add(lid);
		}
	}

	for (const lid of affectedLookups) {
		const lookup = a.GSUB.lookups[lid];
		removeDashCcmpLookup(lookup, a.cmap);
	}
};
function removeDashCcmpLookup(lookup, cmap) {
	if (!lookup || lookup.type !== "gsub_ligature") return;
	for (const st of lookup.subtables) {
		let st1 = [];
		for (const subst of st.substitutions) {
			let valid = true;
			for (const gid of subst.from) {
				if (cmap[0x2014] === gid || cmap[0x2015] === gid) valid = false;
			}
			if (valid) st1.push(subst);
		}
		st.substitutions = st1;
	}
}

exports.toPWID = function (font) {
	const find = createFinder(font);
	for (let c in font.cmap) {
		if (!font.cmap[c]) continue;
		if (!sanitizerTypes[String.fromCodePoint(c - 0)]) continue;
		font.cmap[c] = find.gname.subst("pwid", font.cmap[c]);
	}
};
