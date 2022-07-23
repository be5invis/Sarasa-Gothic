function scriptNameMatch(lid, tag) {
	return lid.slice(0, 4).trim() === tag;
}
function languageNameMatch(lid, tag) {
	return lid.slice(5, 9).trim() === tag;
}
function isFarEast(lid) {
	return (
		scriptNameMatch(lid, "hani") ||
		scriptNameMatch(lid, "kana") ||
		scriptNameMatch(lid, "bopo") ||
		scriptNameMatch(lid, "hang") ||
		languageNameMatch(lid, "JAN") ||
		languageNameMatch(lid, "KOR") ||
		languageNameMatch(lid, "ZHS") ||
		languageNameMatch(lid, "ZHT") ||
		languageNameMatch(lid, "ZHH")
	);
}
export default (function shareFeatures(table) {
	if (!table || !table.languages) return;
	const defaultFeatures = table.languages.DFLT_DFLT.features || [];
	for (const lid in table.languages) {
		if (isFarEast(lid)) {
			const lang = table.languages[lid];
			lang.features = Array.from(new Set(defaultFeatures, lang.features));
		}
	}
});
