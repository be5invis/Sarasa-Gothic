import buildFont from "../common/build-font.mjs";
import gc from "../common/gc.mjs";
import introFont from "../common/intro-font.mjs";
import { filterUnicodeRange, isFEMisc, isLongDash, isWestern } from "../common/unicode-kind.mjs";

import { removeUnusedFeatures } from "./remove-unused-features.mjs";
import { sanitizeSymbols } from "./sanitize-symbols.mjs";

export default (async function pass(argv) {
	const main = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	filterUnicodeRange(main, c => isFEMisc(c));
	main.cvt_ = [];
	main.fpgm = [];
	main.prep = [];
	if (argv.mono) {
		removeUnusedFeatures(main.GPOS, "kern");
		removeUnusedFeatures(main.GPOS, "palt");
		removeUnusedFeatures(main.GPOS, "vkrn");
		removeUnusedFeatures(main.GPOS, "vpal");
	}
	if (!argv.pwid) sanitizeSymbols(main, argv.goth, !argv.pwid && !argv.term);
	gc(main);
	await buildFont(main, { to: argv.o, optimize: true });
});
