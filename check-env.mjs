import which from "which";

function check(util) {
	try {
		which.sync(util);
		console.log(` * External dependency <${util}> is present.`);
	} catch (e) {
		console.error(` * External dependency <${util}> not found.`);
	}
}

check("otc2otf");
check("otf2ttf");
