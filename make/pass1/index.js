"use strict";

const rebaseFont = require("../common/rebase");
const introFont = require("../common/intro-font");
const buildFont = require("../common/build-font");
const { mergeAbove, mergeBelow } = require("../common/merge");

const { italize } = require("../common/italize");
const { nameFont, setHintFlag } = require("./metadata.js");
const { crossTransfer } = require("./cross-transfer");
const { knockoutSymbols } = require("./knockout-symbols");
const { buildNexusDash } = require("./nexus-dash");
const { toTNUM } = require("./tnum");
const gc = require("../common/gc");

const fs = require("fs-extra");
const path = require("path");

const globalConfig = fs.readJsonSync(path.resolve(__dirname, "../../config.json"));
const packageConfig = fs.readJsonSync(path.resolve(__dirname, "../../package.json"));
const ENCODINGS = globalConfig.os2encodings;

module.exports = async function (argv) {
	const a = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	const b = await introFont({ from: argv.asian, prefix: "b", ignoreHints: true });
	const c = await introFont({ from: argv.ws, prefix: "c", ignoreHints: true });

	rebaseFont(a, { scale: 1000 / a.head.unitsPerEm });

	// tnum
	if (argv.tnum) toTNUM(a);

	// vhea
	a.vhea = b.vhea;
	for (let g in a.glyf) {
		a.glyf[g].verticalOrigin = a.head.unitsPerEm * 0.88;
		a.glyf[g].advanceHeight = a.head.unitsPerEm;
	}

	if (argv.italize) italize(a, -9.4);

	knockoutSymbols(a, { enclosedAlphaNumerics: !argv.mono, pua: !argv.mono });
	crossTransfer(a, b, [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015]);
	mergeBelow(a, c, { mergeOTL: true });
	mergeAbove(a, b, { mergeOTL: true });

	buildNexusDash(a);
	setHintFlag(a);

	nameFont(
		a,
		!!argv.mono,
		globalConfig.nameTupleSelector[argv.subfamily],
		ENCODINGS[argv.subfamily],
		{
			en_US: {
				copyright: globalConfig.copyright,
				version: `Version ${packageConfig.version}`,
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
		}
	);

	if (argv.italize) italize(a, +9.4);
	a.glyph_order = gc(a);
	await buildFont(a, { to: argv.o });
};
