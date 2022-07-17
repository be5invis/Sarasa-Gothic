import GlyphPoint from "./support/glyph-point.mjs";

class GlyphNameFinder {
	constructor(font) {
		this.font = font;
	}
	unicode(_u, v) {
		let u = unicodeOf(_u);
		if (v) {
			if (
				this.font.cmap_uvs &&
				this.font.cmap_uvs[u + " " + v] &&
				this.font.glyf[this.font.cmap_uvs[u + " " + v]]
			) {
				return this.font.cmap_uvs[u + " " + v];
			}
		} else {
			if (this.font.cmap[u] && this.font.glyf[this.font.cmap[u]]) {
				return this.font.cmap[u];
			}
		}
	}
	u(u, v) {
		return this.unicode(u, v);
	}
	subst(feature, gn) {
		const font = this.font;
		if (!font.GSUB) return gn;
		let candidateLookups = [];
		for (let k in font.GSUB.features) {
			if (k.slice(0, 4) === feature && font.GSUB.features[k]) {
				for (let lookupid of font.GSUB.features[k]) candidateLookups.push(lookupid);
			}
		}
		for (let tid of candidateLookups) {
			let lookup = font.GSUB.lookups[tid];
			if (!lookup || lookup.type != "gsub_single" || !lookup.subtables) continue;
			for (let subtable of lookup.subtables) {
				if (subtable[gn]) {
					return subtable[gn];
				}
			}
		}
		return gn;
	}
}
function unicodeOf(_u) {
	if (typeof _u === "number") {
		return _u;
	} else if (typeof _u === "string") {
		return _u.codePointAt(0);
	} else {
		throw new TypeError("UnicodeOf : must be string or number.");
	}
}
class GlyphFinder {
	constructor(font, findName) {
		this.font = font;
		this.gname = findName;
	}
	glyph(gname) {
		return this.font.glyf[gname];
	}
	glyph$(gname) {
		return copyGlyph(this.glyph(gname), this.font);
	}
	unicode(u, v) {
		const gn = this.gname.unicode(u, v);
		if (gn) return this.glyph(gn);
	}
	unicode$(u, v) {
		const gn = this.gname.unicode(u, v);
		if (gn) return this.glyph$(gn);
	}
	u(u, v) {
		return this.unicode(u, v);
	}
	u$(u, v) {
		return this.unicode$(u, v);
	}
}
function copyGlyph(g, font) {
	const g1 = { ...g };
	g1.contours = [];
	g1.references = [];
	if (g.contours) {
		for (const c of g.contours) {
			let c1 = [];
			g1.contours.push(c1);
			for (const z of c) c1.push(GlyphPoint.from(z));
		}
	}
	if (g.instructions) g1.instructions = [...g.instructions];
	if (font && g.references) {
		for (let ref of g.references) {
			let g2 = copyGlyph(font.glyf[ref.glyph], font);
			if (!g2.contours) continue;
			for (const c of g2.contours) {
				let c1 = [];
				g1.contours.push(c1);
				for (const z of c) c1.push(GlyphPoint.transformedFrom(z, ref));
			}
		}
	}
	return g1;
}
export default (function createFinder(font) {
	return new GlyphFinder(font, new GlyphNameFinder(font));
});
