import { CliProc, Ot } from "ot-builder";

import { dropCharacters, dropHints, dropOtl } from "../helpers/drop.mjs";
import { readFont, writeFont } from "../helpers/font-io.mjs";
import { isIdeograph } from "../helpers/unicode-kind.mjs";

export default (async function pass(argv) {
	const font = await readFont(argv.main);

	dropHints(font);
	dropOtl(font);
	dropCharacters(font, c => !isIdeograph(c));

	if (argv.classicalOverride) {
		const b = await readFont(argv.classicalOverride);
		CliProc.mergeFonts(font, b, Ot.ListGlyphStoreFactory, { preferOverride: true });
	}

	CliProc.gcFont(font, Ot.ListGlyphStoreFactory);
	await writeFont(argv.o, font);
});
