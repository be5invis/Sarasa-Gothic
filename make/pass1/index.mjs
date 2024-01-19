import fs from "fs";
import path from "path";
import * as url from "url";

import { CliProc, Ot } from "ot-builder";

import { bakeFeature } from "../helpers/bake-feature.mjs";
import { dropCharacters, dropFeature } from "../helpers/drop.mjs";
import { readFont, writeFont } from "../helpers/font-io.mjs";
import { italize } from "../helpers/geometry.mjs";
import { isEnclosedAlphanumerics, isIdeograph, isKorean, isPua } from "../helpers/unicode-kind.mjs";

import { setFontMetadata } from "./metadata.mjs";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const globalConfig = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../config.json")));
const ENCODINGS = globalConfig.os2encodings;

export default pass;
async function pass(argv) {
	const main = await readFont(argv.main);
	const as = await readFont(argv.as);
	const ws = await readFont(argv.ws);
	const feMisc = await readFont(argv.feMisc);

	if (main.head.unitsPerEm !== 1000) CliProc.rebaseFont(main, 1000);

	if (argv.latinCfg && argv.latinCfg.bakeFeatures) {
		for (const feature of argv.latinCfg.bakeFeatures) {
			let filter = feature.range
				? c => c >= feature.range[0].codePointAt(0) && c <= feature.range[1].codePointAt(0)
				: _ => true;
			bakeFeature(feature.tag, main, filter);
		}
	}
	if (argv.latinCfg && argv.latinCfg.dropFeatures) {
		dropFeature(main.gsub, argv.latinCfg.dropFeatures);
		dropFeature(main.gpos, argv.latinCfg.dropFeatures);
	}

	initVhea(main, as);

	// Drop enclosed alphanumerics and PUA
	if (!argv.mono) dropCharacters(main, c => isEnclosedAlphanumerics(c) || isPua(c));

	// Bake tnum for UI
	if (argv.tnum) bakeFeature("tnum", main, c => c != 0x2d);

	if (argv.italize) {
		italize(as, +9.4);
		italize(ws, +9.4);
		italize(feMisc, +9.4);
	}

	CliProc.mergeFonts(main, ws, Ot.ListGlyphStoreFactory);
	CliProc.mergeFonts(main, as, Ot.ListGlyphStoreFactory, { preferOverride: true });
	CliProc.mergeFonts(main, feMisc, Ot.ListGlyphStoreFactory);

	dropCharacters(main, c => isIdeograph(c) || isKorean(c)); // Further filter out FE glyphs
	setFontMetadata(
		main,
		!!argv.mono,
		globalConfig.nameTupleSelector[argv.subfamily],
		ENCODINGS[argv.subfamily],
		{
			en_US: {
				copyright: globalConfig.copyright,
				version: `Version ${argv.version}`,
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

	CliProc.gcFont(main, Ot.ListGlyphStoreFactory);

	await writeFont(argv.o, main);
}

function initVhea(main, as) {
	main.vhea = structuredClone(as.vhea);
	for (const g of main.glyphs.decideOrder()) {
		g.vertical = {
			start: main.head.unitsPerEm * 0.88,
			end: main.head.unitsPerEm * -0.12
		};
	}
}
