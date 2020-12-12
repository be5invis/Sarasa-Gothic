"use strict";

const introFont = require("../common/intro-font");
const buildFont = require("../common/build-font");
const {
	isIdeograph,
	isWestern,
	isWS,
	isKorean,
	isLongDash,
	filterUnicodeRange
} = require("../common/unicode-kind");
const { sanitizeSymbols, removeUnusedFeatures, toPWID } = require("./common");
const gc = require("../common/gc");

module.exports = async function makeFont(argv) {
	const a = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	a.cmap_uvs = null;
	filterUnicodeRange(
		a,
		c =>
			!isIdeograph(c - 0) &&
			!isWestern(c - 0) &&
			!isKorean(c - 0) &&
			!isLongDash(c - 0, argv.term) &&
			isWS(c - 0)
	);

	if (argv.pwid) toPWID(a);
	if (argv.mono) sanitizeSymbols(a, argv.goth, !argv.pwid && !argv.term);

	removeUnusedFeatures(a, "WS", argv.mono);
	gc(a);

	await buildFont(a, { to: argv.o, optimize: true });
};
