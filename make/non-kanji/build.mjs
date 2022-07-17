import buildFont from "../common/build-font.mjs";
import gc from "../common/gc.mjs";
import introFont from "../common/intro-font.mjs";
import { isIdeograph, isKorean, filterUnicodeRange, isFEMisc } from "../common/unicode-kind.mjs";

function removeUnusedFeature(table, tag) {
	if (!table) return;
	for (let f in table.features) {
		if (f.slice(0, 4) === tag) {
			table.features[f] = null;
		}
	}
}
export default (async function pass(argv) {
	const a = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	filterUnicodeRange(a, c => !isIdeograph(c) && !isKorean(c));
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	removeUnusedFeature(a.GSUB, "dlig");
	gc(a);
	await buildFont(a, { to: argv.o, optimize: true });
});
