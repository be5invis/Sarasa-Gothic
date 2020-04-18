function shareFeatures(table) {
	if (!table || !table.languages) return;
	const defaultFeatures = table.languages.DFLT_DFLT.features || [];
	for (const lid in table.languages) {
		if (isFarEast(lid)) {
			const lang = table.languages[lid];
			lang.features = Array.from(new Set(defaultFeatures, lang.features));
		}
	}
}

function isFarEast(lid) {
	return lid.slice(0, 4) === "hani" || lid.slice(0, 4) === "hang" || lid.slice(0, 4) === "kana";
}

exports.shareFeatures = shareFeatures;
