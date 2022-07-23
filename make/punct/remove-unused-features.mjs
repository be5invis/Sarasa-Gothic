function removeUnusedFeature(table, tag) {
	if (!table) return;
	for (let f in table.features) {
		if (f.slice(0, 4) === tag) {
			table.features[f] = null;
		}
	}
}
export const removeUnusedFeatures = function (a, kind, mono) {
	removeUnusedFeature(a.GSUB, "aalt");
	removeUnusedFeature(a.GSUB, "pwid");
	removeUnusedFeature(a.GSUB, "fwid");
	removeUnusedFeature(a.GSUB, "hwid");
	removeUnusedFeature(a.GSUB, "twid");
	removeUnusedFeature(a.GSUB, "qwid");
	if (mono) {
		removeUnusedFeature(a.GSUB, "locl");
		removeUnusedFeature(a.GPOS, "kern");
		removeUnusedFeature(a.GPOS, "vkrn");
		removeUnusedFeature(a.GPOS, "palt");
		removeUnusedFeature(a.GPOS, "vpal");
	}
	if (mono && kind === "WS") {
		removeUnusedFeature(a.GSUB, "ccmp");
	}
};
