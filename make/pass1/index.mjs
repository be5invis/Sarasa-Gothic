import path from "path";
import * as url from "url";

import fs from "fs-extra";

import buildFont from "../common/build-font.mjs";
import gc from "../common/gc.mjs";
import introFont from "../common/intro-font.mjs";
import { italize } from "../common/italize.mjs";
import { mergeAbove, mergeBelow } from "../common/merge.mjs";
import rebaseFont from "../common/rebase.mjs";

import { crossTransfer } from "./cross-transfer.mjs";
import { knockoutSymbols } from "./knockout-symbols.mjs";
import { nameFont, setHintFlag } from "./metadata.mjs";
import { buildNexusDash } from "./nexus-dash.mjs";
import { toTNUM } from "./tnum.mjs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const globalConfig = fs.readJsonSync(path.resolve(__dirname, "../../config.json"));
const packageConfig = fs.readJsonSync(path.resolve(__dirname, "../../package.json"));
const ENCODINGS = globalConfig.os2encodings;
export default (async function (argv) {
	const main = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	const as = await introFont({ from: argv.asian, prefix: "b", ignoreHints: true });
	const ws = await introFont({ from: argv.ws, prefix: "c", ignoreHints: true });
	const feMisc = await introFont({ from: argv.feMisc, prefix: "d", ignoreHints: true });

	rebaseFont(main, { scale: 1000 / main.head.unitsPerEm });

	// tnum
	if (argv.tnum) toTNUM(main);
	// vhea
	main.vhea = as.vhea;
	for (let g in main.glyf) {
		main.glyf[g].verticalOrigin = main.head.unitsPerEm * 0.88;
		main.glyf[g].advanceHeight = main.head.unitsPerEm;
	}

	if (argv.italize) italize(main, -9.4);

	knockoutSymbols(main, { enclosedAlphaNumerics: !argv.mono, pua: !argv.mono });
	crossTransfer(main, as, [0x2010, 0x2011, 0x2012, 0x2013, 0x2014, 0x2015]);

	mergeBelow(main, ws, { mergeOTL: true });
	mergeAbove(main, as, { mergeOTL: true });
	mergeBelow(main, feMisc, { mergeOTL: true });

	buildNexusDash(main);
	setHintFlag(main);

	nameFont(
		main,
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

	if (argv.italize) italize(main, +9.4);

	main.glyph_order = gc(main);
	await buildFont(main, { to: argv.o });
});
