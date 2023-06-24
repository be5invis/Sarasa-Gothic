import { Ot } from "ot-builder";

export function setFontMetadata(font, fMono, selectorList, encodings, namings) {
	// Set font name
	nameFont(font, fMono, selectorList, encodings, namings);

	// Set fsSelection
	font.os2.fsSelection |= Ot.Os2.FsSelection.USE_TYPO_METRICS;
	font.os2.fsSelection &= ~Ot.Os2.FsSelection.WWS;

	// clear achVendID
	font.os2.achVendID = "????";

	// Fix Inter's usWeightClass
	font.os2.usWeightClass = 100 * Math.round(font.os2.usWeightClass / 100);

	// Set encodings
	if (encodings.jis) font.os2.ulCodePageRange1 |= Ot.Os2.CodePageRange1.CP932;
	if (encodings.gbk) font.os2.ulCodePageRange1 |= Ot.Os2.CodePageRange1.CP936;
	if (encodings.korean)
		font.os2.ulCodePageRange1 |= Ot.Os2.CodePageRange1.CP949 | Ot.Os2.CodePageRange1.CP1361;
	if (encodings.big5) font.os2.ulCodePageRange1 |= Ot.Os2.CodePageRange1.CP950;

	// Set Panose bits
	font.os2.panose = {
		bFamilyType: 2,
		bSerifStyle: 0,
		bWeight: (1 + font.os2.usWeightClass / 100) | 0,
		bProportion: fMono ? 9 : 0,
		bContrast: 0,
		bStrokeVariation: 0,
		bArmStyle: 0,
		bLetterform: 0,
		bMidline: 0,
		bXHeight: 0
	};

	// Set head bits
	font.head.flags |=
		Ot.Head.Flags.BaseLineYAt0 |
		Ot.Head.Flags.LeftSidebearingAtX0 |
		Ot.Head.Flags.ForcePpemToBeInteger |
		Ot.Head.Flags.InstructionsMayDependOnPointSize;
}

// Naming functions
function nameFont(font, fMono, selectorList, encodings, namings) {
	const recs = [];
	const defaultNg = namings.en_US;
	const selector = new Set(selectorList);
	for (let language in namings) {
		const langID = langIDMap[language];
		const ng = namings[language];
		if (!ng || !langID || !selector.has(language)) continue;
		createNameTuple(recs, langID, ng.family, defaultNg.style, ng.style || defaultNg.style);
		if (ng.copyright) recs.push(nameEntry(WIN, UNICODE, langID, COPYRIGHT, ng.copyright));
		if (ng.version) recs.push(nameEntry(WIN, UNICODE, langID, VERSION, ng.version));
		if (ng.manufacturer) recs.push(nameEntry(WIN, UNICODE, langID, MANUFACTURER, ng.copyright));
		if (ng.trademark) recs.push(nameEntry(WIN, UNICODE, langID, TRADEMARK, ng.trademark));
		if (ng.designer) recs.push(nameEntry(WIN, UNICODE, langID, DESIGNER, ng.designer));
	}
	font.name.records = recs;
}

const WIN = 3;
const UNICODE = 1;

const COPYRIGHT = 0;
const FAMILY = 1;
const STYLE = 2;
const UNIQUE_NAME = 3;
const FULL_NAME = 4;
const VERSION = 5;
const POSTSCRIPT = 6;
const TRADEMARK = 7;
const MANUFACTURER = 8;
const DESIGNER = 9;
const PREFERRED_FAMILY = 16;
const PREFERRED_STYLE = 17;
const langIDMap = { en_US: 1033, zh_CN: 2052, zh_TW: 1028, zh_HK: 3076, ja_JP: 1041 };

function nameEntry(p, e, l, n, str) {
	return { platformID: p, encodingID: e, languageID: l, nameID: n, value: str };
}
function toPostscriptName(name) {
	return name.replace(/ /g, "-");
}

function compatibilityName(family, style) {
	if (style === "Regular" || style === "Bold" || style === "Italic" || style === "Bold Italic") {
		return { family, style, standardFour: true };
	} else {
		if (/^Extra/.test(style)) {
			// Prevent name overflow
			style = style.replace(/^Extra/, "X");
		}
		if (/Italic/.test(style)) {
			return {
				family: family + " " + style.replace(/Italic/, "").trim(),
				style: "Italic",
				standardFour: false
			};
		} else {
			return { family: family + " " + style, style: "Regular", standardFour: false };
		}
	}
}

function createNameTuple(sink, langID, family, style, localizedStyle) {
	const compat = compatibilityName(family, style);
	sink.push(nameEntry(WIN, UNICODE, langID, PREFERRED_FAMILY, family));
	sink.push(nameEntry(WIN, UNICODE, langID, PREFERRED_STYLE, style));
	sink.push(nameEntry(WIN, UNICODE, langID, FAMILY, compat.family));
	const compatStyle = compat.standardFour ? localizedStyle : compat.style;
	sink.push(nameEntry(WIN, UNICODE, langID, STYLE, compatStyle));
	if (compatStyle === "Regular") {
		sink.push(nameEntry(WIN, UNICODE, langID, FULL_NAME, `${compat.family}`));
	} else {
		sink.push(nameEntry(WIN, UNICODE, langID, FULL_NAME, `${compat.family} ${compatStyle}`));
	}
	sink.push(nameEntry(WIN, UNICODE, langID, UNIQUE_NAME, `${family} ${style}`));
	if (langID === langIDMap.en_US) {
		sink.push(
			nameEntry(WIN, UNICODE, langID, POSTSCRIPT, toPostscriptName(`${family} ${style}`))
		);
	}
}
