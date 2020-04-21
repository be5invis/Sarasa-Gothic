"use strict";

const { introduce, build, quadify } = require("megaminx");

async function pass(ctx, config, argv) {
	await ctx.run(introduce, "a", { from: argv.main, prefix: "a", ignoreHints: true });
	await ctx.run(quadify, "a", { error: 1 / 4 });
	await ctx.run(build, "a", { to: config.o, optimize: true });
	ctx.remove("a");
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
