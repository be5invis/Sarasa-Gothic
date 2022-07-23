import * as JsonUtil from "../support/json-util.mjs";

import * as GlyphClass from "./glyph-class.mjs";

class Entry {
	constructor(glyph, glyphClass, rank) {
		// We use a compressed representation to store glyphs -- to save memory, of course
		this.glyphRep = Buffer.from(JSON.stringify(glyph), "utf-8");
		this.glyphClass = glyphClass;
		this.rank = rank;
		this.used = new Set();
	}
	compareTo(that) {
		return this.glyphClass - that.glyphClass || this.rank.compare(that.rank);
	}
	getGlyph() {
		return JSON.parse(this.glyphRep.toString("utf-8"));
	}
	setGlyph(glyph) {
		this.glyphRep = Buffer.from(JSON.stringify(glyph), "utf-8");
	}
	[JsonUtil.JsonStringify]() {
		return this.glyphRep;
	}
}
export default (class SharedGlyphList {
	constructor() {
		this.glyphMap = new Map();
	}
	add(gid, glyph, gk, rank, fontIndex) {
		const existing = this.glyphMap.get(gid);
		if (existing) {
			if (existing.used.has(fontIndex)) {
				throw new Error(`Duplicate GID found in font #${fontIndex}: ${gid}`);
			}
			existing.rank.update(rank);
			existing.used.add(fontIndex);
			return existing;
		} else {
			const novel = new Entry(glyph, gk, rank, fontIndex);
			novel.used.add(fontIndex);
			this.glyphMap.set(gid, novel);
			return novel;
		}
	}
	addPostSpacePad(fontCount) {
		// Sort glyphs first
		this.sort();
		// Find simple glyphs shared across the entire font
		let allShared = [];
		for (const [gid, entry] of this.glyphMap) {
			const isSimple =
				!(entry.glyphClass & GlyphClass.Composite) &&
				(entry.glyphClass & GlyphClass.KindMask) === GlyphClass.Normal;
			const isSharable = entry.used.size === fontCount;
			if (isSimple && isSharable) allShared.push(entry);
		}
		// The particular glyph after all spaces must be a simple all-shared glyph
		// Insert a pad glyph if necessary
		let postSpace = allShared[0] || null;
		if (!postSpace) postSpace = this.createPadGlyph(".otfcc-ttcize!postSpacePad");
		postSpace.glyphClass = GlyphClass.PostSpacePad;
		// The particular glyph at very end must be a simple all-shared glyph
		// Insert a pad glyph if necessary
		let veryLast = allShared[allShared.length - 1] || null;
		if (!veryLast || veryLast === postSpace) veryLast = null;
		if (veryLast) veryLast.glyphClass = GlyphClass.VeryLast;
	}
	createPadGlyph(gid, fontCount) {
		const novel = new Entry(
			{ advanceWidth: 0, contours: [[{ x: 0, y: 0, on: true }]], references: [] },
			GlyphClass.PostSpacePad
		);
		for (let j = 0; j < fontCount; j++) novel.used.add(j);
		this.glyphMap.set(gid, novel);
		return novel;
	}
	entries() {
		return this.glyphMap.entries();
	}
	sort() {
		for (const [gid, entry] of this.glyphMap) entry.glyphClass &= ~GlyphClass.Composite;
		const glyphList = [...this.glyphMap].sort((a, b) => a[1].compareTo(b[1]));
		this.glyphMap = new Map(glyphList);
	}
	extract(f) {
		const glyph_order = [];
		const glyf = {};
		for (const [gid, entry] of this.glyphMap) {
			if (f(entry)) {
				glyph_order.push(gid);
				glyf[gid] = entry;
			}
		}
		return { glyph_order, glyf };
	}
	extractShareMap(fontCount) {
		let sharing = [];
		for (let fid = 0; fid < fontCount; fid++) {
			sharing[fid] = [];
		}
		let gIndex = 0;
		for (const [gid, entry] of this.glyphMap) {
			for (let fid = 0; fid < fontCount; fid++) {
				if (entry.used.has(fid)) {
					sharing[fid].push(gIndex);
				}
			}
			gIndex++;
		}
		return sharing;
	}
});
