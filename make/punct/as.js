"use strict";

const introFont = require("../common/intro-font");
const buildFont = require("../common/build-font");
const {
	isIdeograph,
	isWestern,
	isWS,
	isKorean,
	isLongDash,
	filterUnicodeRange
} = require("../common/unicode-kind");
const { sanitizeSymbols, removeUnusedFeatures, toPWID, removeDashCcmp } = require("./common");
const gc = require("../common/gc");
const createFinder = require("../common/glyph-finder");

module.exports = async function makeFont(argv) {
	const a = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	const b = await introFont({ from: argv.lgc, prefix: "b", ignoreHints: true });
	a.cmap_uvs = null;
	filterUnicodeRange(
		a,
		c =>
			!isIdeograph(c - 0) &&
			!isWestern(c - 0) &&
			!isKorean(c - 0) &&
			!isLongDash(c - 0, argv.term) &&
			!isWS(c - 0)
	);

	if (argv.pwid) toPWID(a);

	if (argv.mono) {
		unlinkRefsOfSymbols(b, argv.term);
		transferMonoGeometry(a, b);
		populatePwidOfMono(a);
	}
	if (!argv.pwid) sanitizeSymbols(a, argv.goth, !argv.pwid && !argv.term);
	if (argv.mono) removeDashCcmp(a, argv.mono);

	removeUnusedFeatures(a, "AS", argv.mono);
	aliasFeatMap(a, "vert", [[0x2014, 0x2015]]);
	gc(a);

	await buildFont(a, { to: argv.o, optimize: true });
};

// Monospace punctuation transferring
function unlinkRefsOfSymbols(font, isTerm) {
	const find = createFinder(font);
	for (let u = 0x2000; u < 0x20a0; u++) {
		let gn = find.gname.unicode(u);
		if (!gn) continue;
		let gnT = gn;
		if (!isTerm) gnT = find.gname.subst("WWID", gn);
		if (!gnT) continue;
		const g = find.glyph(gn);
		const g$ = find.glyph$(gnT);
		HCopy(g, g$);
	}
}
function transferMonoGeometry(main, lgc) {
	for (let u = 0x2000; u < 0x20a0; u++) {
		let gnSrc = main.cmap[u],
			gnDst = lgc.cmap[u];
		if (gnSrc && gnDst) {
			HCopy(main.glyf[gnSrc], lgc.glyf[gnDst]);
		}
	}
}
function populatePwidOfMono(font) {
	const find = createFinder(font);
	for (let u = 0x2000; u < 0x20a0; u++) {
		const gn = find.gname.unicode(u);
		if (!gn) continue;
		const gnPwid = find.gname.subst("pwid", gn);
		if (!gnPwid) continue;
		const g = find.glyph(gnPwid);
		const g$ = find.glyph$(gn);
		HCopy(g, g$);
	}
}

function HCopy(g, g1) {
	g.contours = g1.contours;
	g.references = g1.references;
	g.advanceWidth = g1.advanceWidth;
}

// Feature mapping
function aliasFeatMap(a, feat, aliases) {
	if (!a.GSUB || !a.GSUB.features || !a.GSUB.lookups) return;
	for (const [uFrom, uTo] of aliases) {
		const gidFrom = a.cmap[uFrom],
			gidTo = a.cmap[uTo];
		if (!gidFrom || !gidTo) continue;

		let affectedLookups = new Set();
		for (const fid in a.GSUB.features) {
			if (fid.slice(0, 4) === feat) {
				const feature = a.GSUB.features[fid];
				if (!feature) continue;
				for (const lid of feature) affectedLookups.add(lid);
			}
		}

		for (const lid of affectedLookups) {
			const lookup = a.GSUB.lookups[lid];
			if (lookup.type !== "gsub_single") continue;
			for (const subtable of lookup.subtables) {
				subtable[gidFrom] = subtable[gidTo];
			}
		}
	}
}
