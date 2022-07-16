"use strict";

const introFont = require("../common/intro-font");
const buildFont = require("../common/build-font");
const { filterUnicodeRange, isFEMisc, isLongDash, isWestern } = require("../common/unicode-kind");
const gc = require("../common/gc");
const { removeUnusedFeatures } = require("./remove-unused-features");
const { sanitizeSymbols } = require("./sanitize-symbols");

module.exports = async function pass(argv) {
	const main = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	filterUnicodeRange(main, c => isFEMisc(c));
	main.cvt_ = [];
	main.fpgm = [];
	main.prep = [];
	if (argv.mono) {
		removeUnusedFeatures(main.GPOS, "kern");
		removeUnusedFeatures(main.GPOS, "palt");
		removeUnusedFeatures(main.GPOS, "vkrn");
		removeUnusedFeatures(main.GPOS, "vpal");
	}
	if (!argv.pwid) sanitizeSymbols(main, argv.goth, !argv.pwid && !argv.term);

	gc(main);
	await buildFont(main, { to: argv.o, optimize: true });
};
