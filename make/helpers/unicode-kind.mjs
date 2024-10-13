export const isIdeograph = function (c) {
	return (
		(c >= 0x2e80 && c <= 0x2fff) || // CJK radicals
		(c >= 0x3192 && c <= 0x319f) || // Ideographic annotation
		(c >= 0x31c0 && c <= 0x31ef) || // CJK strokes
		(c >= 0x3400 && c <= 0x4dbf) || // ExtA
		(c >= 0x4e00 && c <= 0x9fff) || // URO
		(c >= 0xf900 && c <= 0xfa6f) || // CJK compatibility ideographs
		(c >= 0x20000 && c <= 0x3ffff) // SIP, TIP
	);
};
export const isWestern = c => (c < 0x2000 && c != 0xb7) || (c >= 0x2070 && c <= 0x218f);
export const isKorean = c =>
	(c >= 0x1100 && c <= 0x11ff) ||
	(c >= 0xac00 && c <= 0xd7af) ||
	(c >= 0x3130 && c <= 0x318f) ||
	(c >= 0x3200 && c <= 0x321e) ||
	(c >= 0xffa1 && c <= 0xffdc) ||
	(c >= 0x3260 && c <= 0x327f) ||
	(c >= 0xa960 && c <= 0xa97f) ||
	(c >= 0xd7b0 && c <= 0xd7ff);
export const isFEMisc = c =>
	(c >= 0x3003 && c <= 0x3007) ||
	(c >= 0x3012 && c <= 0x3013) ||
	(c >= 0x3020 && c <= 0x33ff) ||
	(c >= 0x1aff0 && c <= 0x1b12f) ||
	(c >= 0x1f000 && c <= 0x1f2ff);
export const isWS = function (c) {
	return (
		(((c >= 0x2000 && c <= 0x200f) || (c >= 0x20a0 && c < 0x3000)) &&
			!(c >= 0x2e3a && c <= 0x2e3b)) ||
		(c >= 0xff01 && c <= 0xff5e && !isLocaleDependentFwidPunct(c))
	);
};
export function isLocaleDependentFwidPunct(c) {
	return (
		c == 0xff01 ||
		c == 0xff08 ||
		c == 0xff09 ||
		c == 0xff0c ||
		c == 0xff0e ||
		c == 0xff1a ||
		c == 0xff1b ||
		c == 0xff3b ||
		c == 0xff3d ||
		c == 0xff5b ||
		c == 0xff5d ||
		c == 0xff1f
	);
}
export const isLongDash = function (c, isTerm) {
	return isTerm ? c === 0x2e3a || c === 0x2e3b : false;
};
export const filterUnicodeRange = function (a, fn) {
	for (let c in a.cmap) {
		if (!fn(c - 0)) a.cmap[c] = null;
	}
	if (a.cmap_uvs) {
		for (const c in a.cmap_uvs) {
			const [su, ss] = c.split(" ");
			if (!fn(su - 0)) a.cmap_uvs[c] = null;
		}
	}
};

export const isEnclosedAlphanumerics = c =>
	(c >= 0x20dd && c <= 0x20de) || (c >= 0x2460 && c <= 0x24ff) || (c >= 0x2776 && c <= 0x2788);

export const isPua = c => c >= 0xe000 && c <= 0xf8ff;
