import buildFont from "../common/build-font.mjs";
import gc from "../common/gc.mjs";
import introFont from "../common/intro-font.mjs";
import {
	isWestern,
	isWS,
	isLongDash,
	filterUnicodeRange,
	isFEMisc
} from "../common/unicode-kind.mjs";

import { transferMonoGeometry, unlinkRefsOfSymbols, populatePwidOfMono } from "./lgc-handler.mjs";
import { removeUnusedFeatures } from "./remove-unused-features.mjs";
import { sanitizeSymbols, toPWID } from "./sanitize-symbols.mjs";

export default (async function makeFont(argv) {
	const main = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	const lgc = await introFont({ from: argv.lgc, prefix: "b", ignoreHints: true });
	main.cmap_uvs = null;
	filterUnicodeRange(
		main,
		c => !isWestern(c - 0) && !isLongDash(c - 0, argv.term) && isWS(c - 0) && !isFEMisc(c - 0)
	);
	if (argv.pwid) toPWID(main);
	if (argv.mono) {
		unlinkRefsOfSymbols(lgc, argv.term);
		transferMonoGeometry(main, lgc);
		populatePwidOfMono(main);
	}
	if (!argv.pwid) {
		sanitizeSymbols(main, argv.goth, !argv.pwid && !argv.term);
	}
	removeUnusedFeatures(main, "WS", argv.mono);
	gc(main);
	await buildFont(main, { to: argv.o, optimize: true });
});
