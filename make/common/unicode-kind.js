"use strict";

exports.isIdeograph = function(c) {
	return (
		(c >= 0x2e80 && c <= 0x2fff) || // CJK radicals
		(c >= 0x3192 && c <= 0x319f) || // CJK strokes
		(c >= 0x3300 && c <= 0x9fff) || // BMP ideographs
		(c >= 0xf900 && c <= 0xfa6f) || // CJK compatibility ideographs
		(c >= 0x20000 && c <= 0x3ffff) // SIP, TIP
	);
};

exports.isWestern = c => c < 0x2000;

exports.isKorean = c =>
	(c >= 0xac00 && c <= 0xd7af) ||
	(c >= 0x3130 && c <= 0x318f) ||
	(c >= 0x3200 && c <= 0x321e) ||
	(c >= 0xffa1 && c <= 0xffdc) ||
	(c >= 0x3260 && c <= 0x327f) ||
	(c >= 0xa960 && c <= 0xd7ff);

exports.isWS = function(c, _isType = false, isTerm = false) {
	return c >= (isTerm ? 0x2000 : 0x20a0) && c < 0x3000 && !(c >= 0x2e3a && c <= 0x2e3b);
};
