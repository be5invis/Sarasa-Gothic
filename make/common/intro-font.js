"use strict";

const GlyphPoint = require("./support/glyph-point");
const FontIo = require("./support/font-io");

module.exports = async function introFont(options) {
	const font = await FontIo.loadFont(options.from, options);
	font.em = font.head.unitsPerEm;
	if (font.glyf) for (const gid in font.glyf) font.glyf[gid] = rectifyGlyph(font.glyf[gid]);
	return font;
};

function rectifyGlyph(g) {
	if (g.contours) {
		for (const c of g.contours) {
			for (let m = 0; m < c.length; m++) c[m] = GlyphPoint.from(c[m]);
		}
	} else {
		g.contours = [];
	}
	return g;
}
