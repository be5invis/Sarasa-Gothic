import createFinder from "../common/glyph-finder.mjs";

export const toTNUM = function (font) {
	const find = createFinder(font);
	for (let c in font.cmap) {
		if (!font.cmap[c]) continue;
		font.cmap[c] = find.gname.subst("tnum", font.cmap[c]);
	}
};
