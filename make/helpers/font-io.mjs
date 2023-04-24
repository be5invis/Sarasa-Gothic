import fs from "fs";

import { FontIo, Ot } from "ot-builder";

export async function readFont(input) {
	const buf = await fs.promises.readFile(input);
	const sfnt = FontIo.readSfntOtf(buf);
	const font = FontIo.readFont(sfnt, Ot.ListGlyphStoreFactory);
	return font;
}

export async function writeFont(output, font) {
	const sfnt = FontIo.writeFont(font, { glyphStore: { statOs2XAvgCharWidth: false } });
	const buf = FontIo.writeSfntOtf(sfnt);
	await fs.promises.writeFile(output, buf);
}
