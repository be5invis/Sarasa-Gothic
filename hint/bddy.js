"use strict";

const fs = require("fs");
const path = require("path");
const sg = require("./support/stylegroups");

const OTFCCDUMP = "otfccdump";
const OTFCCBUILD = "otfccbuild";
const VTTSHELL = "vttshell";

const CONFIG_PATH = __dirname + "/source/fonts.json";

const os = require("os");
const jHint = os.cpus().length * 2;

module.exports = function(ctx, forany, argv, bddy) {
	const config = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
	const stylegroups = sg.stylegroupsOf(config);
	sg.initParamfiles(stylegroups, config);

	const tempdir = argv.tempdir || "build";
	const outdir = argv.outdir || "out";

	function unifiedHGFFileOf(style) {
		return pathjoin(tempdir, style + ".hgf");
	}
	function unifiedHGIFileOf(style) {
		return pathjoin(tempdir, style + ".hgi");
	}
	function groupIDof(groupid, k, group) {
		return group.gid;
	}
	function styleNameOf(groupid, k, group) {
		return group.gid;
	}

	const IDEOHINT = path.resolve(
		__dirname,
		"../node_modules/.bin/ideohint" + (os.platform() === "win32" ? ".cmd" : "")
	);

	const OTD2HGL = [IDEOHINT, "otd2hgl"];
	const MERGE = [IDEOHINT, "merge"];
	const APPLYHGI = [IDEOHINT, "apply"];
	const HINTHGL = [IDEOHINT, "hint"];
	const VISUAL = [IDEOHINT, "visual"];
	const CACHE = [IDEOHINT, "cache"];
	const NODE = ["node"];

	const inOTDs = [];
	const outputs = [];
	// CVT measurement
	forany.virt("start").def(async function(target) {
		await this.need(outputs);
	});
	forany.file(`${tempdir}/cvt.json`).def(async function(target) {
		await this.need(target.dir, ...inOTDs);
		await this.run(...NODE, "support/measure-cvt", ...inOTDs, "-o", target, "--json");
	});
	forany.virt(`measure-cvt`).def(async function(target) {
		await this.need(target.dir, ...inOTDs);
		await this.run(...NODE, "support/measure-cvt", ...inOTDs);
	});

	for (let groupid in stylegroups) {
		const group = stylegroups[groupid];
		const groupbase = groupIDof(groupid, 0, group);

		const ghint = `${tempdir}/hint-${groupbase}`;
		const gfont = `${tempdir}/font-${groupbase}`;
		const hgl = `${ghint}/group.hgl`;
		const hgc = `${ghint}.hgc`;

		const paramfile = group.param;
		const groupHGLs = [];

		for (let font of group.fonts) {
			let { name: fileNameBase, ext: fileNameExt } = path.parse(font.input);
			const inotd = `${gfont}/${fileNameBase}.in.otd`;
			const inhgl = `${ghint}/${fileNameBase}.in.hgl`;
			const outotd = `${gfont}/${fileNameBase}.out.otd`;
			const outttf = `${outdir}/${fileNameBase}.ttf`;

			// input otd
			forany.file(inotd).def(async function(target) {
				let [_, $1] = await this.need(target.dir, font.input);
				if (fileNameExt !== ".ttf") {
					const in0otd = `${gfont}/${fileNameBase}.in0.otd`;
					const in1otd = `${gfont}/${fileNameBase}.in1.otd`;
					const in1ttf = `${gfont}/${fileNameBase}.in1.ttf`;
					await this.run(OTFCCDUMP, $1, "-o", in0otd);
					await this.run(
						...NODE,
						"support/megaminx-simple",
						...["--recipe", "support/megaminx-quadify-gc"],
						in0otd,
						...["-o", in1otd]
					);
					await this.run(OTFCCBUILD, in1otd, "-o", in1ttf);
					await this.run(OTFCCDUMP, in1ttf, "-o", target);
				} else if (config.settings.do_ttfautohint) {
					const temp = `${gfont}/${fileNameBase}.tah.ttf`;
					await this.run(TTFAUTOHINT, $1, "-o", temp);
					await this.run(OTFCCDUMP, temp, "-o", target);
				} else {
					await this.run(OTFCCDUMP, $1, "-o", target);
				}
			});
			inOTDs.push(inotd);

			forany.file(inhgl).def(async function(target) {
				const [_, $1] = await this.need(target.dir, inotd);
				await this.run(
					...OTD2HGL,
					$1,
					"-o",
					target,
					font.allchar ? "--all" : "--ideo-only"
				);
			});
			groupHGLs.push(inhgl);

			// output
			forany.file(outotd).def(async function(target) {
				const [_, $hgc, $inotd, $param, _config, $cvt] = await this.need(
					target.dir,
					hgc,
					inotd,
					paramfile,
					CONFIG_PATH,
					config.settings.cvt_padding ? null : `${tempdir}/cvt.json`,
					hgc
				);
				await this.run(
					...APPLYHGI,
					$hgc,
					$inotd,
					...["-o", target],
					...["--parameters", $param],
					...(config.settings.cvt_padding
						? ["--CVT_PADDING", config.settings.cvt_padding]
						: ["--CVT_PADDING", JSON.parse(fs.readFileSync("" + $cvt)).cvt]),
					...(config.settings.fpgm_padding
						? ["--FPGM_PADDING", config.settings.fpgm_padding]
						: []),
					...(config.settings.use_VTTShell ? ["--padvtt"] : [])
				);
			});

			// ttf
			forany.file(outttf).def(async function(target) {
				const [_, $1] = await this.need(target.dir, outotd);
				if (fileNameExt === ".ttf" && config.settings.use_VTTShell) {
					const temp = `${gfont}/${fileNameBase}.out.ttf`;
					await this.run(OTFCCBUILD, "--keep-average-char-width", $1, "-o", temp);
					await this.run(VTTSHELL, "-q", "-a", temp, target);
				} else {
					await this.run(OTFCCBUILD, "--keep-average-char-width", $1, "-o", target);
				}
			});
			outputs.push(outttf);
		}

		// hgl and hgi
		forany.file(hgl).def(async function(target) {
			const [_, $$] = await this.need(target.dir, groupHGLs);
			await this.run(...MERGE, "-o", target, ...$$);
		});
		const groupHGIs = [];
		for (let j = 0; j < jHint; j++) {
			forany.file(`${ghint}/${j}.hgi`).def(async function(target) {
				const [_, $1, $2] = await this.need(target.dir, hgl, paramfile);
				await this.run(
					...HINTHGL,
					$1,
					...["-o", target],
					...["--parameters", $2],
					...["--cache", hgc],
					...["-d", jHint],
					...["-m", j]
				);
			});
			groupHGIs.push(`${ghint}/${j}.hgi`);
		}
		forany.file(hgc).def(async function(target) {
			const [_, $$] = await this.need(target.dir, groupHGIs);
			await this.run(...CACHE, "-o", target, target, ...$$);
		});

		// visual
		forany.virt("visual-" + groupbase).def(async function() {
			const [$1, $2] = await this.need(hgl, paramfile);
			await this.runInteractive(...VISUAL, $1, ...["--parameters", $2]);
		});
	}
};
