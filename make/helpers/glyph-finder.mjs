import { Ot } from "ot-builder";

export class GlyphFinder {
	constructor(font) {
		this.font = font;
	}
	unicode(u, v) {
		if (v) {
			return this.font.cmap.uv.get(u, v);
		} else {
			return this.font.cmap.unicode.get(u);
		}
	}
	subst(tag, g) {
		if (!this.font.gsub) return g;

		let candidateLookups = [];
		for (const feature of this.font.gsub.features) {
			if (feature.tag === tag) {
				for (const lookup of feature.lookups) candidateLookups.push(lookup);
			}
		}

		for (const lookup of candidateLookups) {
			if (!(lookup instanceof Ot.Gsub.Single)) continue;
			let mapped = lookup.mapping.get(g);
			if (mapped) return mapped;
		}

		return g;
	}
}
