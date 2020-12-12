"use strict";

const rebaseFont = require("../common/rebase");
const quadifyFont = require("../common/quadify");
const introFont = require("../common/intro-font");
const buildFont = require("../common/build-font");

module.exports = async function pass(argv) {
	const a = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	rebaseFont(a, { scale: 1000 / a.head.unitsPerEm });
	quadifyFont(a);
	await buildFont(a, { to: argv.o, optimize: true });
};
