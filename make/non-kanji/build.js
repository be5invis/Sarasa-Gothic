"use strict";

const { introduce, build } = require("megaminx");
const { isIdeograph, isKorean, filterUnicodeRange } = require("../common/unicode-kind");
const gc = require("../common/gc");

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
	gc(ctx.items.a);
	await ctx.run(build, "a", { to: config.o, optimize: true });
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
