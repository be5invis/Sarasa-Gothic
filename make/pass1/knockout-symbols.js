exports.knockoucSymbols = function(a, options) {
	if (options.enclosedAlphaNumerics) {
		for (let u = 0x2460; u <= 0x24ff; u++) {
			a.cmap[u] = null;
		}
	}
};
