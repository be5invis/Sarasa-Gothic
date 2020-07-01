"use strict";

const { introduce, build, merge } = require("megaminx");
const { isIdeograph, filterUnicodeRange } = require("../common/unicode-kind");
const gc = require("../common/gc");

async function pass(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	filterUnicodeRange(a, isIdeograph);
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	if (!config.loclFeature) {
		a.GSUB = null;
		a.GPOS = null;
	}
	if (argv.classicalOverride) {
		const b = await ctx.run(introduce, "b", {
			from: argv.classicalOverride,
			prefix: "b",
			ignoreHints: true
		});
		await ctx.run(merge.above, "a", "a", "b", { mergeOTL: true });
	}
	gc(ctx.items.a);
	await ctx.run(build, "a", { to: config.o, optimize: true });
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
