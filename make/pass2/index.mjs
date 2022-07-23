import buildFont from "../common/build-font.mjs";
import gc from "../common/gc.mjs";
import introFont from "../common/intro-font.mjs";
import { italize } from "../common/italize.mjs";
import { mergeBelow } from "../common/merge.mjs";
import GlyphPoint from "../common/support/glyph-point.mjs";

import shareFeatures from "./share-features.mjs";

export default (async function makeFont(argv) {
	const a = await introFont({ from: argv.main, prefix: "a" });
	const b = await introFont({ from: argv.kanji, prefix: "b" });
	const c = await introFont({ from: argv.hangul, prefix: "c" });
	if (argv.italize) italize(b, 9.4);
	if (argv.italize) italize(c, 9.4);
	mergeBelow(a, b, { mergeOTL: true });
	mergeBelow(a, c, { mergeOTL: true });
	shareFeatures(a.GSUB);
	shareFeatures(a.GPOS);
	// This will make the order of glyphs in TTC less mangled
	a.glyf.__glyf_pad__ = { advanceWidth: 0, contours: [[GlyphPoint.cornerFromXY(0, 0)]] };
	a.glyph_order = gc(a, { rankMap: [["__glyf_pad__", 1]] });
	await buildFont(a, { to: argv.o });
});
