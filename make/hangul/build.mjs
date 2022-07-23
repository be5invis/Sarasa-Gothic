import buildFont from "../common/build-font.mjs";
import gc from "../common/gc.mjs";
import introFont from "../common/intro-font.mjs";
import { isKorean, filterUnicodeRange } from "../common/unicode-kind.mjs";

export default (async function pass(argv) {
	const a = await introFont({
		from: argv.main,
		prefix: "a",
		ignoreHints: true
	});
	filterUnicodeRange(a, isKorean);
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	gc(a);
	// Rectify advance width
	const em = a.head.unitsPerEm;
	for (const gid in a.glyf) {
		const glyph = a.glyf[gid];
		if (!glyph) continue;
		if (glyph.advanceWidth) {
			const expected = Math.ceil(glyph.advanceWidth / em) * em;
			const delta = (expected - glyph.advanceWidth) / 2;
			glyph.advanceWidth = expected;
			for (let c of glyph.contours) for (let z of c) z.x += delta;
		} else {
			const commonHangulWidth = 0.92 * em;
			for (let c of glyph.contours) for (let z of c) z.x -= (em - commonHangulWidth) / 2;
		}
	}
	await buildFont(a, { to: argv.o, optimize: true });
});
