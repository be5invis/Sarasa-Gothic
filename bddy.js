"use strict";

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

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

/// config loader
const config = fs.readJsonSync(__dirname + "/config.json");
const PREFIX = config.prefix;
const CVT_PADDING = config.CVT_PADDING;
const FAMILIES = config.familyOrder;
const SUBFAMILIES = config.subfamilyOrder;
const STYLES = config.styleOrder;
const version = fs.readJsonSync(path.resolve(__dirname, "package.json")).version;

function deItalizedNameOf(set) {
	return (set + "")
		.split("-")
		.map(w => (config.styles[w] ? config.styles[w].uprightStyleMap || w : w))
		.join("-");
}

module.exports = function(ctx, the, argv, bddy) {
	the.file(`out/ttf/${PREFIX}-*-*-*.ttf`).def(async function(target) {
		const { $1: family, $2: region, $3: style } = target;
		const [_, $1, $2] = await this.need(
			target.dir,
			`build/pass1/${family}-${region}-${style}.ttf`,
			`hint/out/${region}-${deItalizedNameOf(style)}.ttf`
		);
		const tmpOTD = `${target.dir}/${target.name}.otd`;
		await runBuildTask.call(this, "make/pass2/build.js", {
			main: $1,
			kanji: $2,
			o: tmpOTD,

			italize: deItalizedNameOf(style) === style ? false : true
		});
		await this.run("otfccbuild", tmpOTD, "-o", target, "--keep-average-char-width", "-O3");
		await this.rm(tmpOTD);
	});
	the.file(`build/pass1/*-*-*.ttf`).def(async function(target) {
		const { $1: family, $2: region, $3: style } = target;
		const latinFamily = config.families[family].latinGroup;
		const [_, $1, $2, $3] = await this.need(
			target.dir,
			`sources/${latinFamily}/${latinFamily}-${style}.ttf`,
			`build/as0/${family}-${region}-${deItalizedNameOf(style)}.ttf`,
			`build/ws0/${family}-${region}-${deItalizedNameOf(style)}.ttf`
		);
		await runBuildTask.call(this, "make/pass1/build.js", {
			main: $1,
			asian: $2,
			ws: $3,
			o: target + ".tmp.ttf",

			family: family,
			subfamily: config.subfamilies[region].name,
			style: style,
			italize: deItalizedNameOf(target.name) === target.name ? false : true
		});
		await sanitize.call(this, target, target + ".tmp.ttf");
	});

	the.file(`build/as0/*-*-*.ttf`).def(async function(target) {
		const { $1: family, $2: region, $3: style } = target;
		const [_, $1] = await this.need(target.dir, `build/shs/${region}-${style}.otd`);
		const tmpOTD = `${target.dir}/${target.name}.otd`;
		await runBuildTask.call(this, "make/punct/as.js", {
			main: $1,
			o: tmpOTD,
			mono: config.families[family].isMono || false,
			pwid: config.families[family].isPWID || false
		});
		await this.run("otfccbuild", tmpOTD, "-o", target, "-q");
		await this.rm(tmpOTD);
	});
	the.file(`build/ws0/*-*-*.ttf`).def(async function(target) {
		const { $1: family, $2: region, $3: style } = target;
		const [_, $1] = await this.need(target.dir, `build/shs/${region}-${style}.otd`);
		const tmpOTD = `${target.dir}/${target.name}.otd`;
		await runBuildTask.call(this, "make/punct/ws.js", {
			main: $1,
			o: tmpOTD,
			mono: config.families[family].isMono || false,
			pwid: config.families[family].isPWID || false
		});
		await this.run("otfccbuild", tmpOTD, "-o", target, "-q");
		await this.rm(tmpOTD);
	});

	// kanji tasks
	the.file(`hint/out/*.ttf`).def(async function(target) {
		await this.need("hint-finish");
	});
	the.virt("hint-finish").def(async function(target) {
		await this.need("hint-start");
		await this.cd("hint").runInteractive("node", "top", "hint");
	});
	the.virt("hint-visual").def(async function(target) {
		await this.need("hint-start");
		await this.cd("hint").runInteractive("node", "top", "visual");
	});
	the.virt("hint-start").def(async function(target) {
		let dependents = [];
		const wSet = new Set();
		for (let st of STYLES) {
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
			for (let sf of SUBFAMILIES) {
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
	the.file(`hint/source/fonts/*.ttf`).def(async function(target) {
		const [$1] = await this.need(`build/kanji0/${target.name}.ttf`);
		await this.cp($1, target);
	});

	the.file(`build/kanji0/*.ttf`).def(async function(target) {
		const [_, $1] = await this.need(target.dir, `build/shs/${target.name}.otd`);
		const tmpOTD = `${target.dir}/${target.name}.otd`;
		await runBuildTask.call(this, "make/kanji/build.js", { main: $1, o: tmpOTD });
		await this.run("otfccbuild", tmpOTD, "-o", target, "-q");
		await this.rm(tmpOTD);
	});

	// SHS dumps
	the.file(`build/shs/*.otd`).def(async function(target) {
		const name = target.$1;
		const [_, $1] = await this.need(target.dir, `sources/shs/${name}.otf`);
		await this.run(`otfccdump`, `-o`, target, $1);
	});

	the.virt("ttf").def(async function(target) {
		let reqs = [];
		for (let f of FAMILIES)
			for (let sf of SUBFAMILIES)
				for (let st of STYLES) {
					reqs.push(`out/ttf/${PREFIX}-${f}-${sf}-${st}.ttf`);
				}

		await this.need(...reqs);
	});

	// buildint TTC files
	the.virt(`out/ttc/${PREFIX}-*-parts`).def(async function(target) {
		const style = target.$1;
		let reqs = [];
		for (let f of FAMILIES)
			for (let sf of SUBFAMILIES) {
				reqs.push(`out/ttf/${PREFIX}-${f}-${sf}-${style}.ttf`);
			}
		const [...$$] = await this.need(...reqs);
		const ttcize = "node_modules/.bin/otfcc-ttcize" + (os.platform() === "win32" ? ".cmd" : "");
		await this.run(ttcize, ...["--prefix", `out/ttc/${PREFIX}-${style}-parts`], ...$$, [
			"-k",
			"-h"
		]);
	});

	the.file(`out/ttc/${PREFIX}-*-parts.*.otd`).def(async function(target) {
		await this.need(`out/ttc/${PREFIX}-${target.$1}-parts`);
	});
	the.file(`out/ttc/${PREFIX}-*-parts.*.ttf`).def(async function(target) {
		const [$1] = await this.need(`${target.dir}/${target.name}.otd`);
		await this.run(
			"otfccbuild",
			$1,
			["-o", target],
			["-k", "--subroutinize", "--keep-average-char-width"]
		);
	});
	the.file(`out/ttc/${PREFIX}-*.ttc`).def(async function(target) {
		const style = target.$1;
		await this.check(target.dir);
		{
			let reqs = [];
			for (let f of FAMILIES)
				for (let sf of SUBFAMILIES) {
					reqs.push(`out/ttf/${PREFIX}-${f}-${sf}-${style}.ttf`);
				}
			await this.need(...reqs);
		}
		{
			let reqs = [],
				n = 0;
			for (let f of FAMILIES)
				for (let sf of SUBFAMILIES) {
					reqs.push(`out/ttc/${PREFIX}-${style}-parts.${n}.ttf`);
					n += 1;
				}
			const [_, ...$$] = await this.need(target.dir, ...reqs);
			await this.run(`otf2otc`, ["-o", target], $$);
			for (let r of $$) {
				await this.rm(r, `${r.dir}/${r.name}.otd`);
			}
		}
	});

	// ttc virtual target
	the.virt("ttc").def(async function(target) {
		await this.need(...STYLES.map(st => `out/ttc/${PREFIX}-${st}.ttc`));
	});

	the.file(`out/sarasa-gothic-ttc-${version}.7z`).def(async function(target) {
		await this.need(`ttc`);
		await this.cd(`out/ttc`).run(
			`7z`,
			`a`,
			`-t7z`,
			`-mmt=on`,
			`-m0=LZMA:a=0:d=1536m:fb=256`,
			`../${target.name}.7z`,
			`*.ttc`
		);
	});
	the.file(`out/sarasa-gothic-ttf-${version}.7z`).def(async function(target) {
		await this.need(`ttf`);
		await this.cd(`out/ttf`).run(
			`7z`,
			`a`,
			`-t7z`,
			`-mmt=on`,
			`-m0=LZMA:a=0:d=1536m:fb=256`,
			`../${target.name}.7z`,
			`*.ttf`
		);
	});
	the.virt("start").def(async function(target) {
		await this.need(
			`out/sarasa-gothic-ttc-${version}.7z`,
			`out/sarasa-gothic-ttf-${version}.7z`
		);
	});

	// cleanup
	the.virt("clear").def(async function(target) {
		await this.rm(`build`, `out`, `hint/build`, `hint/out`);
	});
};
