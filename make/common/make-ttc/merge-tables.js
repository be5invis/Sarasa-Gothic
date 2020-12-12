"use strict";

const crypto = require("crypto");
const fs = require("fs-extra");

exports.merge = async function main(buffers, output, sharing) {
	const fonts = [];
	for (const file of buffers) fonts.push(await readFont(file));
	if (sharing) shareGlyphs(fonts, sharing);
	const { offsetMap, bodyBuffer } = shareTables(fonts);
	const ttcBuf = createTTC(fonts, offsetMap, bodyBuffer);
	await fs.writeFile(output, ttcBuf);
};

function createTTC(fonts, offsetMap, bodyBuffer) {
	const ttcHeaderLength = 12 + 4 * fonts.length;
	const offsetTableLengths = fonts.map(f => 12 + 16 * f.tables.length);
	const initialLength = offsetTableLengths.reduce((a, b) => a + b, ttcHeaderLength);

	const initial = new ArrayBuffer(initialLength);
	const ttcHeader = new DataView(initial, 0);
	ttcHeader.setUint32(0, fromTag("ttcf"), false);
	ttcHeader.setUint16(4, 1, false);
	ttcHeader.setUint16(6, 0, false);
	ttcHeader.setUint32(8, fonts.length, false);

	let currentOffsetTableOffset = ttcHeaderLength;
	for (let j = 0; j < fonts.length; j++) {
		const font = fonts[j];
		ttcHeader.setUint32(12 + 4 * j, currentOffsetTableOffset, false);
		const offsetTable = new DataView(initial, currentOffsetTableOffset, offsetTableLengths[j]);
		currentOffsetTableOffset += offsetTableLengths[j];

		offsetTable.setUint32(0, font.sfntVersion, false);
		offsetTable.setUint16(4, font.numTables, false);
		offsetTable.setUint16(6, font.searchRange, false);
		offsetTable.setUint16(8, font.entrySelector, false);
		offsetTable.setUint16(10, font.rangeShift, false);

		for (let k = 0; k < font.tables.length; k++) {
			const table = font.tables[k];
			const tableRecordOffset = 12 + 16 * k;
			offsetTable.setUint32(tableRecordOffset + 0, fromTag(table.tag), false);
			offsetTable.setUint32(tableRecordOffset + 4, table.checksum, false);
			offsetTable.setUint32(
				tableRecordOffset + 8,
				initialLength + offsetMap.get(table.hash),
				false
			);
			offsetTable.setUint32(tableRecordOffset + 12, table.length, false);
		}
	}
	return Buffer.concat([Buffer.from(initial), bodyBuffer]);
}

///////////////////////////////////////////////////////////////////////////////////////////////////

function shareGlyphs(fonts, sharing) {
	const entries = getGlyphData(fonts);
	const shared = [];
	for (let fid = 0; fid < fonts.length; fid++) {
		const entry = entries[fid];
		const sh = sharing[fid];
		if (entry.glyphData.length !== sh.length)
			throw new Error(`Unreachable! Font #${fid} sharing length mismatch`);
		for (let gid = 0; gid < entry.glyphData.length; gid++) {
			pushGlyph(shared, sh[gid], entry.glyphData[gid]);
		}
	}

	const { saGidMaps, combinedGlyphBuffers } = allocateGid(shared);
	const { glyfBuf, glyphOffsets, glyfTableLength } = buildGlyf(combinedGlyphBuffers);
	for (let fid = 0; fid < fonts.length; fid++) {
		const entry = entries[fid];
		const sh = sharing[fid];

		const entryOffsets = [];
		for (let gid = 0; gid < entry.glyphData.length; gid++) {
			entryOffsets[gid] = glyphOffsets[saGidMaps[sh[gid]].get(entry.glyphData[gid].hash)];
		}
		entryOffsets.push(glyfTableLength);

		entry.glyf.buffer = glyfBuf;
		entry.loca.buffer = buildLoca(entryOffsets);
		new DataView(entry.head.buffer).setUint16(50, 1, false);
	}
}

function pushGlyph(shared, shGid, glyphData) {
	if (!shared[shGid]) shared[shGid] = new Map();
	shared[shGid].set(glyphData.hash, glyphData.buffer);
}

function allocateGid(shared) {
	let saGid = 0;
	let saGidMaps = [];
	let combinedGlyphBuffers = [];
	for (let shGid = 0; shGid < shared.length; shGid++) {
		if (!shared[shGid]) throw new Error(`Unreachable! Shared glyph #${shGid} missing`);
		saGidMaps[shGid] = new Map();
		for (const [hash, buf] of shared[shGid]) {
			saGidMaps[shGid].set(hash, saGid);
			combinedGlyphBuffers[saGid] = buf;
			saGid++;
		}
	}
	return { saGidMaps, combinedGlyphBuffers };
}

function buildGlyf(shared) {
	let currentOffset = 0;
	let offsets = [];
	for (let sGid = 0; sGid < shared.length; sGid++) {
		if (!shared[sGid]) throw new Error(`Unreachable! Shared glyph #${sGid} missing`);
		offsets[sGid] = currentOffset;
		currentOffset += shared[sGid].byteLength;
	}
	const glyfTableArr = new Uint8Array(currentOffset);
	for (let sGid = 0; sGid < shared.length; sGid++) {
		glyfTableArr.set(shared[sGid], offsets[sGid]);
	}
	return { glyfBuf: glyfTableArr.buffer, glyphOffsets: offsets, glyfTableLength: currentOffset };
}

function buildLoca(offsets) {
	const buf = new ArrayBuffer(offsets.length * 4);
	const view = new DataView(buf);
	for (let j = 0; j < offsets.length; j++) {
		view.setUint32(j * 4, offsets[j], false);
	}
	return buf;
}

function getGlyphData(fonts) {
	let entries = [];
	for (let j = 0; j < fonts.length; j++) {
		const font = fonts[j];
		let head = null,
			loca = null,
			glyf = null;
		for (const table of font.tables) {
			if (table.tag === "head") head = table;
			if (table.tag === "loca") loca = table;
			if (table.tag === "glyf") glyf = table;
		}
		if (!head || !loca || !glyf) throw new TypeError(`Invalid TrueType font.`);
		const glyphData = parseGlyphDataOfFont(head, loca, glyf);
		entries.push({ head, loca, glyf, glyphData });
	}
	return entries;
}

function parseGlyphDataOfFont(head, loca, glyf) {
	const headView = new DataView(head.buffer);
	const indexToLocFormat = headView.getUint16(50, false);
	const bytesPerRecord = indexToLocFormat === 0 ? 2 : 4;
	const offsetCount = loca.buffer.byteLength / bytesPerRecord;
	const offsets = [];
	const locaView = new DataView(loca.buffer);
	for (let j = 0; j < offsetCount; j++) {
		if (indexToLocFormat === 0) offsets[j] = 2 * locaView.getUint16(bytesPerRecord * j, false);
		else offsets[j] = locaView.getUint32(bytesPerRecord * j, false);
	}
	let glyphData = [];
	for (let j = 0; j < offsets.length - 1; j++) {
		const buf = new Uint8Array(alignToFourBytes(glyf.buffer.slice(offsets[j], offsets[j + 1])));
		glyphData[j] = { hash: computeHashBuf(buf), buffer: buf };
	}
	return glyphData;
}

///////////////////////////////////////////////////////////////////////////////////////////////////

function shareTables(fonts) {
	let tableMap = new Map();
	for (let j = 0; j < fonts.length; j++) {
		const font = fonts[j];
		// cleanup data
		font.numTables = font.tables.length;
		font.searchRange = Math.pow(2, Math.floor(Math.log(font.numTables) / Math.LN2)) * 16;
		font.entrySelector = Math.floor(Math.log(font.numTables) / Math.LN2);
		font.rangeShift = font.numTables * 16 - font.searchRange;
		font.tables = font.tables.sort((a, b) => (a.tag < b.tag ? -1 : a.tag > b.tag ? 1 : 0));

		for (let table of font.tables) {
			table.length = table.buffer.byteLength;
			table.buffer = alignToFourBytes(table.buffer);
			table.hash = computeHash(table);
			table.checksum = computeChecksum(table.buffer);

			if (tableMap.has(table.hash)) {
				table.buffer = tableMap.get(table.hash).buffer;
			} else {
				tableMap.set(table.hash, table);
			}
		}
	}
	let offset = 0;
	let offsetMap = new Map();
	let bodyBlocks = [];
	for (let [hash, content] of tableMap) {
		offsetMap.set(hash, offset);
		offset += content.buffer.byteLength;
		bodyBlocks.push(Buffer.from(content.buffer));
	}
	return { offsetMap, bodyBuffer: Buffer.concat(bodyBlocks) };
}

function alignToFourBytes(ab) {
	if (ab.byteLength % 4 === 0) return ab;
	const raw = Array.from(new Uint8Array(ab));
	while (raw.length % 4) raw.push(0);
	return new Uint8Array(raw).buffer;
}

function computeChecksum(buffer) {
	let checksum = 0;
	const view = new DataView(buffer);
	for (let j = 0; j * 4 < buffer.byteLength; j++) {
		checksum = (checksum + view.getUint32(4 * j)) % 0x100000000;
	}
	return checksum;
}

function computeHash(table) {
	return table.tag + "/" + computeHashBuf(table.buffer);
}
function computeHashBuf(buffer) {
	return crypto.createHash("sha256").update(Buffer.from(buffer)).digest("hex");
}

///////////////////////////////////////////////////////////////////////////////////////////////////

/**
 * @returns {string}
 * @param {number} x
 */
function toTag(x) {
	return (
		String.fromCharCode((x >>> 24) & 0xff) +
		String.fromCharCode((x >>> 16) & 0xff) +
		String.fromCharCode((x >>> 8) & 0xff) +
		String.fromCharCode((x >>> 0) & 0xff)
	);
}

/**
 * @returns {number}
 * @param {string} x
 */
function fromTag(x) {
	return (
		(x.charCodeAt(0) & 0xff) * 256 * 256 * 256 +
		(x.charCodeAt(1) & 0xff) * 256 * 256 +
		(x.charCodeAt(2) & 0xff) * 256 +
		(x.charCodeAt(3) & 0xff)
	);
}

/**
 * @param {ArrayBuffer} buf
 * @param {DataView} view
 * @param {number} offset
 */
function readTableRecord(buf, view, offset) {
	const tableOffset = view.getUint32(offset + 8, false);
	const tableLength = view.getUint32(offset + 12, false);
	return {
		tag: toTag(view.getUint32(offset + 0, false)),
		buffer: buf.slice(tableOffset, tableOffset + tableLength)
	};
}

async function readFont(buffer) {
	const ab = new Uint8Array(buffer).buffer;
	const view = new DataView(ab);

	const font = {
		sfntVersion: view.getUint32(0, false),
		numTables: view.getUint16(4, false),
		searchRange: view.getUint16(6, false),
		entrySelector: view.getUint16(8, false),
		rangeShift: view.getUint16(10, false),
		tables: []
	};
	for (let j = 0; j < font.numTables; j++) {
		font.tables[j] = readTableRecord(ab, view, 12 + j * 16);
	}
	return font;
}
