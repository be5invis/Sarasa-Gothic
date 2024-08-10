import { Ot } from "ot-builder";

import { copyGeometryData, getAdvanceHeight, getAdvanceWidth } from "../helpers/geometry.mjs";
import { GlyphFinder } from "../helpers/glyph-finder.mjs";

export function buildContinuousEmDash(font) {
	const finder = new GlyphFinder(font);
	const emDash = finder.unicode(0x2014);
	const bound = Ot.GeometryUtil.apply(Ot.GeometryUtil.GetBound, emDash.geometry);

	// If the em-dash is already continuous, we are already done, and simply return
	if (bound.xMin <= 0) return;

	const emDashV = finder.subst("vert", emDash);
	const boundV = Ot.GeometryUtil.apply(Ot.GeometryUtil.GetBound, emDashV.geometry);

	// Create new glyphs, add them into font's glyph list
	const emDashCont = buildHGlyph(emDash, bound);
	const emDashVCont = buildVGlyph(emDashV, boundV);
	font.glyphs = Ot.ListGlyphStoreFactory.createStoreFromList([
		...font.glyphs.decideOrder(),
		...[emDashCont, emDashVCont]
	]);

	// Build CALT and VERT
	buildCalt(font, emDash, emDashCont);
	buildVert(font, "vert", emDash, emDashCont, emDashVCont);
	buildVert(font, "vrt2", emDash, emDashCont, emDashVCont);
}

function buildHGlyph(emDash, bound) {
	const g1 = new Ot.Glyph();

	copyGeometryData(g1, emDash);
	const adw = getAdvanceWidth(g1);
	g1.geometry = new Ot.Glyph.ContourSet([
		[
			Ot.Glyph.Point.create(bound.xMax - adw, bound.yMax, Ot.Glyph.PointType.Corner),
			Ot.Glyph.Point.create(
				bound.xMax - adw - (bound.yMax - bound.yMin) / 2,
				(bound.yMin + bound.yMax) / 2,
				Ot.Glyph.PointType.Corner
			),
			Ot.Glyph.Point.create(bound.xMax - adw, bound.yMin, Ot.Glyph.PointType.Corner),
			Ot.Glyph.Point.create(bound.xMax, bound.yMin, Ot.Glyph.PointType.Corner),
			Ot.Glyph.Point.create(bound.xMax, bound.yMax, Ot.Glyph.PointType.Corner)
		]
	]);

	return g1;
}
function buildVGlyph(emDashV, bound) {
	const g1 = new Ot.Glyph();

	copyGeometryData(g1, emDashV);
	const adh = getAdvanceHeight(g1);
	g1.geometry = new Ot.Glyph.ContourSet([
		[
			Ot.Glyph.Point.create(bound.xMin, bound.yMin, Ot.Glyph.PointType.Corner),
			Ot.Glyph.Point.create(bound.xMax, bound.yMin, Ot.Glyph.PointType.Corner),
			Ot.Glyph.Point.create(bound.xMax, bound.yMin + adh, Ot.Glyph.PointType.Corner),
			Ot.Glyph.Point.create(
				(bound.xMin + bound.xMax) / 2,
				bound.yMin + adh + (bound.xMax - bound.xMin) / 2,
				Ot.Glyph.PointType.Corner
			),
			Ot.Glyph.Point.create(bound.xMin, bound.yMin + adh, Ot.Glyph.PointType.Corner)
		]
	]);

	return g1;
}

function buildCalt(font, emDash, emDashCont) {
	const substSingle = new Ot.Gsub.Single();
	substSingle.mapping.set(emDash, emDashCont);
	font.gsub.lookups.push(substSingle);

	const substCalt = new Ot.Gsub.Chaining();
	substCalt.rules.push({
		match: [new Set([emDash, emDashCont]), new Set([emDash])],
		inputBegins: 1,
		inputEnds: 2,
		applications: [
			{
				at: 0,
				apply: substSingle
			}
		]
	});
	font.gsub.lookups.unshift(substCalt);

	const calt = { tag: "calt", lookups: [substCalt] };
	font.gsub.features.unshift(calt);
	for (const [scriptTag, script] of font.gsub.scripts) {
		if (script.defaultLanguage) script.defaultLanguage.features.unshift(calt);
		for (const [langTag, lang] of script.languages) lang.features.unshift(calt);
	}
}

function buildVert(font, tag, emDash, emDashCont, emDashVCont) {
	for (const feature of font.gsub.features) {
		if (feature.tag !== tag) continue;
		for (const lookup of feature.lookups) {
			if (lookup.type === Ot.Gsub.LookupType.Single && lookup.mapping.has(emDash)) {
				lookup.mapping.set(emDashCont, emDashVCont);
			}
		}
	}
}
