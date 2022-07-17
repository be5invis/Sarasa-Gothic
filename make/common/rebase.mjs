function scaleGlyph(glyph, scale) {
	glyph.em *= scale;
	glyph.advanceWidth *= scale;
	glyph.advanceHeight *= scale;
	glyph.verticalOrigin *= scale;
	delete glyph.stemH;
	delete glyph.stemV;
	delete glyph.hintMasks;
	delete glyph.contourMasks;
	delete glyph.instructions;
	if (glyph.contours) {
		for (let j = 0; j < glyph.contours.length; j++) {
			let contour = glyph.contours[j];
			for (let k = 0; k < contour.length; k++) {
				contour[k].x *= scale;
				contour[k].y *= scale;
			}
		}
	}
	if (glyph.references) {
		for (let ref of glyph.references) {
			ref.x *= scale;
			ref.y *= scale;
		}
	}
}
const GPOS_SCALER = {
	gpos_mark_to_base: scaleMarkToBase,
	gpos_mark_to_mark: scaleMarkToBase,
	gpos_mark_to_ligature: scaleMarkToLig,
	gpos_single: scaleGposSingle,
	gpos_pair: scaleGposPair
};
function scaleMarkToBase(subtable, scale) {
	for (let gid in subtable.marks) {
		subtable.marks[gid].x *= scale;
		subtable.marks[gid].y *= scale;
	}
	for (let gid in subtable.bases) {
		for (let kid in subtable.bases[gid]) {
			subtable.bases[gid][kid].x *= scale;
			subtable.bases[gid][kid].y *= scale;
		}
	}
}
function scaleMarkToLig(subtable, scale) {
	for (let gid in subtable.marks) {
		subtable.marks[gid].x *= scale;
		subtable.marks[gid].y *= scale;
	}
	for (let gid in subtable.bases) {
		for (let component of subtable.bases[gid]) {
			for (let kid in component) {
				component[kid].x *= scale;
				component[kid].y *= scale;
			}
		}
	}
}
function scaleGposValue(entry, scale) {
	return {
		dx: (entry.dx || 0) * scale,
		dy: (entry.dy || 0) * scale,
		dWidth: (entry.dWidth || 0) * scale,
		dHeight: (entry.dHeight || 0) * scale
	};
}
function scaleGposSingle(subtable, scale) {
	for (let gid in subtable) {
		subtable[gid] = scaleGposValue(subtable[gid], scale);
	}
}
function scaleGposPair(subtable, scale) {
	for (let r of subtable.matrix) {
		for (let j = 0; j < r.length; j++) {
			if (typeof r[j] === "number") r[j] *= scale;
			else {
				if (r[j].first) r[j].first = scaleGposValue(r[j].first, scale);
				if (r[j].second) r[j].second = scaleGposValue(r[j].second, scale);
			}
		}
	}
}
export default (function (font, options) {
	const { scale } = options;
	if (scale === 1) return;
	for (const gid in font.glyf) {
		scaleGlyph(font.glyf[gid], scale);
	}
	font.em *= scale;
	font.head.unitsPerEm *= scale;
	if (font.hhea) {
		font.hhea.ascender *= scale;
		font.hhea.descender *= scale;
		font.hhea.lineGap *= scale;
	}
	if (font.OS_2) {
		font.OS_2.xAvgCharWidth *= scale;
		font.OS_2.usWinAscent *= scale;
		font.OS_2.usWinDescent *= scale;
		font.OS_2.sTypoAscender *= scale;
		font.OS_2.sTypoDescender *= scale;
		font.OS_2.sTypoLineGap *= scale;
		font.OS_2.sxHeight *= scale;
		font.OS_2.sCapHeight *= scale;
		font.OS_2.ySubscriptXSize *= scale;
		font.OS_2.ySubscriptYSize *= scale;
		font.OS_2.ySubscriptXOffset *= scale;
		font.OS_2.ySubscriptYOffset *= scale;
		font.OS_2.ySupscriptXSize *= scale;
		font.OS_2.ySupscriptYSize *= scale;
		font.OS_2.ySupscriptXOffset *= scale;
		font.OS_2.ySupscriptYOffset *= scale;
		font.OS_2.yStrikeoutSize *= scale;
		font.OS_2.yStrikeoutPosition *= scale;
	}
	if (font.post) {
		font.post.underlinePosition *= scale;
		font.post.underlineThickness *= scale;
	}
	if (font.vhea) {
		font.vhea.ascender *= scale;
		font.vhea.descender *= scale;
		font.vhea.lineGap *= scale;
	}
	if (font.GPOS) {
		for (let lid in font.GPOS.lookups) {
			let lookup = font.GPOS.lookups[lid];
			if (GPOS_SCALER[lookup.type]) {
				let scaler = GPOS_SCALER[lookup.type];
				for (let subtable of lookup.subtables) scaler(subtable, scale);
			}
		}
	}
});
