import { CliProc, Ot } from "ot-builder";

import { dropCharacters, dropHints, dropOtl } from "../helpers/drop.mjs";
import { readFont, writeFont } from "../helpers/font-io.mjs";
import { sortGlyphs } from "../helpers/sort-glyphs.mjs";
import { isIdeograph } from "../helpers/unicode-kind.mjs";

export default (async function pass(argv) {
	const font = await readFont(argv.main);

	dropHints(font);
	dropOtl(font);
	dropCharacters(font, c => !isIdeograph(c));

	if (argv.classicalOverride) {
		const override = await readFont(argv.classicalOverride);
		dropCharacters(override, c => !isIdeograph(c));
		CliProc.mergeFonts(font, override, Ot.ListGlyphStoreFactory, { preferOverride: true });
	}

	CliProc.gcFont(font, Ot.ListGlyphStoreFactory);
	sortGlyphs(font);
	await writeFont(argv.o, font);
});
