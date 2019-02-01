"use strict";

const {
	rebase,
	introduce,
	setEncodings,
	build,
	gc,
	merge: { above: mergeAbove, below: mergeBelow }
} = require("megaminx");

const italize = require("../common/italize");
const { nameFont } = require("./metadata.js");

const fs = require("fs-extra");
const path = require("path");

const globalConfig = fs.readJsonSync(path.resolve(__dirname, "../../config.json"));
const packageConfig = fs.readJsonSync(path.resolve(__dirname, "../../package.json"));
const ENCODINGS = globalConfig.os2encodings;

async function pass(ctx, config, argv) {
	const a = await ctx.run(introduce, "a", {
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	await ctx.run(rebase, "a", { scale: 1000 / a.head.unitsPerEm });
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

	await ctx.run(nameFont, "a", {
		en_US: {
			copyright: globalConfig.version,
			version: packageConfig.version,
			family: globalConfig.families[argv.family].naming.en_US + " " + argv.subfamily,
			style: globalConfig.styles[argv.style].name
		},
		zh_CN: {
			family: globalConfig.families[argv.family].naming.zh_CN + " " + argv.subfamily,
			style: globalConfig.styles[argv.style].name
		},
		zh_TW: {
			family: globalConfig.families[argv.family].naming.zh_TW + " " + argv.subfamily,
			style: globalConfig.styles[argv.style].name
		},
		zh_HK: {
			family: globalConfig.families[argv.family].naming.zh_HK + " " + argv.subfamily,
			style: globalConfig.styles[argv.style].name
		},
		ja_JP: {
			family: globalConfig.families[argv.family].naming.ja_JP + " " + argv.subfamily,
			style: globalConfig.styles[argv.style].name
		}
	});
	await ctx.run(setEncodings, "a", ENCODINGS[argv.subfamily]);

	await ctx.run(gc, "a");
	await ctx.run(build, "a", { to: config.o, optimize: true });
}

module.exports = async function makeFont(ctx, config, argv) {
	await pass(ctx, { o: argv.o }, argv);
};
