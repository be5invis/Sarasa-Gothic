import { Ot } from "ot-builder";

export function simplifySingleSub(table, tag) {
	if (!table || !table.features || !table.lookups) return;

	let mapping = new Map();
	for (const feature of table.features) {
		if (feature.tag !== tag) continue;
		for (const lookup of feature.lookups) {
			if (!(lookup instanceof Ot.Gsub.Single)) continue;
			for (const [from, to] of lookup.mapping) mapping.set(from, to);
		}

		const newLookup = new Ot.Gsub.Single({ mapping });
		feature.lookups = [newLookup];
		table.lookups.push(newLookup);
	}
}
