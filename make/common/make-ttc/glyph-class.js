"use strict";

exports.NotDef = 0;
exports.Space = 1 << 4;
exports.PostSpacePad = 2 << 4;
exports.Normal = 3 << 4;
exports.KindMask = 3 << 4;

exports.Composite = 1 << 1;
exports.CommonHeight = 1 << 2;
exports.CommonWidth = 1 << 3;

exports.VeryLast = 0xffff;

exports.decideGlyphClass = function (glyph, gid, commonWidth, commonHeight) {
	if (gid === 0) return exports.NotDef;

	const noContours = !glyph.contours || glyph.contours.length === 0;
	const noReferences = !glyph.references || glyph.references.length === 0;
	if (noContours && noReferences) return exports.Space;

	let gk = exports.Normal;
	if (!noReferences) gk |= exports.Composite;
	if (glyph.advanceWidth === commonWidth) gk |= exports.CommonWidth;
	if (glyph.advanceHeight === commonHeight) gk |= exports.CommonHeight;

	return gk;
};

exports.decideGlyphClassSimple = function (glyph, gid) {
	if (gid === 0) return exports.NotDef;
	const noContours = !glyph.contours || glyph.contours.length === 0;
	const noReferences = !glyph.references || glyph.references.length === 0;
	if (noContours && noReferences) return exports.Space;
	else return exports.Normal;
};
