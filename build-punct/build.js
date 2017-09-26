"use strict";

const { quadify, introduce, build, gc, manip: { glyph: glyphManip } } = require("megaminx");
const { isKanji } = require("caryll-iddb");

function isWestern(c) {
	return c < 0x2000;
}

function isKorean(c) {
	return (
		(c >= 0xac00 && c <= 0xd7af) ||
		(c >= 0x3130 && c <= 0x318f) ||
		(c >= 0x3200 && c <= 0x321e) ||
		(c >= 0xffa1 && c <= 0xffdc) ||
		(c >= 0x3260 && c <= 0x327f) ||
		(c >= 0xa960 && c <= 0xd7ff)
	);
}

async function sanitizeSymbols(config) {
	for (let g in this.font.glyf) {
		const glyph = this.font.glyf[g];
		if (!glyph) continue;
		const targetW = Math.ceil(glyph.advanceWidth / (this.em / 2)) * (this.em / 2);
		const shift = (targetW - glyph.advanceWidth) / 2;
		if (!glyph.contours) continue;
		for (let c of glyph.contours) for (let z of c) z.x += shift;
		glyph.advanceWidth = targetW;
	}
}

async function pass(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	await ctx.run(quadify, "a");
	a.cmap_uvs = null;
	for (let c in a.cmap) {
		if (isKanji(c - 0) || isWestern(c - 0) || isKorean(c - 0)) {
			a.cmap[c] = null;
		}
	}

	await ctx.run(gc, "a");
	await ctx.run(glyphManip, "a", sanitizeSymbols, config);

	await ctx.run(build, "a", { to: config.o, optimize: true });
	ctx.remove("a");
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
