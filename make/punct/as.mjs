import { CliProc, Ot } from "ot-builder";

import { dropCharacters, dropFeature, dropHints } from "../helpers/drop.mjs";
import { readFont, writeFont } from "../helpers/font-io.mjs";
import { isFEMisc, isLongDash, isWS, isWestern } from "../helpers/unicode-kind.mjs";

import { bakeLocalization } from "./bake-locl.mjs";
import { buildContinuousEmDash } from "./build-continuous-em-dash.mjs";
import { transferMonoGeometry } from "./lgc-helpers.mjs";
import { sanitizeSymbols, toPWID } from "./sanitize-symbols.mjs";

export default pass;
async function pass(argv) {
	const main = await readFont(argv.main);
	const lgc = await readFont(argv.lgc);

	dropHints(main);
	dropCharacters(
		main,
		c => isWestern(c - 0) || isLongDash(c - 0, argv.term) || isWS(c - 0) || isFEMisc(c - 0)
	);
	if (argv.pwid) toPWID(main, argv);
	bakeLocalization(main, argv);
	if (argv.mono) transferMonoGeometry(main, lgc);
	sanitizeSymbols(main, argv);

	dropFeature(main.gsub, ["locl", "ccmp", "aalt", "pwid", "fwid", "hwid", "twid", "qwid"]);
	if (argv.mono) dropFeature(main.gpos, ["kern", "vkrn", "halt", "palt", "vpal"]);

	buildContinuousEmDash(main);

	aliasFeatMap(main, "vert", 0x2014, 0x2015);
	CliProc.gcFont(main, Ot.ListGlyphStoreFactory);
	await writeFont(argv.o, main);
}

function aliasFeatMap(font, tag, uFrom, uTo) {
	if (!font.gsub) return;
	const gFrom = font.cmap.unicode.get(uFrom);
	const gTo = font.cmap.unicode.get(uTo);
	if (!gFrom || !gTo) return;

	let affectedLookups = [];
	for (const feature of font.gsub.features) {
		if (feature.tag === tag) {
			for (const lookup of feature.lookups) affectedLookups.push(lookup);
		}
	}

	for (const lookup of affectedLookups) {
		if (!(lookup instanceof Ot.Gsub.Single)) continue;
		let existing = lookup.mapping.get(gTo);
		if (existing) lookup.mapping.set(gFrom, existing);
	}
}
