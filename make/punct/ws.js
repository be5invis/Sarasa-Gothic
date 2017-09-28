"use strict";

const { quadify, introduce, build, gc, manip: { glyph: glyphManip } } = require("megaminx");
const { isKanji } = require("caryll-iddb");
const { isWestern, isWS, isKorean, sanitizeSymbols, removeUnusedFeatures } = require("./common");

module.exports = async function makeFont(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	await ctx.run(quadify, "a");
	a.cmap_uvs = null;
	for (let c in a.cmap) {
		if (isKanji(c - 0) || isWestern(c - 0) || isKorean(c - 0) || !isWS(c - 0)) {
			a.cmap[c] = null;
		}
	}

	if (argv.mono) {
		await ctx.run(glyphManip, "a", sanitizeSymbols);
	}
	removeUnusedFeatures(ctx.items.a);
	await ctx.run(gc, "a", { ignoreAltSub: true });

	await ctx.run(build, "a", { to: argv.o, optimize: true });
	ctx.remove("a");
};
