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
	subst(tag, g, scriptTag, languageTag) {
		if (!this.font.gsub) return g;

		let features = this.font.gsub.features;
		let candidateLookups = [];
		if (scriptTag) {
			const script = this.font.gsub.scripts.get(scriptTag);
			const language = languageTag
				? script.languages.get(languageTag)
				: script.defaultLanguage;
			features = language.features;
		}

		for (const feature of features) {
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
