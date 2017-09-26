"use strict";

const { introduce, build, quadify, gc } = require("megaminx");

module.exports = async function makeFont(ctx, config, argv) {
	const from = await ctx.run(introduce, "major", { from: argv._[0] });
	await ctx.run(quadify, "major");
	await ctx.run(gc, "major");
	await ctx.run(build, "major", { to: argv.o, sign: true });
};
