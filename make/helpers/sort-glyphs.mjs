import { Ot } from "ot-builder";

export function sortGlyphs(font) {
	const m = new Map();
	for (const [id, g] of font.glyphs.decideOrder().entries()) {
		m.set(g, new SortGlyphEntry(id === 0 ? 0 : 1, 0xffffff, 0xffffff, g));
	}
	if (font.cmap) {
		for (const [ch, vs, g] of font.cmap.vs.entries()) {
			const entry = m.get(g);
			if (ch < entry.u || (ch === entry.u && vs < entry.v)) {
				entry.u = ch;
				entry.v = vs;
			}
		}
		for (const [ch, g] of font.cmap.unicode.entries()) {
			const entry = m.get(g);
			if (ch <= entry.u) {
				entry.u = ch;
				entry.v = 0;
			}
		}
	}

	const sorted = Array.from(m.values())
		.sort((a, b) => a.compare(b))
		.map(a => a.g);
	font.glyphs = Ot.ListGlyphStoreFactory.createStoreFromList(sorted);
}

class SortGlyphEntry {
	constructor(rank, u, v, g) {
		this.rank = rank;
		this.u = u;
		this.v = v;
		this.g = g;
	}

	compare(that) {
		return this.rank - that.rank || this.u - that.u || this.v - that.v || 0;
	}
}
