"use strict";

const { introduce, build, manip } = require("megaminx");
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

module.exports = async function makeFont(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", { from: argv.main, prefix: "a", ignoreHints: true });
	const b = await ctx.run(introduce, "b", { from: argv.lgc, prefix: "b", ignoreHints: true });
	a.cmap_uvs = null;
	filterUnicodeRange(
		a,
		c =>
			!isIdeograph(c - 0) &&
			!isWestern(c - 0) &&
			!isKorean(c - 0) &&
			!isLongDash(c - 0, argv.term) &&
			!isWS(c - 0, argv.type, argv.term)
	);

	if (argv.pwid) {
		await ctx.run(manip.glyph, "a", toPWID);
	}
	if (argv.mono) {
		await ctx.run(manip.glyph, "b", unlinkRefsOfSymbols, argv.term);
		transferMonoGeometry(ctx.items.a, ctx.items.b);
		await ctx.run(manip.glyph, "a", populatePwidOfMono);
		await ctx.run(manip.glyph, "a", sanitizeSymbols, argv.type);
		removeDashCcmp(ctx.items.a, argv.mono);
	}
	removeUnusedFeatures(ctx.items.a, "AS", argv.mono);
	aliasFeatMap(ctx.items.a, "vert", [[0x2014, 0x2015]]);
	gc(ctx.items.a);

	await ctx.run(build, "a", { to: argv.o, optimize: true });
	ctx.remove("a");
};

// Monospace punctuation transferring
function unlinkRefsOfSymbols(isTerm) {
	for (let u = 0x2000; u < 0x20a0; u++) {
		let gn = this.find.gname.unicode(u);
		if (!gn) continue;
		let gnT = gn;
		if (!isTerm) gnT = this.find.gname.subst("WWID", gn);
		if (!gnT) continue;
		const g = this.find.glyph(gn);
		const g$ = this.find.glyph$(gnT);
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
function populatePwidOfMono() {
	for (let u = 0x2000; u < 0x20a0; u++) {
		const gn = this.find.gname.unicode(u);
		if (!gn) continue;
		const gnPwid = this.find.gname.subst("pwid", gn);
		if (!gnPwid) continue;
		const g = this.find.glyph(gnPwid);
		const g$ = this.find.glyph$(gn);
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
