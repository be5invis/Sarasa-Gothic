"use strict";

exports.toTNUM = async function () {
	const font = this.font;
	for (let c in font.cmap) {
		if (!font.cmap[c]) continue;
		font.cmap[c] = this.find.gname.subst("pwid", font.cmap[c]);
	}
};
