import createFinder from "../common/glyph-finder.mjs";

function createNexusGlyph(glyph) {
	let xMax = -0xffff,
		xMin = 0xffff;
	if (glyph.contours) {
		for (let c of glyph.contours) {
			for (let z of c) {
				if (z.x > xMax) xMax = z.x;
				if (z.x < xMin) xMin = z.x;
			}
		}
	}
	const rsb = glyph.advanceWidth - xMax;
	const negMin = rsb * 1.5;
	const scaling = (xMax + rsb * 1.5) / (xMax - xMin);
	if (glyph.contours) {
		for (let c of glyph.contours) {
			for (let z of c) {
				z.x = (z.x - xMin) * scaling - negMin;
			}
		}
	}
	return glyph;
}
export const buildNexusDash = function (font) {
	const find = createFinder(font);
	let gidCovered = new Set();
	for (const u of [0x2013, 0x2014, 0x2015]) {
		const gn = find.gname.unicode(u);
		if (gn) gidCovered.add(gn);
	}
	const nexusLookupName = "ccmp__nexusDash";
	let nexusLookupSubst = {};
	const nexusLookup = { type: "gsub_single", subtables: [nexusLookupSubst] };
	const nexusChainingLookupName = "ccmp__nexusDash_chaining";
	let nexusChainingRules = [];
	const nexusChainingLookup = { type: "gsub_chaining", subtables: nexusChainingRules };
	for (const originalGid of gidCovered) {
		const glyph = createNexusGlyph(find.glyph$(originalGid));
		const nexusGid = originalGid + ".nexus";
		font.glyf[nexusGid] = glyph;
		nexusLookupSubst[originalGid] = nexusGid;
		nexusChainingRules.push({
			match: [[originalGid, nexusGid], [originalGid]],
			apply: [{ lookup: nexusLookupName, at: 1 }],
			inputBegins: 1,
			inputEnds: 2
		});
	}
	if (font.GSUB) {
		font.GSUB.lookups[nexusLookupName] = nexusLookup;
		font.GSUB.lookups[nexusChainingLookupName] = nexusChainingLookup;
		for (const fid in font.GSUB.features) {
			if (fid.slice(0, 4) !== "ccmp") continue;
			const feature = font.GSUB.features[fid];
			if (!feature) continue;
			feature.push(nexusChainingLookupName);
		}
	}
};
