"use strict";

module.exports = function ReverseGidMap(glyphOrder) {
	const map = new Map();
	for (let j = 0; j < glyphOrder.length; j++) map.set(glyphOrder[j], j);
	return map;
};
