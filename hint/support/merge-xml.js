const xpath = require("xpath"), dom = require("xmldom").DOMParser;
const fs = require("fs");

const argv = require("yargs").argv;

let baseArray = [];

void function () {
	const baseXML = new dom().parseFromString(fs.readFileSync(argv._[0], "utf-8"));
	const nodes = xpath.select("//glyf/TTGlyph", baseXML);

	for (let g of nodes) {
		let gid = g.getAttribute("ID") - 0;
		let talkElement = xpath.select1("instructions/talk/text()", g);
		if (!talkElement) continue;
		let talk = talkElement.toString().trim();
		if (gid && talk) {
			baseArray[gid] = talk;
		}
	}
}();

let currentArray = [];
let conflictArray = [];
for (let s = 1; s < argv._.length; s++) {
	const fileName = argv._[s];
	const baseXML = new dom().parseFromString(fs.readFileSync(fileName, "utf-8"));
	const nodes = xpath.select("//glyf/TTGlyph", baseXML);
	let glyphsApplied = 0;
	let glyphsConflict = 0;
	for (let g of nodes) {
		let gid = g.getAttribute("ID") - 0;
		let talkElement = xpath.select1("instructions/talk/text()", g);
		if (!talkElement) continue;
		let talk = talkElement.toString().trim();
		if (gid && talk && baseArray[gid] !== talk) {
			if (currentArray[gid]) {
				glyphsConflict += 1;
				// console.log(`[INFO]  Found two designers modifying one glyph #${gid}: ${conflictArray[gid]} <> ${fileName}`);
			} else {
				currentArray[gid] = talk;
				conflictArray[gid] = fileName;
			}
			glyphsApplied += 1;
		}
	}
	console.log(`[OK]    Merged component ${fileName} : ${glyphsApplied} glyphs applied, ${glyphsConflict} glyphs conflict`);
}


if (argv.o) {
	let buf = `<?xml version="1.0" encoding="UTF-8"?><ttFont ttVttLibVersion="1.0"><glyf>`;
	for (let j = 0; j < currentArray.length; j++) {
		if (!currentArray[j]) continue;
		buf += `<TTGlyph ID="${j}"><instructions><talk>${currentArray[j]}</talk></instructions></TTGlyph>` + "\n";
	}
	buf += "</glyf></ttFont>";
	fs.writeFileSync(argv.o, buf);
}
