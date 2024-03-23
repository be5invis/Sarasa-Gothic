import { CliProc, Ot } from "ot-builder";

import { dropCharacters, dropFeature, dropHints } from "../helpers/drop.mjs";
import { readFont, writeFont } from "../helpers/font-io.mjs";
import { isFEMisc } from "../helpers/unicode-kind.mjs";

import { sanitizeSymbols } from "./sanitize-symbols.mjs";

export default pass;
async function pass(argv) {
	const font = await readFont(argv.main);

	dropHints(font);
	dropCharacters(font, c => !isFEMisc(c));
	if (argv.mono) dropFeature(font.gpos, ["kern", "palt", "vkrn", "vpal"]);

	sanitizeSymbols(font, argv);
	CliProc.gcFont(font, Ot.ListGlyphStoreFactory);
	await writeFont(argv.o, font);
}
