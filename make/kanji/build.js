"use strict";

const { quadify, introduce, build, gc } = require("megaminx");
const { isIdeograph } = require("../common/unicode-kind");

async function pass(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	for (let c in a.cmap) {
		if (!isIdeograph(c - 0)) a.cmap[c] = null;
	}
	await ctx.run(quadify, "a");
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	if (!config.loclFeature) {
		a.GSUB = null;
		a.GPOS = null;
	}
	await ctx.run(gc, "a");
	await ctx.run(build, "a", { to: config.o, optimize: true });
	ctx.remove("a");
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
