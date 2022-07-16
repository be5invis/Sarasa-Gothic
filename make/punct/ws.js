"use strict";

const introFont = require("../common/intro-font");
const buildFont = require("../common/build-font");
const {
	isWestern,
	isWS,
	isLongDash,
	filterUnicodeRange,
	isFEMisc
} = require("../common/unicode-kind");
const gc = require("../common/gc");

const { sanitizeSymbols, toPWID } = require("./sanitize-symbols");
const { removeUnusedFeatures } = require("./remove-unused-features");
const { transferMonoGeometry, unlinkRefsOfSymbols, populatePwidOfMono } = require("./lgc-handler");

module.exports = async function makeFont(argv) {
	const main = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	const lgc = await introFont({ from: argv.lgc, prefix: "b", ignoreHints: true });

	main.cmap_uvs = null;
	filterUnicodeRange(
		main,
		c => !isWestern(c - 0) && !isLongDash(c - 0, argv.term) && isWS(c - 0) && !isFEMisc(c - 0)
	);

	if (argv.pwid) toPWID(main);
	if (argv.mono) {
		unlinkRefsOfSymbols(lgc, argv.term);
		transferMonoGeometry(main, lgc);
		populatePwidOfMono(main);
	}
	if (!argv.pwid) {
		sanitizeSymbols(main, argv.goth, !argv.pwid && !argv.term);
	}

	removeUnusedFeatures(main, "WS", argv.mono);
	gc(main);

	await buildFont(main, { to: argv.o, optimize: true });
};
