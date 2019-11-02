"use strict";

const build = require("verda").create();
const { task, file, oracle, phony } = build.ruleTypes;
const { de, fu } = build.rules;
const { run, rm, cd } = build.actions;
const { FileList } = build.predefinedFuncs;

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

build.setJournal(`build/.verda-build-journal`);
build.setSelfTracking();
module.exports = build;

// Directories
const PREFIX = `sarasa`;
const BUILD = `build`;
const OUT = `out`;

// Command line
const NODEJS = `node`;
const SEVEN_ZIP = `7z`;
const OTFCCDUMP = `otfccdump`;
const OTFCCBUILD = `otfccbuild`;
const OTF2TTF = `otf2ttf`;

const NPX_SUFFIX = os.platform() === "win32" ? ".cmd" : "";
const TTCIZE = "node_modules/.bin/otfcc-ttcize" + NPX_SUFFIX;
const Chlorophytum = [NODEJS, `./node_modules/@chlorophytum/cli/bin/_startup`];

///////////////////////////////////////////////////////////////////////////////////////////////////
// Entrypoint
const Start = phony("all", async t => {
	await t.need(Ttf);
	await t.need(Ttc);
});

const Ttc = phony(`ttc`, async t => {
	const version = await t.need(Version);
	await t.need(TTCArchive(version));
});

const Ttf = phony(`ttf`, async t => {
	const version = await t.need(Version);
	await t.need(TTFArchive(version));
});

const Dependencies = task(`dependencies`, async t => {
	await t.need(fu`package.json`);
});

const Version = oracle("version", async t => {
	return (await fs.readJson(path.resolve(__dirname, "package.json"))).version;
});

const TTCArchive = file.make(
	version => `${OUT}/sarasa-gothic-ttc-${version}.7z`,
	async (t, target) => {
		await t.need(TtcFontFiles);
		await rm(target.full);
		await SevenZipCompress(`${OUT}/ttc`, target, `*.ttc`);
	}
);
const TTFArchive = file.make(
	version => `${OUT}/sarasa-gothic-ttf-${version}.7z`,
	async (t, target) => {
		const [config] = await t.need(Config, de`${OUT}/ttf`);
		await t.need(TtfFontFiles);

		// StyleOrder is interlaced with "upright" and "italic"
		// Compressing in this order reduces archive size
		await rm(target.full);
		for (let j = 0; j < config.styleOrder.length; j += 2) {
			const styleUpright = config.styleOrder[j];
			const styleItalic = config.styleOrder[j + 1];
			await SevenZipCompress(
				`${OUT}/ttf`,
				target,
				styleUpright ? `*-${styleUpright}.ttf` : null,
				styleItalic ? `*-${styleItalic}.ttf` : null
			);
		}
	}
);

function SevenZipCompress(dir, target, ...inputs) {
	return cd(dir).run(
		[SEVEN_ZIP, `a`],
		[`-t7z`, `-mmt=on`, `-m0=LZMA:a=0:d=256m:fb=256`],
		[`../${target.name}.7z`, ...inputs]
	);
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// TTF Building
const ShsOtd = file.make(
	(region, style) => `${BUILD}/shs/${region}-${style}.otd`,
	async (t, output, region, style) => {
		const [config] = await t.need(Config);
		const shsSourceMap = config.shsSourceMap;
		const [, $1] = await t.need(
			de(output.dir),
			fu`sources/shs/${shsSourceMap.region[region]}-${shsSourceMap.style[style]}.otf`
		);
		const temp = `${output.dir}/${output.name}.tmp.ttf`;
		await run(OTF2TTF, [`-o`, temp], $1.full);
		await run(OTFCCDUMP, `-o`, output.full, temp);
	}
);

const NonKanji = file.make(
	(region, style) => `${BUILD}/non-kanji0/${region}-${style}.ttf`,
	async (t, { full, dir, name }, region, style) => {
		await t.need(Config, Scripts);
		const [$1] = await t.need(ShsOtd(region, style), de(dir));
		const tmpOTD = `${dir}/${name}.otd`;
		await RunFontBuildTask("make/non-kanji/build.js", {
			main: $1.full,
			o: tmpOTD
		});
		await OtfccBuildAsIs(tmpOTD, full);
	}
);

const WS0 = file.make(
	(family, region, style) => `${BUILD}/ws0/${family}-${region}-${style}.ttf`,
	async (t, { full, dir, name }, family, region, style) => {
		const [config] = await t.need(Config, Scripts);
		const [, $1] = await t.need(de(dir), NonKanji(region, style));
		const tmpOTD = `${dir}/${name}.otd`;
		await RunFontBuildTask("make/punct/ws.js", {
			main: $1.full,
			o: tmpOTD,
			mono: config.families[family].isMono || false,
			type: config.families[family].isType || false,
			pwid: config.families[family].isPWID || false,
			term: config.families[family].isTerm || false
		});
		await OtfccBuildAsIs(tmpOTD, full);
	}
);

const AS0 = file.make(
	(family, region, style) => `${BUILD}/as0/${family}-${region}-${style}.ttf`,
	async (t, { full, dir, name }, family, region, style) => {
		const [config] = await t.need(Config, Scripts);
		const [, $1] = await t.need(de(dir), NonKanji(region, style));
		const tmpOTD = `${dir}/${name}.otd`;
		await RunFontBuildTask("make/punct/as.js", {
			main: $1.full,
			o: tmpOTD,
			mono: config.families[family].isMono || false,
			type: config.families[family].isType || false,
			pwid: config.families[family].isPWID || false,
			term: config.families[family].isTerm || false
		});
		await OtfccBuildAsIs(tmpOTD, full);
	}
);

task("as-mono-sc-regular", async $ => {
	await $.need(AS0("mono", "sc", "regular"));
});

const Pass1 = file.make(
	(family, region, style) => `${BUILD}/pass1/${family}-${region}-${style}.ttf`,
	async (t, { full, dir, name }, family, region, style) => {
		const [config] = await t.need(Config, Scripts);
		const latinFamily = config.families[family].latinGroup;
		const [, $1, $2, $3] = await t.need(
			de(dir),
			fu`sources/${latinFamily}/${latinFamily}-${style}.ttf`,
			AS0(family, region, deItalizedNameOf(config, style)),
			WS0(family, region, deItalizedNameOf(config, style))
		);
		await RunFontBuildTask("make/pass1/build.js", {
			main: $1.full,
			asian: $2.full,
			ws: $3.full,
			o: full + ".tmp.ttf",

			family: family,
			subfamily: config.subfamilies[region].name,
			style: style,
			italize: deItalizedNameOf(config, name) === name ? false : true
		});
		await SanitizeTTF(full, full + ".tmp.ttf");
	}
);

const Kanji0 = file.make(
	(region, style) => `${BUILD}/kanji0/${region}-${style}.ttf`,
	async (t, { full, dir, name }, region, style) => {
		await t.need(Config, Scripts);
		const [$1] = await t.need(ShsOtd(region, style), de(dir));
		const tmpOTD = `${dir}/${name}.otd`;
		await RunFontBuildTask("make/kanji/build.js", {
			main: $1.full,
			o: tmpOTD
		});
		await OtfccBuildAsIs(tmpOTD, full);
	}
);
const Hangul0 = file.make(
	(region, style) => `${BUILD}/hangul0/${region}-${style}.ttf`,
	async (t, { full, dir, name }, region, style) => {
		await t.need(Config, Scripts);
		const [$1] = await t.need(ShsOtd(region, style), de(dir));
		const tmpOTD = `${dir}/${name}.otd`;
		await RunFontBuildTask("make/hangul/build.js", {
			main: $1.full,
			o: tmpOTD
		});
		await OtfccBuildAsIs(tmpOTD, full);
	}
);

const Prod = file.make(
	(family, region, style) => `${OUT}/ttf/${PREFIX}-${family}-${region}-${style}.ttf`,
	async (t, { full, dir, name }, family, region, style) => {
		const [config] = await t.need(Config, Scripts, Version);
		const weight = deItalizedNameOf(config, style);
		const [, $1, $2, $3] = await t.need(
			de(dir),
			HfoPass1(weight, family, region, style),
			HfoKanji(weight, region, weight),
			HfoHangul(weight, region, weight)
		);
		const tmpOTD = `${dir}/${name}.otd`;
		await RunFontBuildTask("make/pass2/build.js", {
			main: $1.full,
			kanji: $2.full,
			hangul: $3.full,
			o: tmpOTD,
			italize: weight === style ? false : true
		});
		await OtfccBuildOptimize(tmpOTD, full);
	}
);

///////////////////////////////////////////////////////////////////////////////////////////////////
// HINTING

const HintDirPrefix = `${BUILD}/hf`;
const HintDirOutPrefix = `${BUILD}/hfo`;

const JHint = oracle("hinting-jobs", async () => os.cpus().length);
const KanjiInOTD = file.make(
	(weight, region, style) => `${HintDirPrefix}-${weight}/kanji-${region}-${style}.otd`,
	async (t, { dir, name }, weight, region, style) => {
		const [k0ttf] = await t.need(Kanji0(region, style), de(dir));
		await run(OTFCCDUMP, k0ttf.full, "-o", `${dir}/${name}.otd`);
	}
);
const HangulInOTD = file.make(
	(weight, region, style) => `${HintDirPrefix}-${weight}/hangul-${region}-${style}.otd`,
	async (t, { dir, name }, weight, region, style) => {
		const [k0ttf] = await t.need(Hangul0(region, style), de(dir));
		await run(OTFCCDUMP, k0ttf.full, "-o", `${dir}/${name}.otd`);
	}
);
const Pass1OTD = file.make(
	(weight, family, region, style) =>
		`${HintDirPrefix}-${weight}/pass1-${family}-${region}-${style}.otd`,
	async (t, { dir, name }, weight, family, region, style) => {
		const [k0ttf] = await t.need(Pass1(family, region, style), de(dir));
		await run(OTFCCDUMP, k0ttf.full, "-o", `${dir}/${name}.otd`);
	}
);

const GroupHint = task.make(
	weight => `group-hint::${weight}`,
	async (t, weight) => {
		const [config, jHint, hintParam] = await t.need(
			Config,
			JHint,
			fu`hinting-params/${weight}.json`
		);

		const [kanjiDeps, pass1Deps] = OtdDeps(config, weight);
		const [kanjiOtds, pass1Otds] = await t.need(kanjiDeps, pass1Deps);

		await run(
			Chlorophytum,
			`hint`,
			[`-c`, hintParam.full],
			[`-h`, `${HintDirPrefix}-${weight}/cache.gz`],
			[`--jobs`, jHint],
			[...HintParams([...kanjiOtds, ...pass1Otds])]
		);
	}
);
const HintAll = task(`hint-all`, async t => {
	const [config] = await t.need(Config);
	for (const style in config.styles) {
		if (config.styles[style].uprightStyleMap) continue;
		await t.need(GroupHint(style));
	}
});
const GroupInstr = task.make(
	weight => `group-instr::${weight}`,
	async (t, weight) => {
		const [config, hintParam] = await t.need(Config, fu`hinting-params/${weight}.json`);
		const [kanjiDeps, pass1Deps] = OtdDeps(config, weight);
		const [kanjiOtds, pass1Otds] = await t.need(kanjiDeps, pass1Deps);
		await t.need(HintAll);

		await run(
			Chlorophytum,
			`instruct`,
			[`-c`, hintParam.full],
			[...InstrParams([...kanjiOtds, ...pass1Otds])]
		);
	}
);
const HfoKanji = file.make(
	(weight, region, style) => `${HintDirOutPrefix}-${weight}/kanji-${region}-${style}.ttf`,
	OutTtfMain
);
const HfoHangul = file.make(
	(weight, region, style) => `${HintDirOutPrefix}-${weight}/hangul-${region}-${style}.ttf`,
	OutTtfMain
);
const HfoPass1 = file.make(
	(weight, family, region, style) =>
		`${HintDirOutPrefix}-${weight}/pass1-${family}-${region}-${style}.ttf`,
	OutTtfMain
);
async function OutTtfMain(t, { full, dir, name }, weight) {
	const [hintParam] = await t.need(
		fu`hinting-params/${weight}.json`,
		GroupInstr(weight),
		de`${HintDirOutPrefix}-${weight}`
	);
	await run(
		Chlorophytum,
		`integrate`,
		[`-c`, hintParam.full],
		[
			`${HintDirPrefix}-${weight}/${name}.instr.gz`,
			`${HintDirPrefix}-${weight}/${name}.otd`,
			`${HintDirOutPrefix}-${weight}/${name}.otd`
		]
	);
	await OtfccBuildAsIs(`${HintDirOutPrefix}-${weight}/${name}.otd`, full);
}

// Support functions
function OtdDeps(config, weight) {
	const kanjiDeps = [];
	for (let sf of config.subfamilyOrder) {
		kanjiDeps.push(KanjiInOTD(weight, sf, weight));
		kanjiDeps.push(HangulInOTD(weight, sf, weight));
	}

	const pass1Deps = [];
	for (let f of config.familyOrder) {
		for (let sf of config.subfamilyOrder) {
			for (const style in config.styles) {
				if (deItalizedNameOf(config, style) !== weight) continue;
				pass1Deps.push(Pass1OTD(weight, f, sf, style));
			}
		}
	}

	return [kanjiDeps, pass1Deps];
}
function* HintParams(otds) {
	for (const otd of otds) {
		yield otd.full;
		yield `${otd.dir}/${otd.name}.hint.gz`;
	}
}
function* InstrParams(otds) {
	for (const otd of otds) {
		yield otd.full;
		yield `${otd.dir}/${otd.name}.hint.gz`;
		yield `${otd.dir}/${otd.name}.instr.gz`;
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// TTC building
const TTCFile = file.make(
	style => `${OUT}/ttc/${PREFIX}-${style}.ttc`,
	async (t, { full, dir }, style) => {
		const [config] = await t.need(Config, de`${OUT}/ttc`);

		let requirements = [],
			n = 0;
		for (let family of config.familyOrder) {
			for (let region of config.subfamilyOrder) {
				requirements.push({
					from: Prod(family, region, style),
					otd: `${OUT}/ttc/${PREFIX}-${style}-parts.${n}.otd`,
					ttf: `${OUT}/ttc/${PREFIX}-${style}-parts.${n}.ttf`
				});
				n++;
			}
		}

		const [$$] = await t.need(requirements.map(t => t.from));
		await run(
			TTCIZE,
			["-x", "--common-width", 1000, "--common-height", 1000],
			["-o", full],
			[...$$.map(t => t.full)]
		);
	}
);

const TtcFontFiles = task("ttcFontFiles", async t => {
	const [config] = await t.need(Config, de`${OUT}/ttc`);

	await t.need(config.styleOrder.map(st => TTCFile(st)));
});

const TtfFontFiles = task("ttfFontFiles", async t => {
	const [config] = await t.need(Config, de`${OUT}/ttf`);
	let reqs = [];
	for (let f of config.familyOrder)
		for (let sf of config.subfamilyOrder)
			for (let st of config.styleOrder) {
				reqs.push(Prod(f, sf, st));
			}
	await t.need(...reqs);
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// Build Scripts & Config
const ScriptsStructure = oracle("scripts-dir-structure", target =>
	FileList({ under: `make`, pattern: `**/*.js` })(target)
);

const Scripts = task("scripts", async t => {
	await t.need(Dependencies);
	const [scriptList] = await t.need(ScriptsStructure);
	await t.need(scriptList.map(fu));
});

const Config = oracle("config", async () => {
	return await fs.readJSON(__dirname + "/config.json");
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// CLI wrappers
async function OtfccBuildOptimize(from, to) {
	await run(OTFCCBUILD, from, [`-o`, to], [`-O3`, `-s`, `--keep-average-char-width`, `-q`]);
	await rm(from);
}
async function OtfccBuildAsIs(from, to) {
	await run(OTFCCBUILD, from, [`-o`, to], [`-k`, `-s`, `--keep-average-char-width`, `-q`]);
	await rm(from);
}

async function RunFontBuildTask(recipe, args) {
	return await run(NODEJS, "run", "--recipe", recipe, ...objToArgs(args));
}
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

async function SanitizeTTF(target, ttf) {
	const tmpTTX = `${ttf}.ttx`;
	const tmpTTF2 = `${ttf}.2.ttf`;
	await run("ttx", "-q", "-o", tmpTTX, ttf);
	await run("ttx", "-q", "-o", tmpTTF2, tmpTTX);
	await run("ttfautohint", tmpTTF2, target);
	await rm(ttf);
	await rm(tmpTTX);
	await rm(tmpTTF2);
}

function deItalizedNameOf(config, set) {
	return (set + "")
		.split("-")
		.map(w => (config.styles[w] ? config.styles[w].uprightStyleMap || w : w))
		.join("-");
}
