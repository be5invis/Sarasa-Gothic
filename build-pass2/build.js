"use strict";

const { quadify, introduce, build, gc, merge: { below: merge } } = require("megaminx");
const { isKanji } = require("caryll-iddb");
const italize = require("../common/italize");
const { nameFont } = require("./metadata.js");

async function pass(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a"
	});
	const b = await ctx.run(introduce, "b", {
		from: argv.kanji,
		prefix: "b"
	});

	// italize
	if (argv.italize) italize(b, 10);
	for (let j = 300; j < b.cvt_.length; j++) {
		a.cvt_[j] = b.cvt_[j];
	}

	await ctx.run(merge, "a", "a", "b", { mergeOTL: true });
	await ctx.run(gc, "a");
	await ctx.run(nameFont, "a", {
		en_US: {
			copyright: "Copyright (c) 2017 Belleve Invis, et al.",
			version: "0.1.0",
			family: "Sarasa Gothic " + argv.subfamily,
			style: argv.style
		}
	});
	await ctx.run(build, "a", { to: config.o, optimize: true });
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
