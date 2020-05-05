"use strict";

module.exports = function gcFont(font, cfg) {
	markSweepOtl(font.GSUB);
	markSweepOtl(font.GPOS);
	const glyphSink = markGlyphs(font, cfg);
	sweepGlyphs(font, glyphSink);
	return [...glyphSink].sort((a, b) => a[1] - b[1]).map(x => x[0]);
};

///////////////////////////////////////////////////////////////////////////////////////////////////

function markSweepOtl(table) {
	if (!table || !table.features || !table.lookups) return;
	const accessibleLookupsIds = new Set();
	markLookups(table, accessibleLookupsIds);

	let lookups1 = {};
	for (const l in table.lookups) {
		if (accessibleLookupsIds.has(l)) lookups1[l] = table.lookups[l];
	}
	table.lookups = lookups1;

	let features1 = {};
	for (let f in table.features) {
		const feature = table.features[f];
		if (!feature) continue;
		const featureFiltered = [];
		for (const l of feature) if (accessibleLookupsIds.has(l)) featureFiltered.push(l);
		if (!featureFiltered.length) continue;
		features1[f] = featureFiltered;
	}
	table.features = features1;
}
function markLookups(gsub, lookupSet) {
	if (!gsub || !gsub.features) return;
	for (let f in gsub.features) {
		const feature = gsub.features[f];
		if (!feature) continue;
		for (const l of feature) lookupSet.add(l);
	}
	let loop = 0,
		lookupSetChanged = false;
	do {
		lookupSetChanged = false;
		let sizeBefore = lookupSet.size;
		for (const l of Array.from(lookupSet)) {
			const lookup = gsub.lookups[l];
			if (!lookup || !lookup.subtables) continue;
			if (lookup.type === "gsub_chaining" || lookup.type === "gpos_chaining") {
				for (let st of lookup.subtables) {
					if (!st || !st.apply) continue;
					for (const app of st.apply) lookupSet.add(app.lookup);
				}
			}
		}
		loop++;
		lookupSetChanged = sizeBefore !== lookupSet.size;
	} while (loop < 0xff && lookupSetChanged);
}

///////////////////////////////////////////////////////////////////////////////////////////////////

const RANK_MOST = 0;
const RANK_UNICODE_PREFERRED = 0x1000000;
const RANK_UNICODE_ALIASED = 0x2000000;
const RANK_LEAST = 0xf000000;

function simplyAdd(sink, gn) {
	if (!sink.has(gn)) sink.set(gn, RANK_LEAST);
}

function rankFromUnicode(c) {
	if (!c) return RANK_LEAST;
	// CJK aliased
	if (
		(c >= 0x2e80 && c <= 0x2fff) || // CJK radicals
		(c >= 0x3192 && c <= 0x319f) || // Ideographic annotation
		(c >= 0x31c0 && c <= 0x31ef) || // CJK strokes
		(c >= 0xf900 && c <= 0xfa6f) // CJK compatibility ideographs
	) {
		return RANK_UNICODE_ALIASED | c;
	}

	// Letter-like Symbols
	if (c >= 0x2100 && c <= 0x214f) return RANK_UNICODE_ALIASED | c;

	return RANK_UNICODE_PREFERRED | c;
}

function rankedAdd(sink, gn, rank) {
	if (!rank) simplyAdd(sink, gn);
	if (sink.has(gn)) {
		const existing = sink.get(gn);
		if (rank < existing) sink.set(gn, rank);
	} else {
		sink.set(gn, rank);
	}
}

function markGlyphs(font, cfg) {
	let glyphSink = new Map();

	if (font.glyf[".notdef"]) glyphSink.set(".notdef", RANK_MOST);

	if (font.glyph_order) {
		for (let idx = 0; idx < font.glyph_order.length; idx++) {
			const g = font.glyph_order[idx];
			if (idx === 0 || /\.notdef$/.test(g)) glyphSink.set(g, RANK_MOST);
		}
	}

	if (cfg && cfg.rankMap) {
		for (const [gn, rank] of cfg.rankMap) rankedAdd(glyphSink, gn, rank);
	}

	if (font.cmap) {
		for (const k in font.cmap) {
			if (font.cmap[k]) rankedAdd(glyphSink, font.cmap[k], rankFromUnicode(parseInt(k)));
		}
	}
	if (font.cmap_uvs) {
		for (const k in font.cmap_uvs) {
			if (font.cmap_uvs[k]) simplyAdd(glyphSink, font.cmap_uvs[k]);
		}
	}

	let glyphCount;
	do {
		glyphCount = glyphSink.size;

		if (font.GSUB) {
			for (const l in font.GSUB.lookups) {
				const lookup = font.GSUB.lookups[l];
				if (!lookup || !lookup.subtables) continue;
				if (lookup && lookup.subtables) {
					for (let st of lookup.subtables) {
						markSubtable(glyphSink, lookup.type, st, cfg);
					}
				}
			}
		}

		if (font.glyf) {
			for (const g in font.glyf) {
				const glyph = font.glyf[g];
				if (!glyph || !glyph.references) continue;
				for (const ref of glyph.references) {
					if (ref && ref.glyph) simplyAdd(glyphSink, ref.glyph);
				}
			}
		}

		let glyphCount1 = glyphSink.size;
		if (glyphCount1 === glyphCount) break;
	} while (true);
	return glyphSink;
}

function markSubtable(glyphSink, type, st, cfg) {
	switch (type) {
		case "gsub_single":
			for (const k in st) if (glyphSink.has(k) && st[k]) simplyAdd(glyphSink, st[k]);
			break;
		case "gsub_multi":
			for (const k in st)
				if (glyphSink.has(k) && st[k]) {
					for (const gTo of st[k]) simplyAdd(glyphSink, gTo);
				}
			break;
		case "gsub_alternate":
			if (!cfg || !cfg.ignoreAltSub) {
				for (const k in st)
					if (glyphSink.has(k) && st[k]) {
						for (const gTo of st[k]) simplyAdd(glyphSink, gTo);
					}
			}
			break;
		case "gsub_ligature":
			for (const sub of st.substitutions) {
				let check = true;
				for (const g of sub.from) if (!glyphSink.has(g)) check = false;
				if (check && sub.to) simplyAdd(glyphSink, sub.to);
			}
			break;
		case "gsub_chaining":
			break;
		case "gsub_reverse":
			if (st.match && st.to) {
				const matchCoverage = st.match[st.inputIndex];
				for (let j = 0; j < matchCoverage.length; j++) {
					if (glyphSink.has(matchCoverage[j]) && st.to[j]) simplyAdd(glyphSink, st.to[j]);
				}
			}
			break;
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////

function sweepGlyphs(font, glyphSink) {
	// glyf
	if (font.glyf) {
		const filteredGlyf = {};
		for (const key in font.glyf) {
			if (glyphSink.has(key)) filteredGlyf[key] = font.glyf[key];
		}
		font.glyf = filteredGlyf;
	} else {
		font.glyf = {};
	}

	// GSUB
	sweepOtl(font.GSUB, glyphSink);
}

function sweepOtl(gsub, glyphSink) {
	if (!gsub || !gsub.lookups) return;
	for (const lid in gsub.lookups) {
		const lookup = gsub.lookups[lid];
		if (!lookup.subtables) continue;
		const newSubtables = [];
		for (const st of lookup.subtables) {
			const keep = sweepSubtable(st, lookup.type, glyphSink);
			if (keep) newSubtables.push(st);
		}
		lookup.subtables = newSubtables;
	}
}

function sweepSubtable(st, type, glyphSink) {
	switch (type) {
		case "gsub_ligature": {
			if (!st.substitutions) return false;
			let newSubst = [];
			for (const rule of st.substitutions) {
				let include = true;
				if (!glyphSink.has(rule.to)) include = false;
				for (const from of rule.from) if (!glyphSink.has(from)) include = false;
				if (include) newSubst.push(rule);
			}
			st.substitutions = newSubst;
			return true;
		}
		default: {
			return true;
		}
	}
}
