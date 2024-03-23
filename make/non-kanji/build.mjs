import { CliProc, Ot } from "ot-builder";

import { unifySameFeatures } from "../helpers/alias-feature.mjs";
import { dropCharacters, dropFeature, dropHints } from "../helpers/drop.mjs";
import { readFont, writeFont } from "../helpers/font-io.mjs";
import { isIdeograph, isKorean } from "../helpers/unicode-kind.mjs";

export default async function pass(argv) {
	const font = await readFont(argv.main);

	dropHints(font);
	dropCharacters(font, c => isIdeograph(c) || isKorean(c));
	dropFeature(font.gsub, ["dlig", "ljmo", "tjmo", "vjmo"]);

	unifySameFeatures(font.gsub);
	unifySameFeatures(font.gpos);
	CliProc.gcFont(font, Ot.ListGlyphStoreFactory);
	await writeFont(argv.o, font);
}
