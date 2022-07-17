import * as FontIo from "./support/font-io.mjs";

export default (async function buildFont(font, options) {
	return await FontIo.buildFont(font, options.to, options);
});
