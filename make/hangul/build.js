"use strict";

const { introduce, build, gc } = require("megaminx");
const { isKorean, filterUnicodeRange } = require("../common/unicode-kind");

async function pass(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	filterUnicodeRange(a, isKorean);
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	await ctx.run(gc, "a");

	// Rectify advance width
	const em = a.head.unitsPerEm;
	for (const gid in a.glyf) {
		const glyph = a.glyf[gid];
		if (!glyph) continue;
		if (glyph.advanceWidth) {
			const expected = Math.ceil(glyph.advanceWidth / em) * em;
			const delta = (expected - glyph.advanceWidth) / 2;
			glyph.advanceWidth = expected;
			for (let c of glyph.contours) for (let z of c) z.x += delta;
		} else {
			const commonHangulWidth = 0.92 * em;
			for (let c of glyph.contours) for (let z of c) z.x -= (em - commonHangulWidth) / 2;
		}
	}
	await ctx.run(build, "a", { to: config.o, optimize: true });
	ctx.remove("a");
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
