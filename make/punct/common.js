"use strict";

exports.isWestern = c => c < 0x2000;
exports.isKorean = c =>
	(c >= 0xac00 && c <= 0xd7af) ||
	(c >= 0x3130 && c <= 0x318f) ||
	(c >= 0x3200 && c <= 0x321e) ||
	(c >= 0xffa1 && c <= 0xffdc) ||
	(c >= 0x3260 && c <= 0x327f) ||
	(c >= 0xa960 && c <= 0xd7ff);

exports.isWS = function(c, isType = false, isTerm = false) {
	return c >= (isTerm ? 0x2000 : 0x20a0) && c < 0x3000 && !(c >= 0x2e3a && c <= 0x2e3b);
};

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

function HalfCompN(n, ov) {
	return function(glyph, gid, isType = false) {
		const targetW = Math.min(
			this.em * n,
			Math.ceil(glyph.advanceWidth / this.em) * (this.em * (isType || ov ? 1 : 1 / 2))
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
sanitizers.halfComp2 = HalfCompN(2);
sanitizers.halfComp3 = HalfCompN(3);

const sanitizerTypes = {
	"“": "halfRight",
	"‘": "halfRight",
	"’": "halfLeft",
	"”": "halfLeft",
	"—": "halfComp",
	"\u2013": "halfComp",
	"\u2011": "halfComp",
	"\u2012": "halfComp",
	"\u2010": "halfComp",
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

exports.removeUnusedFeatures = function(a, mono) {
	for (let f in a.GSUB.features) {
		if (
			f.slice(0, 4) === "pwid" ||
			f.slice(0, 4) === "hwid" ||
			f.slice(0, 4) === "fwid" ||
			f.slice(0, 4) === "twid" ||
			f.slice(0, 4) === "qwid"
		) {
			for (let l of a.GSUB.features[f]) {
				a.GSUB.lookups[l] = null;
			}
			a.GSUB.features[f] = null;
		}
	}
	if (mono && a.GPOS) {
		for (let f in a.GPOS.features) {
			if (
				f.slice(0, 4) === "kern" ||
				f.slice(0, 4) === "vkrn" ||
				f.slice(0, 4) === "palt" ||
				f.slice(0, 4) === "vpal"
			) {
				for (let l of a.GPOS.features[f]) {
					a.GPOS.lookups[l] = null;
				}
				a.GPOS.features[f] = null;
			}
		}
	}
};

exports.toPWID = async function() {
	const font = this.font;
	for (let c in font.cmap) {
		if (!font.cmap[c]) continue;
		if (!sanitizerTypes[String.fromCodePoint(c - 0)]) continue;
		font.cmap[c] = this.find.gname.subst("pwid", font.cmap[c]);
	}
};
