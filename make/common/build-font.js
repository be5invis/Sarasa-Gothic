"use strict";

const FontIo = require("./support/font-io");

module.exports = async function buildFont(font, options) {
	return await FontIo.buildFont(font, options.to, options);
};
