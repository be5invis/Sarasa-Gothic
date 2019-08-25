"use strict";

const build = require("verda").create();
const { task, tasks, files, oracle, computed, phony } = build.ruleTypes;
const { de, fu } = build.rules;
const { run, rm, cd } = build.actions;
const { FileList } = build.predefinedFuncs;
module.exports = build;

const BUILD = "build";
build.setJournal(`${BUILD}/.verda-build-journal`);
build.setSelfTracking();

///////////////////////////////////////////////////////////////////////////////

const fs = require("fs-extra");
const path = require("path");
const os = require("os");

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
	return await run("node", "run", "--recipe", recipe, ...objToArgs(args));
}

async function sanitize(target, ttf) {
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

const Config = oracle("config", async () => {
	return await fs.readJSON(__dirname + "/config.json");
});

const ShsOtd = files(`build/shs/*-*.otd`, async (t, { full, dir, $: [region, style] }) => {
	const [config] = await t.need(Config);
	const shsSourceMap = config.shsSourceMap;
	const [, $1] = await t.need(
		de(dir),
		fu`sources/shs/${shsSourceMap.region[region]}-${shsSourceMap.style[style]}.otf`
	);
	await run(`otfccdump`, `-o`, full, $1.full);
});

const WS0 = files(
	`build/ws0/*-*-*.ttf`,
	async (t, { full, dir, name, $: [family, region, style] }) => {
		const [config] = await t.need(Config, Scripts);
		const [, $1] = await t.need(de(dir), ShsOtd`build/shs/${region}-${style}.otd`);
		const tmpOTD = `${dir}/${name}.otd`;
		await runBuildTask("make/punct/ws.js", {
			main: $1.full,
			o: tmpOTD,
			mono: config.families[family].isMono || false,
			type: config.families[family].isType || false,
			pwid: config.families[family].isPWID || false,
			term: config.families[family].isTerm || false
		});
		await run("otfccbuild", tmpOTD, "-o", full, "-q");
		await rm(tmpOTD);
	}
);

const AS0 = files(
	`build/as0/*-*-*.ttf`,
	async (t, { full, dir, name, $: [family, region, style] }) => {
		const [config] = await t.need(Config, Scripts);
		const [, $1] = await t.need(de(dir), ShsOtd`build/shs/${region}-${style}.otd`);
		const tmpOTD = `${dir}/${name}.otd`;
		await runBuildTask("make/punct/as.js", {
			main: $1.full,
			o: tmpOTD,
			mono: config.families[family].isMono || false,
			type: config.families[family].isType || false,
			pwid: config.families[family].isPWID || false,
			term: config.families[family].isTerm || false
		});
		await run("otfccbuild", tmpOTD, "-o", full, "-q");
		await rm(tmpOTD);
	}
);

const Pass1 = files(
	`build/pass1/*-*-*.ttf`,
	async (t, { full, dir, name, $: [family, region, style] }) => {
		const [config] = await t.need(Config, Scripts);
		const latinFamily = config.families[family].latinGroup;
		const [, $1, $2, $3] = await t.need(
			de(dir),
			fu`sources/${latinFamily}/${latinFamily}-${style}.ttf`,
			AS0`build/as0/${family}-${region}-${deItalizedNameOf(config, style)}.ttf`,
			WS0`build/ws0/${family}-${region}-${deItalizedNameOf(config, style)}.ttf`
		);
		await runBuildTask("make/pass1/build.js", {
			main: $1.full,
			asian: $2.full,
			ws: $3.full,
			o: full + ".tmp.ttf",

			family: family,
			subfamily: config.subfamilies[region].name,
			style: style,
			italize: deItalizedNameOf(config, name) === name ? false : true
		});
		await sanitize(full, full + ".tmp.ttf");
	}
);

const Kanji0 = files(`build/kanji0/*.ttf`, async (t, { full, dir, name }) => {
	await t.need(Config, Scripts);
	const [$1] = await t.need(ShsOtd`build/shs/${name}.otd`, de(dir));
	const tmpOTD = `${dir}/${name}.otd`;
	await runBuildTask("make/kanji/build.js", {
		main: $1.full,
		o: tmpOTD
	});
	await run("otfccbuild", tmpOTD, "-o", full, "-q");
	await rm(tmpOTD);
});

const Prod = files(
	`out/ttf/${PREFIX}-*-*-*.ttf`,
	async (t, { full, dir, name, $: [family, region, style] }) => {
		const [config] = await t.need(Config, Scripts, Version, HintingConfig);
		const [, $1, $2] = await t.need(
			de(dir),
			Pass1`build/pass1/${family}-${region}-${style}.ttf`,
			HintedTTF`build/kanji1/${region}-${deItalizedNameOf(config, style)}.ttf`
		);
		const tmpOTD = `${dir}/${name}.otd`;
		await runBuildTask("make/pass2/build.js", {
			main: $1.full,
			kanji: $2.full,
			o: tmpOTD,

			italize: deItalizedNameOf(config, style) === style ? false : true
		});
		await run("otfccbuild", tmpOTD, "-o", full, "--keep-average-char-width", "-O3");
		await rm(tmpOTD);
	}
);

// Hinting
const HintingConfig = oracle("hinting-config", async () => {
	return await fs.readJSON(__dirname + "/hinting-config.json");
});
const HintingSettings = computed("hinting-settings", async t => {
	const [config] = await t.need(HintingConfig);
	return config.settings;
});
const HintingGroups = computed("hinting-groups", async t => {
	const [config] = await t.need(HintingConfig);
	let s = new Set();
	for (const g of config.fonts) {
		s.add(g.param);
	}
	return [...s];
});

phony("print-hint-config", async t => {
	const [settings, groups] = await t.need(HintingSettings, HintingGroups);
	console.log(settings, groups);
});

// IDH commands
const IDEOHINT = path.resolve(
	__dirname,
	"./node_modules/.bin/ideohint" + (os.platform() === "win32" ? ".cmd" : "")
);
const OTD2HGL = [IDEOHINT, "otd2hgl"];
const MERGE = [IDEOHINT, "merge"];
const APPLYHGI = [IDEOHINT, "apply"];
const HINTHGL = [IDEOHINT, "hint"];
const CACHE = [IDEOHINT, "cache"];

const JHint = oracle("hinting-jobs", async () => {
	return os.cpus().length * 2;
});

const KanjiInOTD = files(`build/hf-*/*.otd`, async (t, { dir, name }) => {
	const [k0ttf] = await t.need(Kanji0`build/kanji0/${name}.ttf`, de(dir));
	await run(`otfccdump`, k0ttf.full, "-o", `${dir}/${name}.otd`);
});
const KanjiInHGL = files(`build/hf-*/*.hgl`, async (t, { full, dir, name }) => {
	const [k0otd] = await t.need(KanjiInOTD`${dir}/${name}.otd`, de(dir));
	await run(...OTD2HGL, k0otd.full, "-o", full, "--all");
});
const KanjiGroupHGL = files(`build/hg-*/group.hgl`, async (t, { full, dir, $: [gid] }) => {
	const [config] = await t.need(HintingConfig, de(dir));
	const dependents = [];
	for (const g of config.fonts) {
		if (g.param === gid) {
			dependents.push(KanjiInHGL`build/hf-${gid}/${g.input}.hgl`);
		}
	}
	const deps = await t.need(...dependents);
	await run(...MERGE, "-o", full, ...deps.map(f => f.full));
});
const ThreadHGIs = files(`build/hg-*/j-*.hgi`, async (t, { full, dir, $: [gid, index] }) => {
	const [jHint] = await t.need(JHint);
	const [hgl, param] = await t.need(
		KanjiGroupHGL`build/hg-${gid}/group.hgl`,
		fu`hinting-params/${gid}.toml`,
		de(dir)
	);

	await run(
		...HINTHGL,
		hgl.full,
		...["-o", full],
		...["--parameters", param.full],
		...["--cache", `build/${gid}.hgc`],
		...["-d", jHint],
		...["-m", index]
	);
});

// Note: this is NOT a file task
const HGCache = tasks(`cache-hint-*`, async (t, gid) => {
	const [jHint] = await t.need(JHint);
	let threadHGIs = [];
	for (let j = 0; j < jHint; j++) threadHGIs.push(ThreadHGIs`build/hg-${gid}/j-${j}.hgi`);
	await t.need(de("build"));
	const $$ = await t.need(...threadHGIs);
	await run(...CACHE, "-o", `build/${gid}.hgc`, `build/${gid}.hgc`, ...$$.map(t => t.full));
});

const HintedTTF = files(`build/kanji1/*.ttf`, async (t, { full, dir, name }) => {
	let gid = null;
	const [config] = await t.need(HintingConfig);
	for (let g of config.fonts) {
		if (g.input === name) gid = g.param;
	}
	const [inOtd, param] = await t.need(
		KanjiInOTD`build/hf-${gid}/${name}.otd`,
		fu`hinting-params/${gid}.toml`,
		HGCache`cache-hint-${gid}`,
		de(dir)
	);

	const otd = `${dir}/${name}.otd`;

	await run(
		...APPLYHGI,
		`build/${gid}.hgc`,
		inOtd.full,
		...["-o", otd],
		...["--parameters", param.full],
		...(config.settings.cvt_padding ? ["--CVT_PADDING", config.settings.cvt_padding] : []),
		...(config.settings.fpgm_padding ? ["--FPGM_PADDING", config.settings.fpgm_padding] : []),
		...(config.settings.use_VTTShell ? ["--padvtt"] : [])
	);

	await run(`otfccbuild`, otd, `-o`, full, `--keep-average-char-width`);
	await rm(otd);
});

// TTC building
const TTCParts = tasks(`out/ttc/${PREFIX}-*-parts`, async (t, style) => {
	let reqs = [];
	const [config] = await t.need(Config, de`out/ttc`);

	for (let f of config.familyOrder)
		for (let sf of config.subfamilyOrder) {
			reqs.push(Prod`out/ttf/${PREFIX}-${f}-${sf}-${style}.ttf`);
		}
	const [$$] = await t.need(reqs);
	const ttcize = "node_modules/.bin/otfcc-ttcize" + (os.platform() === "win32" ? ".cmd" : "");
	await run(ttcize, ...["--prefix", `out/ttc/${PREFIX}-${style}-parts`], ...$$.map(t => t.full), [
		"-k",
		"-h"
	]);
});
const TTCPartOTD = files(`out/ttc/${PREFIX}-*-parts.*.otd`, async (t, { $: [style] }) => {
	await t.need(TTCParts`out/ttc/${PREFIX}-${style}-parts`);
});
const TTCPartTTF = files(`out/ttc/${PREFIX}-*-parts.*.ttf`, async (t, { full, dir, name }) => {
	const [otd] = await t.need(TTCPartOTD`${dir}/${name}.otd`);
	await run(
		"otfccbuild",
		otd.full,
		["-o", full],
		["-k", "--subroutinize", "--keep-average-char-width"]
	);
});
const TTCFile = files(`out/ttc/${PREFIX}-*.ttc`, async (t, { full, dir, $: [style] }) => {
	const [config] = await t.need(Config, de`out/ttc`);
	{
		let reqs = [],
			n = 0;
		// eslint-disable-next-line no-unused-vars
		for (let _family of config.familyOrder) {
			// eslint-disable-next-line no-unused-vars
			for (let _subfamily of config.subfamilyOrder) {
				reqs.push(TTCPartTTF`out/ttc/${PREFIX}-${style}-parts.${n}.ttf`);
				n += 1;
			}
		}
		const [, $$] = await t.need(de(dir), reqs);
		await run(`otf2otc`, ["-o", full], $$.map(t => t.full));
		for (let r of $$) {
			await rm(r, `${r.dir}/${r.name}.otd`);
		}
	}
});

const TTC = task("ttc", async t => {
	const [config] = await t.need(Config, de`out/ttc`);

	await t.need(config.styleOrder.map(st => TTCFile`out/ttc/${PREFIX}-${st}.ttc`));
});

const TTF = task("ttf", async t => {
	const [config] = await t.need(Config, de`out/ttf`);
	let reqs = [];
	for (let f of config.familyOrder)
		for (let sf of config.subfamilyOrder)
			for (let st of config.styleOrder) {
				reqs.push(Prod`out/ttf/${PREFIX}-${f}-${sf}-${st}.ttf`);
			}
	await t.need(...reqs);
});

// Archives
const Version = oracle("version", async () => {
	return (await fs.readJson(path.resolve(__dirname, "package.json"))).version;
});

const TTCArchive = files(`out/sarasa-gothic-ttc-*.7z`, async (t, target) => {
	await t.need(TTC);
	await cd(`out/ttc`).run(
		`7z`,
		`a`,
		`-t7z`,
		`-mmt=on`,
		`-m0=LZMA:a=0:d=1536m:fb=256`,
		`../${target.name}.7z`,
		`*.ttc`
	);
});
const TTFArchive = files(`out/sarasa-gothic-ttf-*.7z`, async (t, target) => {
	const [config] = await t.need(Config, de`out/ttf`);
	await t.need(TTF);
	await rm(target.full);

	// StyleOrder is interlaced with "upright" and "italic"
	// Compressing in this order reduces archive size
	for (let j = 0; j < config.styleOrder.length; j += 2) {
		const styleUpright = config.styleOrder[j];
		const styleItalic = config.styleOrder[j + 1];
		await cd(`out/ttf`).run(
			`7z`,
			`a`,
			`-t7z`,
			`-mmt=on`,
			`-m0=LZMA:a=0:d=1536m:fb=256`,
			`../${target.name}.7z`,
			styleUpright ? `*-${styleUpright}.ttf` : null,
			styleItalic ? `*-${styleItalic}.ttf` : null
		);
	}
});

phony("start", async t => {
	const version = await t.need(Version);
	await t.need(
		TTCArchive`out/sarasa-gothic-ttc-${version}.7z`,
		TTFArchive`out/sarasa-gothic-ttf-${version}.7z`
	);
});

const ScriptsStructure = oracle("scripts-dir-structure", target =>
	FileList({ under: `make`, pattern: `**/*.js` })(target)
);
const Scripts = task("scripts", async t => {
	const [scriptList] = await t.need(ScriptsStructure);
	await t.need(scriptList.map(fu));
});
