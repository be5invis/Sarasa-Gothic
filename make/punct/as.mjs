import buildFont from "../common/build-font.mjs";
import gc from "../common/gc.mjs";
import introFont from "../common/intro-font.mjs";
import {
	isWestern,
	isWS,
	isLongDash,
	filterUnicodeRange,
	isFEMisc
} from "../common/unicode-kind.mjs";

import { transferMonoGeometry, unlinkRefsOfSymbols, populatePwidOfMono } from "./lgc-handler.mjs";
import { removeUnusedFeatures } from "./remove-unused-features.mjs";
import { sanitizeSymbols, toPWID } from "./sanitize-symbols.mjs";
// Feature mapping
function aliasFeatMap(a, feat, aliases) {
	if (!a.GSUB || !a.GSUB.features || !a.GSUB.lookups) return;
	for (const [uFrom, uTo] of aliases) {
		const gidFrom = a.cmap[uFrom],
			gidTo = a.cmap[uTo];
		if (!gidFrom || !gidTo) continue;
		let affectedLookups = new Set();
		for (const fid in a.GSUB.features) {
			if (fid.slice(0, 4) === feat) {
				const feature = a.GSUB.features[fid];
				if (!feature) continue;
				for (const lid of feature) affectedLookups.add(lid);
			}
		}
		for (const lid of affectedLookups) {
			const lookup = a.GSUB.lookups[lid];
			if (lookup.type !== "gsub_single") continue;
			for (const subtable of lookup.subtables) {
				subtable[gidFrom] = subtable[gidTo];
			}
		}
	}
}
// Dash CCMP removal
function removeDashCcmp(a) {
	if (!a.GSUB || !a.GSUB.features || !a.GSUB.lookups) return;
	let affectedLookups = new Set();
	for (const fid in a.GSUB.features) {
		if (fid.slice(0, 4) === "ccmp") {
			const feature = a.GSUB.features[fid];
			if (!feature) continue;
			for (const lid of feature) affectedLookups.add(lid);
		}
	}
	for (const lid of affectedLookups) {
		const lookup = a.GSUB.lookups[lid];
		removeDashCcmpLookup(lookup, a.cmap);
	}
}
function removeDashCcmpLookup(lookup, cmap) {
	if (!lookup || lookup.type !== "gsub_ligature") return;
	for (const st of lookup.subtables) {
		let st1 = [];
		for (const subst of st.substitutions) {
			let valid = true;
			for (const gid of subst.from) {
				if (cmap[0x2014] === gid || cmap[0x2015] === gid) valid = false;
			}
			if (valid) st1.push(subst);
		}
		st.substitutions = st1;
	}
}
export default (async function makeFont(argv) {
	const main = await introFont({ from: argv.main, prefix: "a", ignoreHints: true });
	const lgc = await introFont({ from: argv.lgc, prefix: "b", ignoreHints: true });
	main.cmap_uvs = null;
	filterUnicodeRange(
		main,
		c => !isWestern(c - 0) && !isLongDash(c - 0, argv.term) && !isWS(c - 0) && !isFEMisc(c - 0)
	);
	if (argv.pwid) toPWID(main);
	if (argv.mono) {
		unlinkRefsOfSymbols(lgc, argv.term);
		transferMonoGeometry(main, lgc);
		populatePwidOfMono(main);
	}
	if (!argv.pwid) sanitizeSymbols(main, argv.goth, !argv.pwid && !argv.term);
	if (argv.mono) removeDashCcmp(main, argv.mono);
	removeUnusedFeatures(main, "AS", argv.mono);
	aliasFeatMap(main, "vert", [[0x2014, 0x2015]]);
	gc(main);
	await buildFont(main, { to: argv.o, optimize: true });
});
