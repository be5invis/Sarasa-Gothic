export const knockoutSymbols = function (a, options) {
	if (options.enclosedAlphaNumerics) {
		for (let u = 0x20dd; u <= 0x20de; u++) a.cmap[u] = null;
		for (let u = 0x2460; u <= 0x24ff; u++) a.cmap[u] = null;
		for (let u = 0x2776; u <= 0x2788; u++) a.cmap[u] = null;
	}
	if (options.pua) {
		for (let u = 0xe000; u <= 0xf8ff; u++) a.cmap[u] = null;
	}
};
