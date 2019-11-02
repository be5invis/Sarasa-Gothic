"use strict";

function deleteGPOS(font, gid) {
	if (!font.GPOS) return;
	for (let l in font.GPOS.lookups) {
		let lut = font.GPOS.lookups[l];
		switch (lut.type) {
			case "gpos_single":
				for (let st of lut.subtables) st[gid] = null;
				break;
		}
	}
}

const sanitizers = {};
sanitizers.auto = function(glyph) {
	const targetW = Math.min(
		this.em,
		Math.ceil(glyph.advanceWidth / (this.em / 2)) * (this.em / 2)
	);
	const shift = (targetW - glyph.advanceWidth) / 2;
	if (!glyph.contours) return glyph;
	for (let c of glyph.contours) for (let z of c) z.x += shift;
	glyph.advanceWidth = targetW;
	return glyph;
};
sanitizers.half = function(glyph) {
	const targetW = this.em / 2;
	const shift = (targetW - glyph.advanceWidth) / 2;
	if (!glyph.contours) return glyph;
	for (let c of glyph.contours) for (let z of c) z.x += shift;
	glyph.advanceWidth = targetW;
	return glyph;
};
sanitizers.halfLeft = function(glyph, gid) {
	const g1 = sanitizers.half.call(this, this.find.glyph$(this.find.gname.subst("pwid", gid)));
	Object.assign(glyph, g1);
	deleteGPOS(this.font, gid);
	return glyph;
};
sanitizers.halfRight = function(glyph, gid) {
	const g1 = sanitizers.half.call(this, this.find.glyph$(this.find.gname.subst("pwid", gid)));
	Object.assign(glyph, g1);
	deleteGPOS(this.font, gid);
	return glyph;
};

function HalfCompN(n, forceFullWidth, forceHalfWidth) {
	return function(glyph, gid, isType = false) {
		const g1 = this.find.glyph$(this.find.gname.subst("fwid", gid));
		Object.assign(glyph, g1);
		const targetW = Math.min(
			this.em * n,
			Math.ceil(glyph.advanceWidth / this.em) *
				(this.em * (forceHalfWidth ? 1 / 2 : isType || forceFullWidth ? 1 : 1 / 2))
		);
		if (glyph.contours) {
			for (let c of glyph.contours) for (let z of c) z.x *= targetW / glyph.advanceWidth;
		}
		glyph.advanceWidth = targetW;
		deleteGPOS(this.font, gid);
		return glyph;
	};
}

sanitizers.halfComp = HalfCompN(1);
sanitizers.halfCompH = HalfCompN(1, false, true);
sanitizers.halfComp2 = HalfCompN(2);
sanitizers.halfComp3 = HalfCompN(3);

const sanitizerTypes = {
	"“": "halfRight",
	"‘": "halfRight",
	"’": "halfLeft",
	"”": "halfLeft",
	"\u2010": "halfCompH",
	"\u2011": "halfCompH",
	"\u2012": "halfCompH",
	"\u2013": "halfCompH",
	"\u2014": "halfComp",
	"\u2015": "halfComp",
	"\u2e3a": "halfComp2",
	"\u2e3b": "halfComp3"
};

exports.sanitizeSymbols = async function sanitizeSymbols(isType) {
	let san = new Map();
	for (let c in this.font.cmap) {
		if (!this.font.cmap[c]) continue;
		const stt = sanitizerTypes[String.fromCodePoint(c - 0)];
		if (stt) san.set(this.font.cmap[c], stt);
	}
	for (let g in this.font.glyf) {
		let sanitizer = sanitizers[san.has(g) ? san.get(g) : "auto"];
		const glyph = this.font.glyf[g];
		if (!glyph) continue;
		sanitizer.call(this, glyph, g, isType);
	}
};

exports.buildNexusDash = async function() {
	let gidCovered = new Set();
	for (const u of [0x2013, 0x2014, 0x2015]) {
		const gn = this.find.gname.unicode(u);
		if (gn) gidCovered.add(gn);
	}

	const nexusLookupName = "ccmp__nexusDash";
	let nexusLookupSubst = {};
	const nexusLookup = { type: "gsub_single", subtables: [nexusLookupSubst] };
	const nexusChainingLookupName = "ccmp__nexusDash_chaining";
	let nexusChainingRules = [];
	const nexusChainingLookup = { type: "gsub_chaining", subtables: nexusChainingRules };

	for (const originalGid of gidCovered) {
		const glyph = createNexusGlyph(this.find.glyph$(originalGid));
		const nexusGid = originalGid + ".nexus";
		await this.save.to(nexusGid, null, glyph);
		nexusLookupSubst[originalGid] = nexusGid;
		nexusChainingRules.push({
			match: [[originalGid, nexusGid], [originalGid]],
			apply: [{ lookup: nexusLookupName, at: 1 }],
			inputBegins: 1,
			inputEnds: 2
		});
	}

	if (this.font.GSUB) {
		this.font.GSUB.lookups[nexusLookupName] = nexusLookup;
		this.font.GSUB.lookups[nexusChainingLookupName] = nexusChainingLookup;

		for (const fid in this.font.GSUB.features) {
			if (fid.slice(0, 4) !== "ccmp") continue;
			const feature = this.font.GSUB.features[fid];
			if (!feature) continue;
			feature.push(nexusChainingLookupName);
		}
	}
};

function createNexusGlyph(glyph) {
	let xMax = -0xffff,
		xMin = 0xffff;
	if (glyph.contours) {
		for (let c of glyph.contours) {
			for (let z of c) {
				if (z.x > xMax) xMax = z.x;
				if (z.x < xMin) xMin = z.x;
			}
		}
	}
	const rsb = glyph.advanceWidth - xMax;
	const negMin = rsb * 1.5;
	const scaling = (xMax + rsb * 1.5) / (xMax - xMin);
	if (glyph.contours) {
		for (let c of glyph.contours) {
			for (let z of c) {
				z.x = (z.x - xMin) * scaling - negMin;
			}
		}
	}
	return glyph;
}

function removeUnusedFeature(table, tag) {
	if (!table) return;
	for (let f in table.features) {
		if (f.slice(0, 4) === tag) {
			table.features[f] = null;
		}
	}
}

exports.removeUnusedFeatures = function(a, mono) {
	removeUnusedFeature(a.GSUB, "pwid");
	removeUnusedFeature(a.GSUB, "fwid");
	removeUnusedFeature(a.GSUB, "hwid");
	removeUnusedFeature(a.GSUB, "twid");
	removeUnusedFeature(a.GSUB, "qwid");

	if (mono) {
		removeUnusedFeature(a.GSUB, "aalt");
		removeUnusedFeature(a.GSUB, "locl");
		removeUnusedFeature(a.GPOS, "kern");
		removeUnusedFeature(a.GPOS, "vkrn");
		removeUnusedFeature(a.GPOS, "palt");
		removeUnusedFeature(a.GPOS, "vpal");
	}
};

exports.removeDashCcmp = function(a, mono) {
	if (!a.GSUB || !a.GSUB.features || !a.GSUB.lookups) return;

	let affectedLookups = new Set();
	for (const fid in a.GSUB.features) {
		if (fid.slice(0, 4) === "ccmp") {
			const feature = a.GSUB.features[fid];
			if (!feature) continue;
			for (const lid of feature) affectedLookups.add(lid);
		}
	}

	for (const lid of affectedLookups) {
		const lookup = a.GSUB.lookups[lid];
		removeDashCcmpLookup(lookup, a.cmap);
	}
};
function removeDashCcmpLookup(lookup, cmap) {
	if (!lookup || lookup.type !== "gsub_ligature") return;
	for (const st of lookup.subtables) {
		let st1 = [];
		for (const subst of st.substitutions) {
			let valid = true;
			for (const gid of subst.from) {
				if (cmap[0x2014] === gid || cmap[0x2015] === gid) valid = false;
			}
			if (valid) st1.push(subst);
		}
		st.substitutions = st1;
	}
}

exports.toPWID = async function() {
	const font = this.font;
	for (let c in font.cmap) {
		if (!font.cmap[c]) continue;
		if (!sanitizerTypes[String.fromCodePoint(c - 0)]) continue;
		font.cmap[c] = this.find.gname.subst("pwid", font.cmap[c]);
	}
};
