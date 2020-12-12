"use strict";

const createFinder = require("../common/glyph-finder");

exports.toTNUM = function (font) {
	const find = createFinder(font);
	for (let c in font.cmap) {
		if (!font.cmap[c]) continue;
		font.cmap[c] = find.gname.subst("tnum", font.cmap[c]);
	}
};
