import * as JSONStream from "JSONStream";
import stripBomStream from "strip-bom-stream";
///////////////////////////////////////////////////////////////////////////////////////////////////
const JsonStringify = Symbol();
const BUFFER_LIMIT = 1 << 20;
class BufferedWriter {
	constructor(writer) {
		this.writer = writer;
		this.buffer = "";
	}
	push(str) {
		this.buffer += str;
		if (this.buffer.length > BUFFER_LIMIT) this.flush();
	}
	flush() {
		if (!this.buffer) return;
		this.writer.write(this.buffer, "utf8");
		this.buffer = "";
	}
}
function waitStreamEnd(stream) {
	return new Promise((resolve, reject) => {
		stream.end();
		stream.on("close", () => resolve());
		stream.on("error", why => reject(why));
	});
}
export const parseJsonObjectFromStream = function (input) {
	return new Promise(function (resolve, reject) {
		let font = {};
		input
			.pipe(stripBomStream())
			.pipe(JSONStream.parse("$*"))
			.on("data", data => {
				font[data.key] = data.value;
			})
			.on("close", () => resolve(font))
			.on("error", e => reject(e));
	});
};
export const fontJsonStringifyToStream = async function (font, output) {
	const writer = new BufferedWriter(output);
	writer.push("{");
	for (const key in font) {
		if (key === "glyf") continue;
		writer.push(JSON.stringify(key) + ":" + JSON.stringify(font[key]));
		writer.push(",");
	}
	if (font.glyf) {
		// Serialize glyphs
		writer.push('"glyf":{');
		let started = false;
		for (const gid in font.glyf) {
			const g = font.glyf[gid];
			if (started) writer.push(",");
			if (g[JsonStringify]) {
				writer.push(JSON.stringify(gid) + ":" + font.glyf[gid][JsonStringify]() + "\n");
			} else {
				writer.push(JSON.stringify(gid) + ":" + JSON.stringify(g) + "\n");
			}
			started = true;
		}
		writer.push("}");
	} else {
		writer.push('"glyf":null');
	}
	writer.push("}");
	writer.flush();
	await waitStreamEnd(output);
};
export { JsonStringify };
