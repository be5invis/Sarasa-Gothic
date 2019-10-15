"use strict";

const { quadify, introduce, build, gc, manip } = require("megaminx");
const {
	isIdeograph,
	isWestern,
	isWS,
	isKorean,
	filterUnicodeRange
} = require("../common/unicode-kind");
const { sanitizeSymbols, removeUnusedFeatures, toPWID } = require("./common");

module.exports = async function makeFont(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	await ctx.run(quadify, "a");
	a.cmap_uvs = null;
	filterUnicodeRange(
		a,
		c =>
			!isIdeograph(c - 0) &&
			!isWestern(c - 0) &&
			!isKorean(c - 0) &&
			isWS(c - 0, argv.type, argv.term)
	);

	if (argv.pwid) {
		await ctx.run(manip.glyph, "a", toPWID);
	}
	if (argv.mono) {
		await ctx.run(manip.glyph, "a", sanitizeSymbols, argv.type);
	}
	removeUnusedFeatures(ctx.items.a);
	await ctx.run(gc, "a", { ignoreAltSub: true });

	await ctx.run(build, "a", { to: argv.o, optimize: true });
	ctx.remove("a");
};
