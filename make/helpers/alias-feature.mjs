export function unifySameFeatures(table) {
	if (!table || !table.scripts || !table.features) return;

	let nonAliasable = [];
	let aliases = new Map();

	out: for (const feature of table.features) {
		for (const existing of nonAliasable) {
			if (featureAliasable(existing, feature)) {
				aliases.set(feature, existing);
				continue out;
			}
		}
		nonAliasable.push(feature);
	}

	for (const script of table.scripts.values()) {
		if (script.defaultLanguage) processLang(script.defaultLanguage, aliases);
		for (const lang of script.languages.values()) processLang(lang, aliases);
	}
}

function processLang(lang, aliases) {
	if (lang.requiredFeature) {
		let alias = aliases.get(lang.requiredFeature);
		if (alias) lang.requiredFeature = alias;
	}
	for (let i = 0; i < lang.features.length; i++) {
		let alias = aliases.get(lang.features[i]);
		if (alias) lang.features[i] = alias;
	}
}

function featureAliasable(a, b) {
	if (a.tag !== b.tag) return false;
	let lookupsA = new Set(a.lookups);
	let lookupsB = new Set(b.lookups);

	for (const x of lookupsA) if (!lookupsB.has(x)) return false;
	for (const x of lookupsB) if (!lookupsA.has(x)) return false;

	return true;
}
