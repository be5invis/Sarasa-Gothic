const path = require('path');
const fs = require('fs');
const colors = require('colors');

function stylegroupsOf(config) {
	let gs = {};
	let gn = 0;
	for (let font of config.fonts) {
		if (!font || !font.param || !font.input) {
			console.log("Bad config.")
			process.exit(1);
		}
		if (!gs[font.param]) {
			gn++
			gs[font.param] = {
				param: font.param,
				gid: "_sg" + gn,
				fonts: []
			};
		}
		gs[font.param].fonts.push(font);
	}
	return gs;
};

function initParamfiles(gs, config) {
	for (let gid in gs) {
		const group = gs[gid];
		if (!fs.existsSync(group.param)) {
			const upm = config.settings.default_upm || 1000;
			console.log(`> Initialized empty configuraion for ${group.param}, as UPM = ${upm}.`);
			fs.writeFileSync(group.param, `
[hinting]
UPM = ${upm}
BLUEZONE_TOP_CENTER = ${0.83 * upm}
BLUEZONE_TOP_LIMIT = ${0.813 * upm}
BLUEZONE_BOTTOM_CENTER = ${-0.07 * upm}
BLUEZONE_BOTTOM_LIMIT = ${-0.045 * upm}
`
			);
		}
	}
}

function printStylegroups(gs) {
	let ans = []
	for (let _g in gs) {
		const group = gs[_g];
		ans.push({
			value: group.gid,
			name: `${group.param}, for ${group.fonts.slice(0, 1).map(f => f.input)}${group.fonts.length > 1 ? ",..." : ""}`,
			short: group.param
		});
	}
	return ans;
}

exports.stylegroupsOf = stylegroupsOf;
exports.initParamfiles = initParamfiles;
exports.printStylegroups = printStylegroups;
