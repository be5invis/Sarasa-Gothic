"use strict";

const { introduce, build, gc, manip } = require("megaminx");
const {
	isIdeograph,
	isWestern,
	isWS,
	isKorean,
	filterUnicodeRange
} = require("../common/unicode-kind");
const {
	sanitizeSymbols,
	removeUnusedFeatures,
	toPWID,
	removeDashCcmp,
	buildNexusDash
} = require("./common");

module.exports = async function makeFont(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	a.cmap_uvs = null;
	filterUnicodeRange(
		a,
		c =>
			!isIdeograph(c - 0) &&
			!isWestern(c - 0) &&
			!isKorean(c - 0) &&
			!isWS(c - 0, argv.type, argv.term)
	);

	if (argv.pwid) {
		await ctx.run(manip.glyph, "a", toPWID);
	}
	if (argv.mono) {
		await ctx.run(manip.glyph, "a", sanitizeSymbols, argv.type);
		removeDashCcmp(ctx.items.a, argv.mono);
		await ctx.run(manip.glyph, "a", buildNexusDash);
	}
	removeUnusedFeatures(ctx.items.a, argv.mono);
	await ctx.run(gc, "a", { ignoreAltSub: true });

	await ctx.run(build, "a", { to: argv.o, optimize: true });
	ctx.remove("a");
};
