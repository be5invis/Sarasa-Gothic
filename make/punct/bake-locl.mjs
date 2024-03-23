import { bakeFeature } from "../helpers/bake-feature.mjs";

export function bakeLocalization(font, flags) {
	if (flags.mono || flags.term || flags.pwid) return;

	let langTag = "JAN ";
	switch (flags.region) {
		case "J":
			langTag = "JAN ";
			break;
		case "K":
			langTag = "KOR ";
			break;
		case "SC":
			langTag = "ZHS ";
			break;
		case "TC":
			langTag = "ZHT ";
			break;
		case "HC":
			langTag = "ZHH ";
			break;
	}

	bakeFeature("locl", font, c => c != 0x2010, "hani", langTag);
}
