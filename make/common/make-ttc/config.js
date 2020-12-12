"use strict";

const which = require("which");

module.exports = function (argv) {
	return {
		inputs: [...argv.inputs],
		output: argv.output,
		filterLoop: argv.filterLoop,
		ttxLoop: argv.ttxLoop,
		commonWidth: argv["common-width"] - 0 || -1,
		commonHeight: argv["common-height"] - 0 || -1
	};
};
