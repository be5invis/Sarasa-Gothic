export default (function gcFont(font, cfg) {
	simplifyFeatureMap(font.GSUB);
	markSweepOtl(font.GSUB);
	simplifyFeatureMap(font.GPOS);
	markSweepOtl(font.GPOS);

	const glyphSink = markGlyphs(font, cfg);
	sweepGlyphs(font, glyphSink);
	return [...glyphSink].sort((a, b) => a[1] - b[1]).map(x => x[0]);
});

///////////////////////////////////////////////////////////////////////////////////////////////////

function simplifyFeatureMap(table) {
	if (!table || !table.features || !table.lookups) return;

	const uniqueLookupListMap = new Map();

	const mergedFeatures = {};
	const knownLanguages = Object.keys(table.languages).sort();

	for (let lid of knownLanguages) {
		if (!table.languages[lid]) continue;
		const lang = JSON.parse(JSON.stringify(table.languages[lid]));
		table.languages[lid] = lang;

		let flattenFeatureTagMap_Req = {};
		let flattenFeatureTagMap = {};
		if (lang.requiredFeature) {
			addFeatureToTagMap(flattenFeatureTagMap_Req, lang.requiredFeature, table);
		}
		if (lang.features) {
			for (let f of lang.features) addFeatureToTagMap(flattenFeatureTagMap, f, table);
		}

		lang.requiredFeature = null;
		for (let tag in flattenFeatureTagMap_Req) {
			const lookups = [...new Set(flattenFeatureTagMap_Req[tag])];
			const fidNew = uniqFeature(uniqueLookupListMap, tag + "__R__" + lid, tag, lookups);
			mergedFeatures[fidNew] = lookups;
			lang.requiredFeature = fidNew;
		}

		lang.features = [];
		for (let tag in flattenFeatureTagMap) {
			const lookups = [...new Set(flattenFeatureTagMap[tag])];
			const fidNew = uniqFeature(uniqueLookupListMap, tag + "__F__" + lid, tag, lookups);
			mergedFeatures[fidNew] = lookups;
			lang.features.push(fidNew);
		}
	}
	table.features = mergedFeatures;
}

function addFeatureToTagMap(sink, fid, table) {
	if (!table.features[fid]) return;
	const tag = fid.slice(0, 4);
	if (!sink[tag]) sink[tag] = [];
	sink[tag] = [...sink[tag], ...table.features[fid]];
}

function uniqFeature(map, fid, tag, lookups) {
	const key = tag + "|" + lookups.map(x => "{" + x + "}").join("|");

	const existing = map.get(key);
	if (existing) return existing;

	map.set(key, fid);
	return fid;
}

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

// eslint-disable-next-line complexity
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
// eslint-disable-next-line complexity
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
// eslint-disable-next-line complexity
function markSubtable(glyphSink, type, st, cfg) {
	switch (type) {
		case "gsub_single":
			for (const k in st) if (glyphSink.has(k) && st[k]) simplyAdd(glyphSink, st[k]);
			break;
		case "gsub_alternate":
			if (cfg && cfg.ignoreAltSub) break;
		// falls through
		case "gsub_multiple":
			for (const k in st)
				if (glyphSink.has(k) && st[k]) {
					for (const gTo of st[k]) simplyAdd(glyphSink, gTo);
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
function sweepSubtable(st, type, gs) {
	switch (type) {
		case "gsub_single":
			return sweep_GsubSingle(st, gs);
		case "gsub_multiple":
		case "gsub_alternate":
			return sweep_GsubMultiple(st, gs);
		case "gsub_ligature":
			return sweep_GsubLigature(st, gs);
		case "gsub_chaining":
			return sweep_GsubChaining(st, gs);
		case "gsub_reverse":
			return sweep_gsubReverse(st, gs);
		default:
			return true;
	}
}
function sweep_GsubSingle(st, gs) {
	let nonEmpty = false;
	let from = Object.keys(st);
	for (const gidFrom of from) {
		if (!gs.has(gidFrom) || !gs.has(st[gidFrom])) {
			delete st[gidFrom];
		} else {
			nonEmpty = true;
		}
	}
	return nonEmpty;
}
function sweep_GsubMultiple(st, gs) {
	let nonEmpty = false;
	let from = Object.keys(st);
	for (const gidFrom of from) {
		let include = gs.has(gidFrom);
		if (st[gidFrom]) {
			for (const gidTo of st[gidFrom]) {
				include = include && gs.has(gidTo);
			}
		} else {
			include = false;
		}
		if (!include) {
			delete st[gidFrom];
		} else {
			nonEmpty = true;
		}
	}
	return nonEmpty;
}
function sweep_GsubLigature(st, gs) {
	if (!st.substitutions) return false;
	let newSubst = [];
	for (const rule of st.substitutions) {
		let include = true;
		if (!gs.has(rule.to)) include = false;
		for (const from of rule.from) if (!gs.has(from)) include = false;
		if (include) newSubst.push(rule);
	}
	st.substitutions = newSubst;
	return true;
}
function sweep_GsubChaining(st, gs) {
	const newMatch = [];
	for (let j = 0; j < st.match.length; j++) {
		newMatch[j] = [];
		for (let k = 0; k < st.match[j].length; k++) {
			const gidFrom = st.match[j][k];
			if (gs.has(gidFrom)) {
				newMatch[j].push(gidFrom);
			}
		}
		if (!newMatch[j].length) return false;
	}
	st.match = newMatch;
	return true;
}
function sweep_gsubReverse(st, gs) {
	const newMatch = [],
		newTo = [];
	for (let j = 0; j < st.match.length; j++) {
		newMatch[j] = [];
		for (let k = 0; k < st.match[j].length; k++) {
			const gidFrom = st.match[j][k];
			let include = gs.has(gidFrom);
			if (j === st.inputIndex) {
				include = include && gs.has(st.to[k]);
				if (include) {
					newMatch[j].push(gidFrom);
					newTo.push(st.to[k]);
				}
			} else {
				if (include) newMatch[j].push(gidFrom);
			}
		}
		if (!newMatch[j].length) return false;
	}
	st.match = newMatch;
	st.to = newTo;
	return true;
}
