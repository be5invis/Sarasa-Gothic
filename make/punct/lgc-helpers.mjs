import { copyGeometryData } from "../helpers/geometry.mjs";
import { GlyphFinder } from "../helpers/glyph-finder.mjs";

export function transferMonoGeometry(main, lgc) {
	const find = new GlyphFinder(main);
	let uSet = new Set([0xb7]);
	for (let u = 0x2000; u < 0x20a0; u++) uSet.add(u);

	for (const u of uSet) {
		const gSrc = lgc.cmap.unicode.get(u);
		const gDst = main.cmap.unicode.get(u);
		if (gSrc && gDst) copyGeometryData(gDst, gSrc);

		const gPwid = find.subst("pwid", gDst);
		if (gPwid && gPwid !== gDst) copyGeometryData(gPwid, gDst);
	}
}
