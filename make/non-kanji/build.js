"use strict";

const introFont = require("../common/intro-font");
const buildFont = require("../common/build-font");
const { isIdeograph, isKorean, filterUnicodeRange, isFEMisc } = require("../common/unicode-kind");
const gc = require("../common/gc");

module.exports = async function pass(argv) {
	const a = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	filterUnicodeRange(a, c => !isIdeograph(c) && !isKorean(c));
	a.cvt_ = [];
	a.fpgm = [];
	a.prep = [];
	removeUnusedFeature(a.GSUB, "dlig");
	gc(a);
	await buildFont(a, { to: argv.o, optimize: true });
};

function removeUnusedFeature(table, tag) {
	if (!table) return;
	for (let f in table.features) {
		if (f.slice(0, 4) === tag) {
			table.features[f] = null;
		}
	}
}
