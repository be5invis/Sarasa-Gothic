import { CliProc, Ot } from "ot-builder";

import { unifySameFeatures } from "../helpers/alias-feature.mjs";
import { dropCharacters, dropHints } from "../helpers/drop.mjs";
import { readFont, writeFont } from "../helpers/font-io.mjs";
import { shiftContours } from "../helpers/geometry.mjs";
import { isKorean } from "../helpers/unicode-kind.mjs";

export default (async function pass(argv) {
	const font = await readFont(argv.main);

	dropHints(font);
	dropCharacters(font, c => !isKorean(c));
	unifySameFeatures(font.gsub);
	unifySameFeatures(font.gpos);
	CliProc.gcFont(font, Ot.ListGlyphStoreFactory);

	const em = font.head.unitsPerEm;
	const commonHangulWidth = 0.92 * em;
	for (const g of font.glyphs.decideOrder()) {
		if (g.horizontal.end > 0) {
			const expected = Math.ceil(g.horizontal.end / em) * em;
			const delta = (expected - g.horizontal.end) / 2;

			g.horizontal.end = expected;
			shiftContours(g, delta);
		} else {
			shiftContours(-(em - commonHangulWidth) / 2);
		}
	}

	await writeFont(argv.o, font);
});
