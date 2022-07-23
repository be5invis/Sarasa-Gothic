function getUnicodeAliasingLikes(c) {
	// CJK aliased
	if (
		(c >= 0x2e80 && c <= 0x2fff) || // CJK radicals
		(c >= 0x3192 && c <= 0x319f) || // Ideographic annotation
		(c >= 0x31c0 && c <= 0x31ef) // CJK strokes
	) {
		return 1;
	}
	// Letter-like Symbols
	if (c >= 0x2100 && c <= 0x214f) return 1;
	return 0;
}
function preferUnicodeOver(a, b) {
	const pa = getUnicodeAliasingLikes(a);
	const pb = getUnicodeAliasingLikes(b);
	return pa < pb || (pa === pb && a < b);
}
class ShapeHintResolver {
	constructor() {
		this.mappings = new Map();
	}
}
class RankFactory {
	constructor(shr, fontIndex, font) {
		this.fontIndex = fontIndex;
		const revCharCodeMap = new Map();
		this.revCharCodeMap = revCharCodeMap;
		this.shapeHintIndex = 0xffffff;
		if (font.cmap) {
			for (const _u in font.cmap) {
				const u = parseInt(_u);
				if (!u) continue;
				let existing = revCharCodeMap.get(font.cmap[_u]);
				if (!existing || preferUnicodeOver(u, existing))
					revCharCodeMap.set(font.cmap[_u], u);
			}
			let shapeHint = "";
			for (const lch of ".,+-(=)") {
				const gid = font.cmap[lch.codePointAt(0)];
				shapeHint += `{${gid}}`;
			}
			if (shr.mappings.has(shapeHint)) {
				this.shapeHintIndex = shr.mappings.get(shapeHint);
			} else {
				this.shapeHintIndex = fontIndex;
				shr.mappings.set(shapeHint, fontIndex);
			}
		}
	}
	decideForGlyph(glyphIndex, glyphName) {
		return new GlyphRank(
			this.shapeHintIndex,
			this.revCharCodeMap.get(glyphName) || 0xffffff,
			this.fontIndex,
			glyphIndex
		);
	}
}
class GlyphRank {
	constructor(shapeHintIndex, unicodeIndex, fontIndex, glyphIndex) {
		this.shapeHintIndex = shapeHintIndex;
		this.unicodeIndex = unicodeIndex;
		this.fontIndex = fontIndex;
		this.glyphIndex = glyphIndex;
	}
	update(other) {
		if (other.unicodeIndex && preferUnicodeOver(other.unicodeIndex, this.unicodeIndex))
			this.unicodeIndex = other.unicodeIndex;
	}
	compare(other) {
		return (
			this.shapeHintIndex - other.shapeHintIndex ||
			this.unicodeIndex - other.unicodeIndex ||
			this.fontIndex - other.fontIndex ||
			this.glyphIndex - other.glyphIndex
		);
	}
}
export { ShapeHintResolver };
export { RankFactory };
export { GlyphRank };
