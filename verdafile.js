"use strict";

const build = require("verda").create();
const { task, tasks, files, oracle, phony } = build.ruleTypes;
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

///////////////////////////////////////////////////////////////////////////////////////////////////
// Entrypoint
const Start = phony("start", async t => {
	await t.need(Ttf);
	await t.need(Ttc);
});

const Ttc = phony(`ttc`, async t => {
	const version = await t.need(Version);
	await t.need(TTCArchive`${OUT}/${PREFIX}-gothic-ttc-${version}.7z`);
});

const Ttf = phony(`ttf`, async t => {
	const version = await t.need(Version);
	await t.need(TTFArchive`${OUT}/${PREFIX}-gothic-ttf-${version}.7z`);
});

const Dependencies = task(`dependencies`, async t => {
	await t.need(fu`package.json`);
});

const Version = oracle("version", async t => {
	return (await fs.readJson(path.resolve(__dirname, "package.json"))).version;
});

const TTCArchive = files(`${OUT}/sarasa-gothic-ttc-*.7z`, async (t, target) => {
	await t.need(TtcFontFiles);
	await cd(`${OUT}/ttc`).run(
		[SEVEN_ZIP, `a`],
		[`-t7z`, `-mmt=on`, `-m0=LZMA:a=0:d=1536m:fb=256`],
		[`../${target.name}.7z`, `*.ttc`]
	);
});
const TTFArchive = files(`${OUT}/sarasa-gothic-ttf-*.7z`, async (t, target) => {
	const [config] = await t.need(Config, de`${OUT}/ttf`);
	await t.need(TtfFontFiles);
	await rm(target.full);

	// StyleOrder is interlaced with "upright" and "italic"
	// Compressing in this order reduces archive size
	for (let j = 0; j < config.styleOrder.length; j += 2) {
		const styleUpright = config.styleOrder[j];
		const styleItalic = config.styleOrder[j + 1];
		await cd(`${OUT}/ttf`).run(
			[`7z`, `a`],
			[`-t7z`, `-mmt=on`, `-m0=LZMA:a=0:d=1536m:fb=256`],
			[
				`../${target.name}.7z`,
				styleUpright ? `*-${styleUpright}.ttf` : null,
				styleItalic ? `*-${styleItalic}.ttf` : null
			]
		);
	}
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// TTF Building
const ShsOtd = files(`${BUILD}/shs/*-*.otd`, async (t, { full, dir, $: [region, style] }) => {
	const [config] = await t.need(Config);
	const shsSourceMap = config.shsSourceMap;
	const [, $1] = await t.need(
		de(dir),
		fu`sources/shs/${shsSourceMap.region[region]}-${shsSourceMap.style[style]}.otf`
	);
	await run(OTFCCDUMP, `-o`, full, $1.full);
});

const WS0 = files(
	`${BUILD}/ws0/*-*-*.ttf`,
	async (t, { full, dir, name, $: [family, region, style] }) => {
		const [config] = await t.need(Config, Scripts);
		const [, $1] = await t.need(de(dir), ShsOtd`${BUILD}/shs/${region}-${style}.otd`);
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

const AS0 = files(
	`${BUILD}/as0/*-*-*.ttf`,
	async (t, { full, dir, name, $: [family, region, style] }) => {
		const [config] = await t.need(Config, Scripts);
		const [, $1] = await t.need(de(dir), ShsOtd`${BUILD}/shs/${region}-${style}.otd`);
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

const Pass1 = files(
	`${BUILD}/pass1/*-*-*.ttf`,
	async (t, { full, dir, name, $: [family, region, style] }) => {
		const [config] = await t.need(Config, Scripts);
		const latinFamily = config.families[family].latinGroup;
		const [, $1, $2, $3] = await t.need(
			de(dir),
			fu`sources/${latinFamily}/${latinFamily}-${style}.ttf`,
			AS0`${BUILD}/as0/${family}-${region}-${deItalizedNameOf(config, style)}.ttf`,
			WS0`${BUILD}/ws0/${family}-${region}-${deItalizedNameOf(config, style)}.ttf`
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

const Kanji0 = files(`${BUILD}/kanji0/*.ttf`, async (t, { full, dir, name }) => {
	await t.need(Config, Scripts);
	const [$1] = await t.need(ShsOtd`${BUILD}/shs/${name}.otd`, de(dir));
	const tmpOTD = `${dir}/${name}.otd`;
	await RunFontBuildTask("make/kanji/build.js", {
		main: $1.full,
		o: tmpOTD
	});
	await OtfccBuildAsIs(tmpOTD, full);
});

const Prod = files(
	`${OUT}/ttf/${PREFIX}-*-*-*.ttf`,
	async (t, { full, dir, name, $: [family, region, style] }) => {
		const [config] = await t.need(Config, Scripts, Version);
		const weight = deItalizedNameOf(config, style);
		const [, $1, $2] = await t.need(
			de(dir),
			HfoTtf`${HintDirOutPrefix}-${weight}/pass1-${family}-${region}-${style}.ttf`,
			HfoTtf`${HintDirOutPrefix}-${weight}/kanji-${region}-${weight}.ttf`
		);
		const tmpOTD = `${dir}/${name}.otd`;
		await RunFontBuildTask("make/pass2/build.js", {
			main: $1.full,
			kanji: $2.full,
			o: tmpOTD,
			italize: weight === style ? false : true
		});
		await OtfccBuildOptimize(tmpOTD, full);
	}
);

///////////////////////////////////////////////////////////////////////////////////////////////////
// HINTING
const Chlorophytum = [
	NODEJS,
	`--experimental-worker`,
	`--max-old-space-size=8192`,
	`./node_modules/@chlorophytum/cli/lib/index.js`
];
const HintDirPrefix = `${BUILD}/hf`;
const HintDirOutPrefix = `${BUILD}/hfo`;

const JHint = oracle("hinting-jobs", async () => os.cpus().length);
const KanjiInOTD = files(
	`${HintDirPrefix}-*/kanji-*.otd`,
	async (t, { dir, name, $: [style, sf] }) => {
		const [k0ttf] = await t.need(Kanji0`${BUILD}/kanji0/${sf}.ttf`, de(dir));
		await run(OTFCCDUMP, k0ttf.full, "-o", `${dir}/${name}.otd`);
	}
);
const Pass1OTD = files(
	`${HintDirPrefix}-*/pass1-*-*-*.otd`,
	async (t, { dir, name, $: [weight, f, sf, style] }) => {
		const [k0ttf] = await t.need(Pass1`${BUILD}/pass1/${f}-${sf}-${style}.ttf`, de(dir));
		await run(OTFCCDUMP, k0ttf.full, "-o", `${dir}/${name}.otd`);
	}
);

const GroupHint = tasks(`group-hint::*`, async (t, weight) => {
	const [config, jHint, hintParam] = await t.need(
		Config,
		JHint,
		fu(`hinting-params/${weight}.json`)
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
});
const HintAll = task(`hint-all`, async t => {
	const [config] = await t.need(Config);
	for (const style in config.styles) {
		if (config.styles[style].uprightStyleMap) continue;
		await t.need(GroupHint`group-hint::${style}`);
	}
});
const GroupInstr = tasks(`group-instr::*`, async (t, weight) => {
	const [config, hintParam] = await t.need(Config, fu(`hinting-params/${weight}.json`));
	const [kanjiDeps, pass1Deps] = OtdDeps(config, weight);
	const [kanjiOtds, pass1Otds] = await t.need(kanjiDeps, pass1Deps);
	await t.need(HintAll);

	await run(
		Chlorophytum,
		`instruct`,
		[`-c`, hintParam.full],
		[...InstrParams([...kanjiOtds, ...pass1Otds])]
	);
});
const HfoTtf = files(`${HintDirOutPrefix}-*/*.ttf`, async (t, { full, dir, name, $: [weight] }) => {
	const [hintParam] = await t.need(
		fu(`hinting-params/${weight}.json`),
		GroupInstr`group-instr::${weight}`,
		de(`${HintDirOutPrefix}-${weight}`)
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
});

// Support functions
function OtdDeps(config, weight) {
	const kanjiDeps = [];
	for (let sf of config.subfamilyOrder) {
		kanjiDeps.push(KanjiInOTD`${HintDirPrefix}-${weight}/kanji-${sf}-${weight}.otd`);
	}

	const pass1Deps = [];
	for (let f of config.familyOrder) {
		for (let sf of config.subfamilyOrder) {
			for (const style in config.styles) {
				if (deItalizedNameOf(config, style) !== weight) continue;
				pass1Deps.push(Pass1OTD`${HintDirPrefix}-${weight}/pass1-${f}-${sf}-${style}.otd`);
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
const TTCFile = files(`${OUT}/ttc/${PREFIX}-*.ttc`, async (t, { full, dir, $: [style] }) => {
	const [config] = await t.need(Config, de`${OUT}/ttc`);

	let requirements = [],
		n = 0;
	for (let f of config.familyOrder) {
		for (let sf of config.subfamilyOrder) {
			requirements.push({
				from: Prod`${OUT}/ttf/${PREFIX}-${f}-${sf}-${style}.ttf`,
				otd: `${OUT}/ttc/${PREFIX}-${style}-parts.${n}.otd`,
				ttf: `${OUT}/ttc/${PREFIX}-${style}-parts.${n}.ttf`
			});
			n++;
		}
	}

	const [$$] = await t.need(requirements.map(t => t.from));
	const ttcize = "node_modules/.bin/otfcc-ttcize" + (os.platform() === "win32" ? ".cmd" : "");
	await run(
		ttcize,
		["--prefix", `${OUT}/ttc/${PREFIX}-${style}-parts`],
		[...$$.map(t => t.full)],
		["-k", "-h"]
	);

	for (const { otd, ttf } of requirements) {
		await OtfccBuildAsIs(otd, ttf);
	}
	await run(`otf2otc`, ["-o", full], requirements.map(t => t.ttf));
	for (const { ttf } of requirements) await rm(ttf);
});

const TtcFontFiles = task("ttcFontFiles", async t => {
	const [config] = await t.need(Config, de`${OUT}/ttc`);

	await t.need(config.styleOrder.map(st => TTCFile`${OUT}/ttc/${PREFIX}-${st}.ttc`));
});

const TtfFontFiles = task("ttfFontFiles", async t => {
	const [config] = await t.need(Config, de`${OUT}/ttf`);
	let reqs = [];
	for (let f of config.familyOrder)
		for (let sf of config.subfamilyOrder)
			for (let st of config.styleOrder) {
				reqs.push(Prod`${OUT}/ttf/${PREFIX}-${f}-${sf}-${st}.ttf`);
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
