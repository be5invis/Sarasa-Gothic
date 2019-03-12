"use strict";

const { quadify, introduce, build, gc, merge: { below: merge } } = require("megaminx");
const { isKanji } = require("caryll-iddb");
const italize = require("../common/italize");

const fs = require("fs-extra");
const path = require("path");

const hintingConfig = fs.readJsonSync(path.resolve(__dirname, "../../hinting-config.json"));

module.exports = async function makeFont(ctx, config, argv) {
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
	for (let j = hintingConfig.settings.cvt_padding; j < b.cvt_.length; j++) {
		a.cvt_[j] = b.cvt_[j];
	}

	await ctx.run(merge, "a", "a", "b", { mergeOTL: true });
	await ctx.run(gc, "a");

	await ctx.run(build, "a", { to: argv.o, optimize: true });
};
