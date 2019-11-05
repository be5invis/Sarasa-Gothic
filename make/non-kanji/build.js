"use strict";

const { introduce, build, gc } = require("megaminx");
const { isIdeograph, isKorean, filterUnicodeRange } = require("../common/unicode-kind");

async function pass(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	filterUnicodeRange(a, c => !isIdeograph(c) && !isKorean(c));
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	await ctx.run(gc, "a");
	await ctx.run(build, "a", { to: config.o, optimize: true });
	ctx.remove("a");
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
