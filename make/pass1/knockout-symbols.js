exports.knockoutSymbols = function (a, options) {
	if (options.enclosedAlphaNumerics) {
		for (let u = 0x2460; u <= 0x24ff; u++) a.cmap[u] = null;
	}
	if (options.pua) {
		for (let u = 0xe000; u <= 0xf8ff; u++) a.cmap[u] = null;
	}
};
