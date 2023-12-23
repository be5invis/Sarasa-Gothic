import os from "os";
import path from "path";
import * as url from "url";

import fs from "fs-extra";
import verda from "verda";

export const build = verda.create();
const { task, file, oracle, phony, computed } = build.ruleTypes;
const { de, fu } = build.rules;
const { run, node, rm, cd, mv, cp } = build.actions;
const { FileList } = build.predefinedFuncs;

// Directories
const PREFIX = `Sarasa`;
const BUILD = `.build`;
const OUT = `out`;
const SOURCES = `sources`;
const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

// Command line
const NODEJS = `node`;
const SEVEN_ZIP = process.env.SEVEN_ZIP_PATH || "7z";
const OTC2OTF = `otc2otf`;

const TTC_BUNDLE = [
	NODEJS,
	`--max-old-space-size=16384`,
	`node_modules/otb-ttc-bundle/bin/otb-ttc-bundle`
];
const Chlorophytum = [NODEJS, `node_modules/@chlorophytum/cli/bin/_startup`];

build.setJournal(`${BUILD}/.verda-build-journal`);
build.setSelfTracking();

///////////////////////////////////////////////////////////////////////////////////////////////////
// Entrypoint
const Start = phony("all", async t => {
	const version = await t.need(Version);
	await t.need(TtfFontFiles`TTF`, TtfFontFiles`TTF-Unhinted`);
	// Do in serial -- otherwise, memory usage will be too high.
	await t.need(TtcFontFiles`TTC`);
	await t.need(TtcFontFiles`TTC-Unhinted`);
	await t.need(
		TtcArchive(`TTC`, version),
		TtcArchive(`TTC-Unhinted`, version),
		SuperTtcArchive(`TTC`, version),
		SuperTtcArchive(`TTC-Unhinted`, version),
		TtfArchive(`TTF`, version),
		TtfArchive(`TTF-Unhinted`, version)
	);
});

const SuperTtc = phony(`super-ttc`, async target => {
	await target.need(SuperTtcFile`TTC`, SuperTtcFile`TTC-Unhinted`);
});

const Ttc = phony(`ttc`, async t => {
	await t.need(TtfFontFiles`TTF`, TtfFontFiles`TTF-Unhinted`);
	// Do in serial -- otherwise, memory usage will be too high.
	await t.need(TtcFontFiles`TTC`);
	await t.need(TtcFontFiles`TTC-Unhinted`);
});

const Ttf = phony(`ttf`, async t => {
	await t.need(TtfFontFiles`TTF`, TtfFontFiles`TTF-Unhinted`);
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

const SuperTtcArchive = file.make(
	(infix, version) => `${OUT}/${PREFIX}-Super${infix}-${version}.7z`,
	async (t, out, infix) => {
		const [input] = await t.need(SuperTtcFile(infix));
		await rm(out.full);
		await SevenZipCompress(`${OUT}/.super-ttc`, out.full, input.base);
	}
);
const TtcArchive = file.make(
	(infix, version) => `${OUT}/${PREFIX}-${infix}-${version}.7z`,
	async (t, out, infix) => {
		await t.need(TtcFontFiles(infix));
		await rm(out.full);
		await SevenZipCompress(`${OUT}/${infix}`, out.full, `*.ttc`);
	}
);

const TtfArchive = file.make(
	(infix, version) => `${OUT}/${PREFIX}-${infix}-${version}.7z`,
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
		const shsSuffix = shsSourceMap.styleMap[weight] || weight;
		await run(OTC2OTF, `${SOURCES}/shs/${shsSourceMap.defaultRegion}-${shsSuffix}.ttc`);
		for (const regionID in shsSourceMap.region) {
			const shsPrefix = shsSourceMap.region[regionID];
			const partName = `${shsPrefix}-${shsSuffix}.otf`;
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
		const [config] = await t.need(Config, BreakShsTtc(weight));
		const shsSourceMap = config.shsSourceMap;
		const shsPrefix = shsSourceMap.region[region];
		const shsSuffix = shsSourceMap.styleMap[weight] || weight;
		const [, $1] = await t.need(de(out.dir), fu`${BUILD}/shs/${shsPrefix}-${shsSuffix}.otf`);
		await run("otf2ttf", "-o", out.full, $1.full);
	}
);

const ShsCassicalOverrideTtf = file.make(
	weight => `${BUILD}/shs-classical-override/${weight}.ttf`,
	async (t, out, weight) => {
		const [config] = await t.need(Config);
		const shsSourceMap = config.shsSourceMap;
		const shsPrefix = shsSourceMap.classicalOverridePrefix;
		const shsWeight = shsSourceMap.classicalOverrideSuffixMap[weight] || weight;
		const [, $1] = await t.need(
			de(out.dir),
			fu`${SOURCES}/shs-classical-override/${shsPrefix}-${shsWeight}.otf`
		);
		await run("otf2ttf", "-o", out.full, $1.full);
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
		await RunFontBuildTask("make/kanji/build.mjs", {
			main: $1.full,
			classicalOverride: $2 ? $2.full : null,
			o: out.full
		});
	}
);

const Hangul0 = file.make(
	(region, style) => `${BUILD}/hangul0/${region}-${style}.ttf`,
	async (t, out, region, style) => {
		await t.need(Config, Scripts);
		const [$1] = await t.need(ShsTtf(region, style), de(out.dir));
		await RunFontBuildTask("make/hangul/build.mjs", { main: $1.full, o: out.full });
	}
);

const NonKanji = file.make(
	(region, style) => `${BUILD}/non-kanji0/${region}-${style}.ttf`,
	async (t, out, region, style) => {
		await t.need(Config, Scripts);
		const [$1] = await t.need(ShsTtf(region, style), de(out.dir));
		await RunFontBuildTask("make/non-kanji/build.mjs", { main: $1.full, o: out.full });
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

const FEMisc0 = file.make(
	(family, region, style) => `${BUILD}/fe-misc0/${family}-${region}-${style}.ttf`,
	(...args) => BuildPunct("fe-misc", ...args)
);

async function BuildPunct(blockName, t, out, family, region, style) {
	const [config] = await t.need(Config, Scripts);
	const latinFamily = config.families[family].latinGroup;
	const [, $1, $2] = await t.need(
		de(out.dir),
		NonKanji(region, style),
		LatinSource(latinFamily, style)
	);
	await RunFontBuildTask(`make/punct/${blockName}.mjs`, {
		main: $1.full,
		lgc: $2.full,
		o: out.full,
		...flagsOfFamily(config, family)
	});
}

const LatinSource = file.make(
	(group, style) => `${BUILD}/latin-${group}/${group}-${style}.ttf`,
	async (t, out, group, style) => {
		const [config] = await t.need(Config, Scripts, de(out.dir));
		const latinCfg = config.latinGroups[group] || {};
		let sourceStyle = style;
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
		const [, $1, $2, $3, $4] = await t.need(
			de(out.dir),
			LatinSource(latinFamily, style),
			AS0(family, region, deItalizedNameOf(config, style)),
			WS0(family, region, deItalizedNameOf(config, style)),
			FEMisc0(family, region, deItalizedNameOf(config, style))
		);
		await RunFontBuildTask("make/pass1/index.mjs", {
			main: $1.full,
			as: $2.full,
			ws: $3.full,
			feMisc: $4.full,
			o: out.full,

			family: family,
			subfamily: region,
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

const Prod = file.make(
	(family, region, style) => `${OUT}/TTF/${PREFIX}${family}${region}-${style}.ttf`,
	(t, out, family, region, style) =>
		MakeProd(t, out, family, region, style, {
			Pass1: HfoPass1,
			Kanji: HfoHani,
			Hangul: HfoHang
		})
);

const ProdUnhinted = file.make(
	(family, region, style) => `${OUT}/TTF-Unhinted/${PREFIX}${family}${region}-${style}.ttf`,
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

	await RunFontBuildTask("make/pass2/index.mjs", {
		main: $1.full,
		kanji: $2.full,
		hangul: $3.full,
		o: out.full,
		italize: weight === style ? false : true
	});
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// HINTING

const HintDirPrefix = weight => `${BUILD}/hf-${weight}`;
const JHint = oracle("hinting-jobs", async () => os.cpus().length);

const GroupHintStyleList = computed(`group-hint-style-list`, async t => {
	const [config] = await t.need(Config);
	const results = [];
	for (const style in config.styles) {
		if (config.styles[style].uprightStyleMap) continue;
		await results.push(style);
	}
	return results;
});

const GroupHintSelfPass1 = file.make(
	weight => `${HintDirPrefix(weight)}/cache-pass1.gz`,
	async (t, out, weight) => {
		const [config, jHint] = await t.need(Config, JHint);
		const [hintCfg] = await t.need(fu`hcfg/${weight}.json`);
		const hd = HintingDeps(config, weight);

		await t.need(hd.pass1Deps);
		await run(
			Chlorophytum,
			`hint`,
			[`-c`, hintCfg.full],
			[`-h`, out.full],
			[`--jobs`, jHint],
			Array.from(HintParams(hd.pass1Params))
		);
	}
);
const GroupHintSelfIdeo = file.make(
	weight => `${HintDirPrefix(weight)}/cache-ideo.gz`,
	async (t, out, weight) => {
		const [config, jHint] = await t.need(Config, JHint);
		const [hintCfg] = await t.need(fu`hcfg/${weight}.json`);
		const hd = HintingDeps(config, weight);
		await t.need(hd.haniDeps, hd.hangDeps);
		await run(
			Chlorophytum,
			`hint`,
			[`-c`, hintCfg.full],
			[`-h`, out.full],
			[`--jobs`, jHint],
			Array.from(HintParams(hd.haniParams)),
			Array.from(HintParams(hd.hangParams))
		);
	}
);
const HgzHani = file.make(
	(weight, region, style) => `${HintDirPrefix(weight)}/hani/${region}-${style}.hint.gz`,
	(t, out, weight, region, style) => t.need(GroupHintSelfIdeo(weight))
);
const HgzHang = file.make(
	(weight, region, style) => `${HintDirPrefix(weight)}/hang/${region}-${style}.hint.gz`,
	(t, out, weight, region, style) => t.need(GroupHintSelfIdeo(weight))
);
const HgzPass1 = file.make(
	(weight, family, region, style) =>
		`${HintDirPrefix(weight)}/pass1/${family}-${region}-${style}.hint.gz`,
	(t, out, weight, family, region, style) => t.need(GroupHintSelfPass1(weight))
);

const GroupHintDependent = task.make(
	weight => `group-hint-dependent::${weight}`,
	async (t, weight) => {
		const [styleList] = await t.need(GroupHintStyleList);
		const weightIndex = styleList.indexOf(weight);
		if (weightIndex > 0) await t.need(GroupHintDependent(styleList[weightIndex - 1]));
		await t.need(GroupHintSelfPass1(weight), GroupHintSelfIdeo(weight));
	}
);

const GroupInstr = task.make(
	weight => `group-instr::${weight}`,
	async (t, weight) => {
		const [config, hintCfg] = await t.need(Config, fu`hcfg/${weight}.json`);
		const hd = HintingDeps(config, weight);
		await t.need(GroupHintDependent(weight));
		await t.need(hd.pass1Results, hd.haniResults, hd.hangResults);

		await run(
			Chlorophytum,
			`instruct`,
			[`-c`, hintCfg.full],
			hd.pass1Params,
			hd.haniParams,
			hd.hangParams
		);
	}
);
const GroupInstrAll = task(`group-instr-all`, async t => {
	const [styleList] = await t.need(GroupHintStyleList);
	await t.need(styleList.map(w => GroupInstr(w)));
});

const HfoHani = file.make(
	(weight, region, style) => `${HintDirPrefix(weight)}/hani/${region}-${style}.ttf`,
	HfoBuildProc
);
const HfoHang = file.make(
	(weight, region, style) => `${HintDirPrefix(weight)}/hang/${region}-${style}.ttf`,
	HfoBuildProc
);
const HfoPass1 = file.make(
	(weight, family, region, style) =>
		`${HintDirPrefix(weight)}/pass1/${family}-${region}-${style}.ttf`,
	HfoBuildProc
);
async function HfoBuildProc(t, out, weight) {
	await t.need(de(out.dir));
	await t.need(GroupInstrAll);
}

// Support functions
function HintingDeps(config, weight) {
	let out = {
		haniDeps: [],
		hangDeps: [],
		pass1Deps: [],

		haniResults: [],
		hangResults: [],
		pass1Results: [],

		haniParams: [],
		hangParams: [],
		pass1Params: []
	};

	for (let sf of config.subfamilyOrder) {
		{
			const input = Kanji0(sf, weight);
			const hgz = HgzHani(weight, sf, weight);
			const hfo = HfoHani(weight, sf, weight);

			out.haniDeps.push(input);
			out.haniResults.push(hgz);
			out.haniParams.push([
				file.getPathOf(input).full,
				file.getPathOf(hgz).full,
				file.getPathOf(hfo).full
			]);
		}

		{
			const input = Hangul0(sf, weight);
			const hgz = HgzHang(weight, sf, weight);
			const hfo = HfoHang(weight, sf, weight);

			out.hangDeps.push(input);
			out.hangResults.push(hgz);
			out.hangParams.push([
				file.getPathOf(input).full,
				file.getPathOf(hgz).full,
				file.getPathOf(hfo).full
			]);
		}
	}

	for (let f of config.familyOrder) {
		for (let sf of config.subfamilyOrder) {
			for (const style in config.styles) {
				if (deItalizedNameOf(config, style) !== weight) continue;

				const input = Pass1Hinted(f, sf, style);
				const hgz = HgzPass1(weight, f, sf, style);
				const hfo = HfoPass1(weight, f, sf, style);

				out.pass1Deps.push(input);
				out.pass1Results.push(hgz);
				out.pass1Params.push([
					file.getPathOf(input).full,
					file.getPathOf(hgz).full,
					file.getPathOf(hfo).full
				]);
			}
		}
	}

	return out;
}

function* HintParams(items) {
	for (const [input, hgz, hfo] of items) {
		yield [input, hgz];
	}
}

///////////////////////////////////////////////////////////////////////////////////////////////////
// TTC building

const TtcFile = file.make(
	(infix, style) => `${OUT}/${infix}/${PREFIX}-${style}.ttc`,
	async (t, out, infix, style) => {
		const prodT = /Unhinted/i.test(infix) ? ProdUnhinted : Prod;
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
		const prodT = /Unhinted/i.test(infix) ? ProdUnhinted : Prod;
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

const SuperTtcFile = file.make(
	infix => `${OUT}/.super-ttc/${PREFIX}-Super${infix}.ttc`,
	async (target, out, infix) => {
		const [config] = await target.need(Config, de(out.dir));
		const [inputs] = await target.need(config.styleOrder.map(st => TtcFile(infix, st)));
		await MakeSuperTtc(
			config,
			inputs.map(x => x.full),
			out.full
		);
	}
);

///////////////////////////////////////////////////////////////////////////////////////////////////
// Build Scripts & Config
const ScriptsStructure = oracle("dep::scripts-dir-structure", target =>
	FileList({ under: `make`, pattern: `**/*.mjs` })(target)
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

async function MakeTtc(config, from, to) {
	await run(TTC_BUNDLE, "--verbose", "-x", ["-o", to], from);
}
async function MakeSuperTtc(config, from, to) {
	await run(TTC_BUNDLE, "--verbose", ["-o", to], from);
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
export default build;
