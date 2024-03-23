import { GlyphFinder } from "./glyph-finder.mjs";

export function bakeFeature(tag, font, filter, scriptTag, languageTag) {
	const find = new GlyphFinder(font);
	for (const [c, g] of font.cmap.unicode.entries()) {
		if (!filter(c)) continue;
		font.cmap.unicode.set(c, find.subst(tag, g, scriptTag, languageTag));
	}
}
