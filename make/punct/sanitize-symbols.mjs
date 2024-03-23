import { bakeFeature } from "../helpers/bake-feature.mjs";
import {
	alterContours,
	copyGeometryData,
	flatCloneGlyph,
	getAdvanceWidth,
	setAdvanceWidth,
	shiftContours
} from "../helpers/geometry.mjs";
import { GlyphFinder } from "../helpers/glyph-finder.mjs";

export const Sanitizers = {};

// Adjust glyph metrics by CENTERING
function CenterTo(widthF) {
	return function (font, glyph, flags) {
		const em = font.head.unitsPerEm;
		const adw = getAdvanceWidth(glyph);

		const targetW = widthF(adw, em, flags);
		const shift = (targetW - adw) / 2;

		shiftContours(glyph, shift);
		setAdvanceWidth(glyph, targetW);

		return glyph;
	};
}

Sanitizers.ident = CenterTo(adw => adw);
Sanitizers.toMono = CenterTo((adw, em) => Math.min(em, Math.ceil(adw / (em / 2)) * (em / 2)));
Sanitizers.half = CenterTo((adw, em) => em / 2);
Sanitizers.full = CenterTo((adw, em) => em);
Sanitizers.ellipsis = CenterTo((adw, em, flags) => {
	if (flags.term) return 0.5 * em;
	if (flags.goth || flags.mono) return em;
	else return adw;
});
Sanitizers.interpunct = CenterTo((adw, em, flags) => {
	if (flags.mono || flags.pwid || flags.term) return em / 2;
	else return em;
});

// Adjust glyph metrics by STRETCHING
function StretchTo(widthF) {
	return function (font, glyph, flags) {
		const em = font.head.unitsPerEm;
		const adw = getAdvanceWidth(glyph);

		const targetW = widthF(adw, em, flags);

		alterContours(glyph, (x, y) => [x * 2 < adw ? x : x + targetW - adw, y]);
		setAdvanceWidth(glyph, targetW);

		return glyph;
	};
}
Sanitizers.stretchAuto = StretchTo((adw, em, flags) => (flags.pwid || flags.term ? 0.5 : 1) * em);
Sanitizers.stretchHalf = StretchTo((adw, em) => 0.5 * em);
Sanitizers.stretchDual = StretchTo((adw, em) => 2 * em);
Sanitizers.stretchTri = StretchTo((adw, em) => 3 * em);

// Left and right quotes
Sanitizers.quoteRight = function (font, glyph, flags) {
	const em = font.head.unitsPerEm;
	const finder = new GlyphFinder(font);

	if (flags.pwid) {
		copyGeometryData(
			glyph,
			Sanitizers.half(font, flatCloneGlyph(finder.subst("pwid", glyph)), flags)
		);
	}

	if (flags.goth) {
		setAdvanceWidth(glyph, em);
	} else {
		setAdvanceWidth(glyph, 0.5 * em);
	}

	return glyph;
};
Sanitizers.quoteLeft = function (font, glyph, flags) {
	const em = font.head.unitsPerEm;
	const finder = new GlyphFinder(font);

	if (flags.pwid) {
		copyGeometryData(
			glyph,
			Sanitizers.half(font, flatCloneGlyph(finder.subst("pwid", glyph)), flags)
		);
	}

	if (flags.goth) {
		shiftContours(glyph, em - getAdvanceWidth(glyph));
		setAdvanceWidth(glyph, em);
	} else {
		setAdvanceWidth(glyph, 0.5 * em);
	}

	return glyph;
};

function HalfCompN(n, forceFullWidth, forceHalfWidth) {
	return function (font, glyph, flags) {
		const em = font.head.unitsPerEm;
		const finder = new GlyphFinder(font);

		copyGeometryData(glyph, finder.subst("fwid", glyph));
		const adw = getAdvanceWidth(glyph);

		const widthScalar =
			!forceFullWidth && (forceHalfWidth || flags.pwid || flags.term) ? 0.5 : 1;
		const targetW = Math.min(em * n, Math.ceil(adw / em) * (em * widthScalar));

		alterContours(glyph, (x, y) => [(x * targetW) / adw, y]);
		setAdvanceWidth(glyph, targetW);

		return glyph;
	};
}

const sanitizerTypesModular = {
	"\u00b7": "interpunct",
	"“": "quoteLeft",
	"‘": "quoteLeft",
	"’": "quoteRight",
	"”": "quoteRight",
	"\u2010": "stretchHalf",
	"\u2011": "stretchHalf",
	"\u2012": "stretchHalf",
	"\u2013": "stretchHalf",
	"\u2014": "stretchAuto",
	"\u2015": "stretchAuto",
	"\u2025": "ellipsis",
	"\u2026": "ellipsis",
	"\u2e3a": "stretchDual",
	"\u2e3b": "stretchTri",
	"\u31b4": "half",
	"\u31b5": "half",
	"\u31b6": "half",
	"\u31b7": "half",
	"\u31bb": "half"
};

const sanitizerTypesPwid = {
	"\u00b7": "interpunct",
	"“": "ident",
	"‘": "ident",
	"’": "ident",
	"”": "ident",
	"\u2010": "half",
	"\u2025": "ellipsis",
	"\u2026": "ellipsis",
	"\u2e3a": "stretchDual",
	"\u2e3b": "stretchTri",
	"\u31b4": "half",
	"\u31b5": "half",
	"\u31b6": "half",
	"\u31b7": "half",
	"\u31bb": "half"
};

export function sanitizeSymbols(font, flags) {
	const st = flags.pwid ? sanitizerTypesPwid : sanitizerTypesModular;
	const backupSanType = flags.mono ? "toMono" : null;
	let san = new Map();

	for (const [c, g] of font.cmap.unicode.entries()) {
		const stt = st[String.fromCodePoint(c)];
		if (stt) {
			san.set(g, stt);
		} else if (backupSanType) {
			san.set(g, backupSanType);
		}
	}

	for (const g of font.glyphs.decideOrder()) {
		const st = san.get(g);
		if (!st) continue;
		const sanitizer = Sanitizers[st];
		sanitizer(font, g, flags);
	}
}
export function sanitizeSymbolsBy(font, filter, san, flags) {
	for (const [c, g] of font.cmap.unicode.entries()) {
		if (!filter(c)) continue;
		san(font, g, flags);
	}
}
export function toPWID(font, flags) {
	const st = flags.pwid ? sanitizerTypesPwid : sanitizerTypesModular;
	bakeFeature("pwid", font, c => st[String.fromCodePoint(c)]);
}
