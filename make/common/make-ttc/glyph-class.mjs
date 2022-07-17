export const NotDef = 0;
export const Space = 1 << 4;
export const PostSpacePad = 2 << 4;
export const Normal = 3 << 4;
export const KindMask = 3 << 4;
export const Composite = 1 << 1;
export const CommonHeight = 1 << 2;
export const CommonWidth = 1 << 3;
export const VeryLast = 0xffff;

export const decideGlyphClass = function (glyph, gid, commonWidth, commonHeight) {
	if (gid === 0) return NotDef;
	const noContours = !glyph.contours || glyph.contours.length === 0;
	const noReferences = !glyph.references || glyph.references.length === 0;
	if (noContours && noReferences) return Space;

	let gk = Normal;
	if (!noReferences) gk |= Composite;
	if (glyph.advanceWidth === commonWidth) gk |= CommonWidth;
	if (glyph.advanceHeight === commonHeight) gk |= CommonHeight;
	return gk;
};

export const decideGlyphClassSimple = function (glyph, gid) {
	if (gid === 0) return NotDef;
	const noContours = !glyph.contours || glyph.contours.length === 0;
	const noReferences = !glyph.references || glyph.references.length === 0;
	if (noContours && noReferences) return Space;
	else return Normal;
};
