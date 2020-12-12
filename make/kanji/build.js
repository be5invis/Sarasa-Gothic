"use strict";

const introFont = require("../common/intro-font");
const buildFont = require("../common/build-font");
const { mergeAbove } = require("../common/merge");
const { isIdeograph, filterUnicodeRange } = require("../common/unicode-kind");
const gc = require("../common/gc");

module.exports = async function pass(argv) {
	const a = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	filterUnicodeRange(a, isIdeograph);
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	a.GSUB = null;
	a.GPOS = null;
	if (argv.classicalOverride) {
		const b = await introFont({ from: argv.classicalOverride, prefix: "b", ignoreHints: true });
		mergeAbove(a, b, { mergeOTL: true });
	}
	gc(a);
	await buildFont(a, { to: argv.o, optimize: true });
};
