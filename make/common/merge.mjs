export function mergeAbove(major, side, config) {
	config = config || {};
	const gid0 = side.glyph_order[0];
	for (const unicode in side.cmap) {
		if (unicode - 0 <= 0x20 || !side.cmap[unicode] || side.cmap[unicode] === gid0) continue;
		major.cmap[unicode] = side.cmap[unicode];
	}
	if (side.cmap_uvs) {
		if (!major.cmap_uvs) major.cmap_uvs = {};
		for (const key in side.cmap_uvs) {
			if (!side.cmap_uvs[key] || side.cmap_uvs[key] === gid0) continue;
			major.cmap_uvs[key] = side.cmap_uvs[key];
		}
	}
	for (const gid in side.glyf) {
		if (gid === gid0) continue;
		major.glyf[gid] = side.glyf[gid];
	}
	if (config.mergeOTL) {
		mergeOTLTables(major.GSUB, side.GSUB, true);
		mergeOTLTables(major.GPOS, side.GPOS, true);
		major.GDEF = mergeGDEF(major.GDEF || {}, side.GDEF || {});
	}
}

export function mergeBelow(major, side, config) {
	config = config || {};
	for (const unicode in side.cmap) {
		if (major.cmap[unicode]) continue;
		major.cmap[unicode] = side.cmap[unicode];
	}
	if (side.cmap_uvs) {
		if (!major.cmap_uvs) major.cmap_uvs = {};
		for (const key in side.cmap_uvs) {
			if (major.cmap_uvs[key]) continue;
			major.cmap_uvs[key] = side.cmap_uvs[key];
		}
	}
	for (const gid in side.glyf) {
		major.glyf[gid] = side.glyf[gid];
	}
	if (config.mergeOTL) {
		mergeOTLTables(major.GSUB, side.GSUB, false);
		mergeOTLTables(major.GPOS, side.GPOS, false);
		major.GDEF = mergeGDEF(side.GDEF || {}, major.GDEF || {});
	}
}

function mergeOTLTables(dst, src, priorizeSrc) {
	if (!dst || !src) return;

	for (const fid in src.features) dst.features[fid] = src.features[fid];
	for (const lid in src.lookups) dst.lookups[lid] = src.lookups[lid];

	for (const lid in src.languages) {
		if (dst.languages[lid]) {
			dst.languages[lid].features = [
				...dst.languages[lid].features,
				...src.languages[lid].features
			];
		} else {
			dst.languages[lid] = src.languages[lid];
		}
	}

	if (priorizeSrc) {
		dst.lookupOrder = [src.lookupOrder || [], dst.lookupOrder || []];
	} else {
		dst.lookupOrder = [dst.lookupOrder || [], src.lookupOrder || []];
	}
}

function mergeGDEF(first, second) {
	return {
		markAttachClassDef: Object.assign({}, first.markAttachClassDef, second.markAttachClassDef),
		glyphClassDef: Object.assign({}, first.glyphClassDef, second.glyphClassDef),
		ligCarets: Object.assign({}, first.ligCarets, second.ligCarets)
	};
}
