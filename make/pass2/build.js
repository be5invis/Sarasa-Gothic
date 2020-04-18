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
	gc(ctx.items.a);
	await ctx.run(build, "a", { to: argv.o, optimize: true });
};
