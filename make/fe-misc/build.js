"use strict";

const introFont = require("../common/intro-font");
const buildFont = require("../common/build-font");
const { isIdeograph, isKorean, filterUnicodeRange, isFEMisc } = require("../common/unicode-kind");
const gc = require("../common/gc");

module.exports = async function pass(argv) {
	const a = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	filterUnicodeRange(a, c => !isIdeograph(c) && !isKorean(c) && isFEMisc(c));
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	gc(a);
	await buildFont(a, { to: argv.o, optimize: true });
};
