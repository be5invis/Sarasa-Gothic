"use strict";

const build = require("verda").create();
const { task, file, oracle, phony, computed } = build.ruleTypes;
const { de, fu } = build.rules;
const { run, node, rm, cd, mv, cp } = build.actions;
const { FileList } = build.predefinedFuncs;

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

// Directories
const PREFIX = `sarasa`;
const BUILD = `.build`;
const OUT = `out`;
const SOURCES = `sources`;

// Command line
const NODEJS = `node`;
const SEVEN_ZIP = `7z`;
const OTFCCDUMP = `otfccdump`;
const OTFCCBUILD = `otfccbuild`;
const OTF2TTF = `otf2ttf`;
const OTC2OTF = `otc2otf`;
const TTX = `ttx`;
const Chlorophytum = [NODEJS, `./node_modules/@chlorophytum/cli/bin/_startup`];

build.setJournal(`${BUILD}/.verda-build-journal`);
build.setSelfTracking();
module.exports = build;

///////////////////////////////////////////////////////////////////////////////////////////////////
// Entrypoint
const Start = phony("all", async t => {
	const version = await t.need(Version);
	await t.need(TtfFontFiles`ttf`, TtfFontFiles`ttf-unhinted`);
	await t.need(TtcFontFiles`ttc`, TtcFontFiles`ttc-unhinted`);
	await t.need(
		TtcArchive(`ttc`, version),
		TtcArchive(`ttc-unhinted`, version),
		TtfArchive(`ttf`, version),
		TtfArchive(`ttf-unhinted`, version)
	);
});

const Ttc = phony(`ttc`, async t => {
	await t.need(TtfFontFiles`ttf`, TtfFontFiles`ttf-unhinted`);
	await t.need(TtcFontFiles`ttc`, TtcFontFiles`ttc-unhinted`);
});

const Ttf = phony(`ttf`, async t => {
	await t.need(TtfFontFiles`ttf`, TtfFontFiles`ttf-unhinted`);
});

const Dependencies = oracle("oracles::dependencies", async () => {
	const pkg = await fs.readJSON(__dirname + "/package.json");
	const depJson = {};
	for (const pkgName in pkg.dependencies) {
		const depPkg = await fs.readJSON(__dirname + "/node_modules/" + pkgName + "/package.json");
		const depVer = depPkg.version;
		depJson[pkgName] = depVer;
	}
	return { requirements: pkg.dependencies, actual: depJson };
});

const Version = oracle("oracles::version", async t => {
	return (await fs.readJson(path.resolve(__dirname, "package.json"))).version;
});

const TtcArchive = file.make(
	(infix, version) => `${OUT}/sarasa-gothic-${infix}-${version}.7z`,
	async (t, out, infix) => {
		await t.need(TtcFontFiles(infix));
		await rm(out.full);
		await SevenZipCompress(`${OUT}/${infix}`, out.full, `*.ttc`);
	}
);

const TtfArchive = file.make(
	(infix, version) => `${OUT}/sarasa-gothic-${infix}-${version}.7z`,
	async (t, out, infix) => {
		const [config] = await t.need(Config, TtfFontFiles(infix));
		await rm(out.full);
		for (let j = 0; j < config.styleOrder.length; j += 2) {
			const styleUpright = config.styleOrder[j];
			const styleItalic = config.styleOrder[j + 1];
			await SevenZipCompress(
				`${OUT}/${infix}`,
				out.full,
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
		[path.relative(dir, target), ...inputs]
	);
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// TTF Building

const BreakShsTtc = task.make(
	weight => `break-ttc::${weight}`,
	async ($, weight) => {
		const [config] = await $.need(Config, de(`${BUILD}/shs`));
		const shsSourceMap = config.shsSourceMap;
		await run(
			OTC2OTF,
			`${SOURCES}/shs/${shsSourceMap.defaultRegion}-${shsSourceMap.style[weight]}.ttc`
		);
		for (const regionID in shsSourceMap.region) {
			const region = shsSourceMap.region[regionID];
			const partName = `${region}-${shsSourceMap.style[weight]}.otf`;
			if (await fs.pathExists(`${SOURCES}/shs/${partName}`)) {
				await rm(`${BUILD}/shs/${partName}`);
				await mv(`${SOURCES}/shs/${partName}`, `${BUILD}/shs/${partName}`);
			}
		}
	}
);

const ShsTtf = file.make(
	(region, weight) => `${BUILD}/shs/${region}-${weight}.ttf`,
	async (t, out, region, weight) => {
		const [config] = await t.need(Config, Scripts, BreakShsTtc(weight));
		const shsSourceMap = config.shsSourceMap;
		const [, $1] = await t.need(
			de(out.dir),
			fu`${BUILD}/shs/${shsSourceMap.region[region]}-${shsSourceMap.style[weight]}.otf`
		);
		await run("otf2ttf", "-o", out.full, $1.full);
	}
);

const ShsCassicalOverrideTtf = file.make(
	weight => `${BUILD}/shs-classical-override/${weight}.ttf`,
	async (t, out, weight) => {
		const [config] = await t.need(Config, Scripts);
		const shsSourceMap = config.shsSourceMap;
		const [, $1] = await t.need(
			de(out.dir),
			fu`${SOURCES}/shs-classical-override/${shsSourceMap.classicalOverridePrefix}-${shsSourceMap.classicalOverrideSuffix[weight]}.otf`
		);
		await run("otf2ttf", "-o", out.full, $1.full);
	}
);

const NonKanji = file.make(
	(region, style) => `${BUILD}/non-kanji0/${region}-${style}.ttf`,
	async (t, out, region, style) => {
		await t.need(Config, Scripts);
		const [$1] = await t.need(ShsTtf(region, style), de(out.dir));
		const tmpOTD = `${out.dir}/${out.name}.otd`;
		await RunFontBuildTask("make/non-kanji/build.js", {
			main: $1.full,
			o: tmpOTD
		});
		await OtfccBuildAsIs(tmpOTD, out.full);
	}
);

function flagsOfFamily(config, family) {
	return {
		goth: config.families[family].isGothic || false,
		mono: config.families[family].isMono || false,
		pwid: config.families[family].isPWID || false,
		tnum: config.families[family].isTNUM || false,
		term: config.families[family].isTerm || false
	};
}

const WS0 = file.make(
	(family, region, style) => `${BUILD}/ws0/${family}-${region}-${style}.ttf`,
	(...args) => BuildPunct("ws", ...args)
);

const AS0 = file.make(
	(family, region, style) => `${BUILD}/as0/${family}-${region}-${style}.ttf`,
	(...args) => BuildPunct("as", ...args)
);

async function BuildPunct(blockName, t, out, family, region, style) {
	const [config] = await t.need(Config, Scripts);
	const latinFamily = config.families[family].latinGroup;
	const [, $1, $2] = await t.need(
		de(out.dir),
		NonKanji(region, style),
		LatinSource(latinFamily, style)
	);
	const tmpOTD = `${out.dir}/${out.name}.otd`;
	await RunFontBuildTask(`make/punct/${blockName}.js`, {
		main: $1.full,
		lgc: $2.full,
		o: tmpOTD,
		...flagsOfFamily(config, family)
	});
	await OtfccBuildAsIs(tmpOTD, out.full);
}

const LatinSource = file.make(
	(group, style) => `${BUILD}/latin-${group}/${group}-${style}.ttf`,
	async (t, out, group, style) => {
		const [config] = await t.need(Config, Scripts, de(out.dir));
		const latinCfg = config.latinGroups[group] || {};
		let sourceStyle = style;
		if (latinCfg.styleToFileSuffixMap) {
			sourceStyle = latinCfg.styleToFileSuffixMap[style] || style;
		}
		const isCff = latinCfg.isCff;
		const sourceFile = `sources/${group}/${group}-${sourceStyle}` + (isCff ? ".otf" : ".ttf");
		const [source] = await t.need(fu(sourceFile));
		if (isCff) {
			await run("otf2ttf", "-o", out.full, source.full);
		} else {
			await run("ttfautohint", "-d", source.full, out.full);
		}
	}
);

const Pass1 = file.make(
	(family, region, style) => `${BUILD}/pass1/${family}-${region}-${style}.ttf`,
	async (t, out, family, region, style) => {
		const [config] = await t.need(Config, Scripts);
		const latinFamily = config.families[family].latinGroup;
		const [, $1, $2, $3] = await t.need(
			de(out.dir),
			LatinSource(latinFamily, style),
			AS0(family, region, deItalizedNameOf(config, style)),
			WS0(family, region, deItalizedNameOf(config, style))
		);
		await RunFontBuildTask("make/pass1/index.js", {
			main: $1.full,
			asian: $2.full,
			ws: $3.full,
			o: out.full,

			family: family,
			subfamily: config.subfamilies[region].name,
			style: style,
			italize: deItalizedNameOf(config, out.name) === out.name ? false : true,

			...flagsOfFamily(config, family)
		});
	}
);

const Pass1Hinted = file.make(
	(family, region, style) => `${BUILD}/pass1-hinted/${family}-${region}-${style}.ttf`,
	async (t, out, family, region, style) => {
		const [pass1] = await t.need(Pass1(family, region, style), de(out.dir));
		await run("ttfautohint", pass1.full, out.full);
	}
);

const Kanji0 = file.make(
	(region, style) => `${BUILD}/kanji0/${region}-${style}.ttf`,
	async (t, out, region, style) => {
		const [config] = await t.need(Config, Scripts);
		const [$1] = await t.need(ShsTtf(region, style), de(out.dir));
		let $2 = null;
		if (region === config.shsSourceMap.classicalRegion) {
			[$2] = await t.need(ShsCassicalOverrideTtf(style));
		}
		const tmpOTD = `${out.dir}/${out.name}.otd`;
		await RunFontBuildTask("make/kanji/build.js", {
			main: $1.full,
			classicalOverride: $2 ? $2.full : null,
			o: tmpOTD
		});
		await OtfccBuildAsIs(tmpOTD, out.full);
	}
);

const Hangul0 = file.make(
	(region, style) => `${BUILD}/hangul0/${region}-${style}.ttf`,
	async (t, out, region, style) => {
		await t.need(Config, Scripts);
		const [$1] = await t.need(ShsTtf(region, style), de(out.dir));
		const tmpOTD = `${out.dir}/${out.name}.otd`;
		await RunFontBuildTask("make/hangul/build.js", { main: $1.full, o: tmpOTD });
		await OtfccBuildAsIs(tmpOTD, out.full);
	}
);

const Prod = file.make(
	(family, region, style) => `${OUT}/ttf/${PREFIX}-${family}-${region}-${style}.ttf`,
	(t, out, family, region, style) =>
		MakeProd(t, out, family, region, style, {
			Pass1: HfoPass1,
			Kanji: HfoKanji,
			Hangul: HfoHangul
		})
);

const ProdUnhinted = file.make(
	(family, region, style) => `${OUT}/ttf-unhinted/${PREFIX}-${family}-${region}-${style}.ttf`,
	(t, out, family, region, style) =>
		MakeProd(t, out, family, region, style, {
			Pass1: (w, f, r, s) => Pass1(f, r, s),
			Kanji: (w, r, s) => Kanji0(r, s),
			Hangul: (w, r, s) => Hangul0(r, s)
		})
);

async function MakeProd(t, out, family, region, style, fragT) {
	const [config] = await t.need(Config, Scripts, Version, de(out.dir));
	const weight = deItalizedNameOf(config, style);
	const [, $1, $2, $3] = await t.need(
		de(out.dir),
		fragT.Pass1(weight, family, region, style),
		fragT.Kanji(weight, region, weight),
		fragT.Hangul(weight, region, weight)
	);
	const tmpOTD = `${out.dir}/${out.name}.otd`;
	await RunFontBuildTask("make/pass2/index.js", {
		main: $1.full,
		kanji: $2.full,
		hangul: $3.full,
		o: tmpOTD,
		italize: weight === style ? false : true
	});
	await OtfccBuildOptimize(config, tmpOTD, out.full);
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// HINTING

const HintDirPrefix = `${BUILD}/hf`;
const HintDirOutPrefix = `${BUILD}/hfo`;

const JHint = oracle("hinting-jobs", async () => os.cpus().length);
const KanjiInTtf = file.make(
	(weight, region, style) => `${HintDirPrefix}-${weight}/kanji-${region}-${style}.ttf`,
	async (t, out, weight, region, style) => {
		const [k0ttf] = await t.need(Kanji0(region, style), de(out.dir));
		await cp(k0ttf.full, out.full);
	}
);
const HangulInTtf = file.make(
	(weight, region, style) => `${HintDirPrefix}-${weight}/hangul-${region}-${style}.ttf`,
	async (t, out, weight, region, style) => {
		const [k0ttf] = await t.need(Hangul0(region, style), de(out.dir));
		await cp(k0ttf.full, out.full);
	}
);
const Pass1Ttf = file.make(
	(weight, family, region, style) =>
		`${HintDirPrefix}-${weight}/pass1-${family}-${region}-${style}.ttf`,
	async (t, out, weight, family, region, style) => {
		const [k0ttf] = await t.need(Pass1Hinted(family, region, style), de(out.dir));
		await cp(k0ttf.full, out.full);
	}
);

const GroupHintStyleList = computed(`group-hint-style-list`, async t => {
	const [config] = await t.need(Config);
	const results = [];
	for (const style in config.styles) {
		if (config.styles[style].uprightStyleMap) continue;
		await results.push(style);
	}
	return results;
});

const GroupHintSelfKanji = task.make(
	weight => `group-hint-self-kanji::${weight}`,
	async (t, weight) => {
		const [config, jHint] = await t.need(Config, JHint);
		const [hintParam] = await t.need(fu`hinting-params/${weight}.json`);
		const [kanjiDeps, pass1Deps] = HintingDeps(config, weight);
		const [kanjiTtfs] = await t.need(kanjiDeps);

		await run(
			Chlorophytum,
			`hint`,
			[`-c`, hintParam.full],
			[`-h`, `${HintDirPrefix}-${weight}/cache-kanji.gz`],
			[`--jobs`, jHint],
			Array.from(HintParams(kanjiTtfs))
		);
	}
);

const GroupHintSelfPass1 = task.make(
	weight => `group-hint-self-pass1::${weight}`,
	async (t, weight) => {
		const [config, jHint] = await t.need(Config, JHint);
		const [hintParam] = await t.need(fu`hinting-params/${weight}.json`);
		const [kanjiDeps, pass1Deps] = HintingDeps(config, weight);
		const [pass1Ttfs] = await t.need(pass1Deps);

		await run(
			Chlorophytum,
			`hint`,
			[`-c`, hintParam.full],
			[`-h`, `${HintDirPrefix}-${weight}/cache-pass1.gz`],
			[`--jobs`, jHint],
			Array.from(HintParams(pass1Ttfs))
		);
	}
);

const GroupHintDependentKanji = task.make(
	weight => `group-hint-dependent::${weight}`,
	async (t, weight) => {
		const [styleList] = await t.need(GroupHintStyleList);
		const weightIndex = styleList.indexOf(weight);
		if (weightIndex > 0) await t.need(GroupHintDependentKanji(styleList[weightIndex - 1]));
		await t.need(GroupHintSelfKanji(weight));
	}
);

const GroupInstr = task.make(
	weight => `group-instr::${weight}`,
	async (t, weight) => {
		const outDir = `${HintDirOutPrefix}-${weight}`;
		const [config, hintParam] = await t.need(
			Config,
			fu`hinting-params/${weight}.json`,
			de(outDir)
		);
		const [kanjiDeps, pass1Deps] = HintingDeps(config, weight);
		const [kanjiTtfs, pass1Ttfs] = await t.need(kanjiDeps, pass1Deps);
		await t.need(GroupHintDependentKanji(weight), GroupHintSelfPass1(weight));

		await run(
			Chlorophytum,
			`instruct`,
			[`-c`, hintParam.full],
			[...InstrParams(outDir, [...pass1Ttfs, ...kanjiTtfs])]
		);
	}
);
const GroupInstrAll = task(`group-instr-all`, async t => {
	const [styleList] = await t.need(GroupHintStyleList);
	await t.need(styleList.map(w => GroupInstr(w)));
});

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
async function OutTtfMain(t, out, weight) {
	await t.need(GroupInstrAll);
}

// Support functions
function HintingDeps(config, weight) {
	const kanjiDeps = [];
	for (let sf of config.subfamilyOrder) {
		kanjiDeps.push(KanjiInTtf(weight, sf, weight));
		kanjiDeps.push(HangulInTtf(weight, sf, weight));
	}

	const pass1Deps = [];
	for (let f of config.familyOrder) {
		for (let sf of config.subfamilyOrder) {
			for (const style in config.styles) {
				if (deItalizedNameOf(config, style) !== weight) continue;
				pass1Deps.push(Pass1Ttf(weight, f, sf, style));
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
function* InstrParams(toDir, otds) {
	for (const otd of otds) {
		yield otd.full;
		yield `${otd.dir}/${otd.name}.hint.gz`;
		yield `${toDir}/${otd.name}.ttf`;
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// TTC building
const TtcFile = file.make(
	(infix, style) => `${OUT}/${infix}/${PREFIX}-${style}.ttc`,
	async (t, out, infix, style) => {
		const prodT = /unhinted/.test(infix) ? ProdUnhinted : Prod;
		const [config] = await t.need(Config, de(out.dir));
		let requirements = [];
		for (let family of config.familyOrder) {
			for (let region of config.subfamilyOrder) {
				requirements.push(prodT(family, region, style));
			}
		}
		const [$$] = await t.need(requirements);
		await MakeTtc(config, [...$$.map(t => t.full)], out.full);
	}
);

const TtcFontFiles = task.make(
	infix => `intermediate::ttcFontFiles::${infix}`,
	async (t, infix) => {
		const [config] = await t.need(Config);
		await t.need(config.styleOrder.map(st => TtcFile(infix, st)));
	}
);

const TtfFontFiles = task.make(
	infix => `intermediate::ttfFontFiles::${infix}`,
	async (t, infix) => {
		const prodT = /unhinted/.test(infix) ? ProdUnhinted : Prod;
		const [config] = await t.need(Config);
		let reqs = [];
		for (let f of config.familyOrder)
			for (let sf of config.subfamilyOrder)
				for (let st of config.styleOrder) {
					reqs.push(prodT(f, sf, st));
				}
		await t.need(...reqs);
	}
);

///////////////////////////////////////////////////////////////////////////////////////////////////
// Build Scripts & Config
const ScriptsStructure = oracle("dep::scripts-dir-structure", target =>
	FileList({ under: `make`, pattern: `**/*.js` })(target)
);

const Scripts = task("dep::scripts", async t => {
	await t.need(Dependencies);
	const [scriptList] = await t.need(ScriptsStructure);
	await t.need(scriptList.map(fu));
});

const Config = oracle("dep::config", async () => {
	const configPath = __dirname + "/config.json";
	const privateConfigPath = __dirname + "/config.private.json";
	const config = await fs.readJSON(configPath);
	if (fs.existsSync(privateConfigPath)) {
		const privateConfig = await fs.readJSON(privateConfigPath);
		config.buildOptions = Object.assign(
			{},
			config.buildOptions || {},
			privateConfig.buildOptions || {}
		);
	}
	return config;
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// Cleanup
phony(`clean`, async () => {
	build.deleteJournal();
});
phony(`full-clean`, async () => {
	await rm(BUILD);
	await rm(OUT);
	build.deleteJournal();
});

///////////////////////////////////////////////////////////////////////////////////////////////////
// CLI wrappers
async function OtfccBuildOptimize(config, from, to) {
	const tmpTo = to + ".tmp.otf";
	const tmpTtx = to + ".tmp.ttx";
	await run(OTFCCBUILD, from, [`-o`, tmpTo], [`-O3`, `-s`, `--keep-average-char-width`, `-q`]);
	await rm(from);
	if (config.buildOptions.optimizeWithFilter) {
		const filterArgs = config.buildOptions.optimizeWithFilter.split(/ +/g);
		await run(filterArgs, tmpTo, to);
		await rm(tmpTo);
	} else if (config.buildOptions.optimizeWithTtx) {
		await run(TTX, "-q", ["-o", tmpTtx], tmpTo);
		await rm(tmpTo);
		await run(TTX, "-q", ["-o", to], tmpTtx);
		await rm(tmpTtx);
	} else {
		await mv(tmpTo, to);
	}
}
async function OtfccBuildAsIs(from, to) {
	await run(OTFCCBUILD, from, [`-o`, to], [`-k`, `-s`, `--keep-average-char-width`, `-q`]);
	await rm(from);
}

async function MakeTtc(config, from, to) {
	const optimization = config.buildOptions.optimizeWithFilter
		? { filterLoop: config.buildOptions.optimizeWithFilter }
		: {};
	await rm(to);
	await node("make/common/make-ttc/index", {
		inputs: from,
		output: to,
		commonWidth: 1000,
		commonHeight: 1000,
		...optimization
	});
}

async function RunFontBuildTask(recipe, args) {
	return await node(recipe, args);
}

function deItalizedNameOf(config, set) {
	return (set + "")
		.split("-")
		.map(w => (config.styles[w] ? config.styles[w].uprightStyleMap || w : w))
		.join("-");
}
