import buildFont from "../common/build-font.mjs";
import gc from "../common/gc.mjs";
import introFont from "../common/intro-font.mjs";
import { mergeAbove } from "../common/merge.mjs";
import { isIdeograph, filterUnicodeRange } from "../common/unicode-kind.mjs";

export default (async function pass(argv) {
	const a = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	filterUnicodeRange(a, isIdeograph);
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	a.GSUB = null;
	a.GPOS = null;
	if (argv.classicalOverride) {
		const b = await introFont({ from: argv.classicalOverride, prefix: "b", ignoreHints: true });
		mergeAbove(a, b, { mergeOTL: true });
	}
	gc(a);
	await buildFont(a, { to: argv.o, optimize: true });
});
