// Naming functions
function nameEntry(p, e, l, n, str) {
	return {
		platformID: p,
		encodingID: e,
		languageID: l,
		nameID: n,
		nameString: str
	};
}
const WINDOWS = 3;
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
function convPostscript(name) {
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
const langIDMap = {
	en_US: 1033,
	zh_CN: 2052,
	zh_TW: 1028,
	zh_HK: 3076,
	ja_JP: 1041
};
function createNameTuple(nameTable, langID, family, style, localizedStyle) {
	const compat = compatibilityName(family, style);
	nameTable.push(nameEntry(WINDOWS, UNICODE, langID, PREFERRED_FAMILY, family));
	nameTable.push(nameEntry(WINDOWS, UNICODE, langID, PREFERRED_STYLE, style));
	nameTable.push(nameEntry(WINDOWS, UNICODE, langID, FAMILY, compat.family));
	const compatStyle = compat.standardFour ? localizedStyle : compat.style;
	nameTable.push(nameEntry(WINDOWS, UNICODE, langID, STYLE, compatStyle));
	if (compatStyle === "Regular") {
		nameTable.push(nameEntry(WINDOWS, UNICODE, langID, FULL_NAME, `${compat.family}`));
	} else {
		nameTable.push(
			nameEntry(WINDOWS, UNICODE, langID, FULL_NAME, `${compat.family} ${compatStyle}`)
		);
	}
	nameTable.push(nameEntry(WINDOWS, UNICODE, langID, UNIQUE_NAME, `${family} ${style}`));
	if (langID === langIDMap.en_US) {
		nameTable.push(
			nameEntry(WINDOWS, UNICODE, langID, POSTSCRIPT, convPostscript(`${family} ${style}`))
		);
	}
}
function nameFont(font, fMono, selectorList, encodings, namings) {
	const nameTable = [];
	const defaultNg = namings.en_US;
	const selector = new Set(selectorList);
	for (let language in namings) {
		const langID = langIDMap[language];
		const ng = namings[language];
		if (!ng || !langID || !selector.has(language)) continue;
		createNameTuple(nameTable, langID, ng.family, defaultNg.style, ng.style || defaultNg.style);
		if (ng.copyright)
			nameTable.push(nameEntry(WINDOWS, UNICODE, langID, COPYRIGHT, ng.copyright));
		if (ng.version) nameTable.push(nameEntry(WINDOWS, UNICODE, langID, VERSION, ng.version));
		if (ng.manufacturer)
			nameTable.push(nameEntry(WINDOWS, UNICODE, langID, MANUFACTURER, ng.copyright));
		if (ng.trademark)
			nameTable.push(nameEntry(WINDOWS, UNICODE, langID, TRADEMARK, ng.trademark));
		if (ng.designer) nameTable.push(nameEntry(WINDOWS, UNICODE, langID, DESIGNER, ng.designer));
	}
	font.name = nameTable;
	// Set fsSelection
	font.OS_2.fsSelection.useTypoMetrics = true;
	font.OS_2.fsSelection.wws = false;
	// clear achVendID
	font.OS_2.achVendID = "????";
	// Set encodings
	font.OS_2.ulCodePageRange1 = {
		...font.OS_2.ulCodePageRange1,
		latin1: true,
		latin2: true,
		cyrillic: true,
		greek: true,
		turkish: true,
		vietnamese: true,
		macRoman: true,
		...encodings
	};
	font.OS_2.ulCodePageRange2 = {
		...font.OS_2.ulCodePageRange2,
		cp852: true,
		cp850: true,
		ascii: true
	};
	// Set Panose bits
	font.OS_2.panose = [
		2,
		0,
		(1 + font.OS_2.usWeightClass / 100) | 0,
		fMono ? 9 : 0,
		0,
		0,
		0,
		0,
		0,
		0
	];
}
function setHintFlag(font) {
	font.head.flags.baselineAtY_0 = true;
	font.head.flags.lsbAtX_0 = true;
	font.head.flags.alwaysUseIntegerSize = true;
	font.head.flags.instrMayDependOnPointSize = true;
}
export { nameFont };
export { setHintFlag };
