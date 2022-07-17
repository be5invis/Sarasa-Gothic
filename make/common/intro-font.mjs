import * as FontIo from "./support/font-io.mjs";
import GlyphPoint from "./support/glyph-point.mjs";

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
export default (async function introFont(options) {
	const font = await FontIo.loadFont(options.from, options);
	font.em = font.head.unitsPerEm;
	if (font.glyf) for (const gid in font.glyf) font.glyf[gid] = rectifyGlyph(font.glyf[gid]);
	return font;
});
