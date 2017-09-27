"use strict";

const { quadify, introduce, build, gc, manip: { glyph: glyphManip } } = require("megaminx");
const { isKanji } = require("caryll-iddb");
const { isWestern, isWS, isKorean, sanitizeSymbols, removeUnusedFeatures } = require("./common");

async function pass(ctx, config, argv) {
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
	removeUnusedFeatures(ctx.items.a);
	await ctx.run(gc, "a", { ignoreAltSub: true });
	await ctx.run(glyphManip, "a", sanitizeSymbols, config);

	await ctx.run(build, "a", { to: config.o, optimize: true });
	ctx.remove("a");
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
