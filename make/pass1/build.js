"use strict";

const {
	quadify,
	introduce,
	build,
	gc,
	merge: { above: mergeAbove, below: mergeBelow }
} = require("megaminx");
const { isKanji } = require("caryll-iddb");
const italize = require("../common/italize");

async function pass(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	const b = await ctx.run(introduce, "b", {
		from: argv.asian,
		prefix: "b",
		ignoreHints: true
	});
	const c = await ctx.run(introduce, "c", {
		from: argv.ws,
		prefix: "c",
		ignoreHints: true
	});

	// vhea
	a.vhea = b.vhea;
	for (let g in a.glyf) {
		a.glyf[g].verticalOrigin = a.head.unitsPerEm * 0.88;
		a.glyf[g].advanceHeight = a.head.unitsPerEm;
	}

	// italize
	if (argv.italize) italize(b, 10);

	// merge and build
	await ctx.run(mergeBelow, "a", "a", "c", { mergeOTL: true });
	await ctx.run(mergeAbove, "a", "a", "b", { mergeOTL: true });

	await ctx.run(gc, "a");
	await ctx.run(build, "a", { to: config.o, optimize: true });
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
