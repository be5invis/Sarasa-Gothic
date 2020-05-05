"use strict";

const { introduce, build, merge } = require("megaminx");
const { italize } = require("../common/italize");
const { shareFeatures } = require("./share-features");
const gc = require("../common/gc");

module.exports = async function makeFont(ctx, config, argv) {
	await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a"
	});
	await ctx.run(introduce, "b", {
		from: argv.kanji,
		prefix: "b"
	});
	await ctx.run(introduce, "c", {
		from: argv.hangul,
		prefix: "c"
	});

	// italize
	if (argv.italize) {
		italize(ctx.items.b, 10);
		italize(ctx.items.c, 10);
	}

	await ctx.run(merge.below, "a", "a", "b", { mergeOTL: true });
	await ctx.run(merge.below, "a", "a", "c", { mergeOTL: true });
	shareFeatures(ctx.items.a.GSUB);
	shareFeatures(ctx.items.a.GPOS);

	// This will make the order of glyphs in TTC less mangled
	ctx.items.a.glyf.__glyf_pad__ = { advanceWidth: 0, contours: [[{ x: 0, y: 0, on: true }]] };
	ctx.items.a.glyph_order = gc(ctx.items.a, { rankMap: [["__glyf_pad__", 1]] });

	await ctx.run(build, "a", { to: argv.o });
};
