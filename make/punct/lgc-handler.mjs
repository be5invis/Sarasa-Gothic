import createFinder from "../common/glyph-finder.mjs";

function HCopy(g, g1) {
	g.contours = g1.contours;
	g.references = g1.references;
	g.advanceWidth = g1.advanceWidth;
}
export const unlinkRefsOfSymbols = function (font, isTerm) {
	const find = createFinder(font);
	for (let u = 0x2000; u < 0x20a0; u++) {
		let gn = find.gname.unicode(u);
		if (!gn) continue;
		let gnT = gn;
		if (!isTerm) gnT = find.gname.subst("WWID", gn);
		if (!gnT) continue;
		const g = find.glyph(gn);
		const g$ = find.glyph$(gnT);
		HCopy(g, g$);
	}
};
export const transferMonoGeometry = function (main, lgc) {
	for (let u = 0x2000; u < 0x20a0; u++) {
		let gnSrc = main.cmap[u],
			gnDst = lgc.cmap[u];
		if (gnSrc && gnDst) {
			HCopy(main.glyf[gnSrc], lgc.glyf[gnDst]);
		}
	}
};
export const populatePwidOfMono = function (font) {
	const find = createFinder(font);
	for (let u = 0x2000; u < 0x20a0; u++) {
		const gn = find.gname.unicode(u);
		if (!gn) continue;
		const gnPwid = find.gname.subst("pwid", gn);
		if (!gnPwid) continue;
		const g = find.glyph(gnPwid);
		const g$ = find.glyph$(gn);
		HCopy(g, g$);
	}
};
