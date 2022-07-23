export const crossTransfer = function (a, b, unicode) {
	let gidCor = [];
	for (const u of unicode) {
		const gidA = a.cmap[u];
		const gidB = b.cmap[u];
		if (!gidA || !gidB) continue;
		a.glyf[gidA] = b.glyf[gidB];
		delete b.cmap[u];
		gidCor.push(gidA, gidB);
	}
	if (b.GSUB && b.GSUB.lookups) {
		for (const lid in b.GSUB.lookups) {
			const lookup = b.GSUB.lookups[lid];
			if (lookup.type !== "gsub_single") continue;
			for (const subtable of lookup.subtables) {
				for (const [gidA, gidB] of gidCor) subtable[gidA] = subtable[gidB];
			}
		}
	}
};
