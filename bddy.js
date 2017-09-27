"use strict";

const fs = require("fs-extra");
const os = require("os");

const CVT_PADDING = 300;
const PREFIX = "sarasa";

function objToArgs(o) {
	let a = [];
	for (let k in o) {
		if (o[k] === false) continue;
		if (k.length === 1) {
			a.push("-" + k);
		} else {
			a.push("--" + k);
		}
		if (o[k] !== true) {
			a.push("" + o[k]);
		}
	}
	return a;
}

async function runBuildTask(recipe, args) {
	return await this.run("node", "run", "--recipe", recipe, ...objToArgs(args));
}

async function sanitize(target, ttf) {
	const tmpTTX = `${ttf}.ttx`;
	const tmpTTF2 = `${ttf}.2.ttf`;
	await this.run("ttx", "-o", tmpTTX, ttf);
	await this.run("ttx", "-o", tmpTTF2, tmpTTX);
	await this.run("ttfautohint", tmpTTF2, target);
	await this.rm(ttf, tmpTTX, tmpTTF2);
}

const STYLE_FILENAME_OF = {
	regular: "regular",
	bold: "bold",
	italic: "italic",
	bolditalic: "bolditalic"
};
const STYLE_OF = {
	regular: "Regular",
	bold: "Bold",
	italic: "Italic",
	bolditalic: "Bold Italic"
};
const STYLES = Object.keys(STYLE_FILENAME_OF);

const FAMILY_OF = {
	cl: "cl",
	sc: "sc",
	tc: "tc",
	j: "j"
};
const SUBFAMILIES = Object.keys(FAMILY_OF);

function styleOf(set) {
	return (set + "")
		.split("-")
		.map(w => STYLE_FILENAME_OF[w])
		.filter(w => w)[0];
}
function familyOf(set) {
	return (set + "")
		.split("-")
		.map(w => FAMILY_OF[w])
		.filter(w => w)[0];
}

const DEITALIC = {
	italic: "regular",
	bolditalic: "bold"
};
function deItalizedNameOf(set) {
	return (set + "")
		.split("-")
		.map(w => DEITALIC[w] || w)
		.join("-");
}

module.exports = function(ctx, forany, argv, bddy) {
	forany.file(`out/ttf/*.ttf`).def(async function(target) {
		const rawName = target.name.replace(new RegExp("^" + PREFIX + "-", "g"), "");
		const [_, $1, $2] = await this.need(
			target.dir,
			`build/pass1/${rawName}.ttf`,
			`hint/out/${deItalizedNameOf(rawName)}.ttf`
		);
		const tmpOTD = `${target.dir}/${rawName}.otd`;
		await runBuildTask.call(this, "build-pass2/build.js", {
			main: $1,
			kanji: $2,
			o: tmpOTD,
			style: STYLE_OF[styleOf(rawName)],
			subfamily: familyOf(rawName).toUpperCase(),
			italize: deItalizedNameOf(rawName) === rawName ? false : true
		});
		await this.run("otfccbuild", tmpOTD, "-o", target, "--keep-average-char-width", "-O3");
		await this.rm(tmpOTD);
	});
	forany.file(`build/pass1/*.ttf`).def(async function(target) {
		const [_, $1, $2, $3] = await this.need(
			target.dir,
			`sources/iosevka/iosevka-${styleOf(target.name)}.ttf`,
			`build/punct0/${deItalizedNameOf(target.name)}.ttf`,
			`build/ws0/${deItalizedNameOf(target.name)}.ttf`
		);
		await runBuildTask.call(this, "build-pass1/build.js", {
			main: $1,
			asian: $2,
			ws: $3,
			o: target + ".tmp.ttf",
			italize: deItalizedNameOf(target.name) === target.name ? false : true
		});
		await sanitize.call(this, target, target + ".tmp.ttf");
	});
	forany.file(`build/punct0/*.ttf`).def(async function(target) {
		const [_, $1] = await this.need(target.dir, `sources/shs/${target.name}.otf`);
		const tmpOTD = `${target.dir}/${target.name}.otd`;
		await runBuildTask.call(this, "build-punct/as.js", { main: $1, o: tmpOTD });
		await this.run("otfccbuild", tmpOTD, "-o", target, "-q");
		await this.rm(tmpOTD);
	});
	forany.file(`build/ws0/*.ttf`).def(async function(target) {
		const [_, $1] = await this.need(target.dir, `sources/shs/${target.name}.otf`);
		const tmpOTD = `${target.dir}/${target.name}.otd`;
		await runBuildTask.call(this, "build-punct/ws.js", { main: $1, o: tmpOTD });
		await this.run("otfccbuild", tmpOTD, "-o", target, "-q");
		await this.rm(tmpOTD);
	});

	// kanji tasks
	forany
		.file(`hint/out/*.ttf`)
		.alsodir()
		.def(async function(target) {
			await this.need("hint-finish");
		});
	forany.virt("hint-finish").def(async function(target) {
		await this.need("hint-start");
		await this.cd("hint").runInteractive("node", "top", "hint");
	});
	forany.virt("hint-visual").def(async function(target) {
		await this.need("hint-start");
		await this.cd("hint").runInteractive("node", "top", "visual");
	});
	forany.virt("hint-start").def(async function(target) {
		let dependents = [];
		const wSet = new Set();
		for (let st in STYLE_FILENAME_OF) {
			wSet.add(deItalizedNameOf(st));
		}

		const config = {
			settings: {
				do_ttfautohint: false,
				cvt_padding: CVT_PADDING,
				use_externalIDH: false,
				use_VTTShell: false
			},
			fonts: []
		};

		for (let st of wSet)
			for (let sf in FAMILY_OF) {
				dependents.push(`hint/source/fonts/${sf}-${st}.ttf`);
				config.fonts.push({
					input: `source/fonts/${sf}-${st}.ttf`,
					param: `source/parameters/${st}.toml`,
					allchar: true
				});
			}
		await this.need(...dependents);
		await fs.writeFile("hint/source/fonts.json", JSON.stringify(config, null, 2));
	});
	forany.file(`hint/source/fonts/*.ttf`).def(async function(target) {
		const [$1] = await this.need(`build/kanji0/${target.name}.ttf`);
		await this.cp($1, target);
	});

	forany.file(`build/kanji0/*.ttf`).def(async function(target) {
		const [_, $1] = await this.need(target.dir, `sources/shs/${target.name}.otf`);
		const tmpOTD = `${target.dir}/${target.name}.otd`;
		await runBuildTask.call(this, "build-kanji/build.js", { main: $1, o: tmpOTD });
		await this.run("otfccbuild", tmpOTD, "-o", target, "-q");
		await this.rm(tmpOTD);
	});

	forany.virt("ttf").def(async function(target) {
		let targets = [];
		for (let sf of SUBFAMILIES)
			for (let st of STYLES) {
				targets.push(`out/ttf/sarasa-${sf}-${st}.ttf`);
			}

		await this.need(...targets);
	});

	forany.file(`out/ttc/*.ttc`).def(async function(target) {
		const rawName = target.name.replace(new RegExp("^" + PREFIX + "-", "g"), "");
		const [_, ...$$] = await this.need(
			target.dir,
			...SUBFAMILIES.map(sf => `out/ttf/${PREFIX}-${sf}-${rawName}.ttf`)
		);
		const ttcize = "node_modules/.bin/otfcc-ttcize" + (os.platform() === "win32" ? ".cmd" : "");
		await this.run(ttcize, "-o", target, ...$$, "-k", "-h");
	});
	forany.virt("ttc").def(async function(target) {
		await this.need(...STYLES.map(st => `out/ttc/${PREFIX}-${st}.ttc`));
	});

	// cleanup
	forany.virt("clear").def(async function(target) {
		await this.rm(`build`, `out`, `hint/build`, `hint/out`);
	});
};
