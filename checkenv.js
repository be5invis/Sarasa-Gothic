"use strict";

const which = require("which");
const colors = require("colors/safe");

function check(util) {
	try {
		which.sync(util);
		console.error(colors.green(`External dependency <${util}> is present.`));
	} catch (e) {
		console.error(colors.red(`External dependency <${util}> not found.`));
	}
}

check("ttx");
check("otc2otf");
check("otf2otc");
check("otf2ttf");
check("otfccdump");
check("otfccbuild");
check("ttfautohint");
