const fs = require("fs");
const path = require("path");
const stream = require("stream");
const argv = require("yargs").argv;
const sg = require("./stylegroups");

function pathjoin() {
	return path.join.apply(path, arguments).replace(/\\/g, "/");
}

let jHint = Math.max(1, argv.jh - 0 || 1);

const config = JSON.parse(fs.readFileSync(argv.config, "utf-8"));
if (!config || !config.settings || !config.fonts) {
	console.log("Bad config.fonts.");
	process.exit(1);
}

let stylegroups = sg.stylegroupsOf(config);
sg.initParamfiles(stylegroups, config);

const tempdir = argv.tempdir || "build";
const outdir = argv.outdir || "out";

function unifiedHGFFileOf(style) {
	return pathjoin(tempdir, style + ".hgf");
}
function unifiedHGIFileOf(style) {
	return pathjoin(tempdir, style + ".hgi");
}

function capitalize(str) {
	return str.replace(/\w\S*/g, function(txt) {
		return txt.charAt(0).toUpperCase() + txt.slice(1);
	});
}

let intermediates = [];
let phonies = [];
let hgls = [];
let hgis = [];
let targets = [];

function groupIDof(groupid, k, group) {
	return group.gid;
}
function styleNameOf(groupid, k, group) {
	return group.gid;
}

let mk = Object.keys(stylegroups).map(function(groupid, k) {
	let buf = "";
	const group = stylegroups[groupid];
	const groupNameBase = groupIDof(groupid, k, group);
	const hgifile = pathjoin(tempdir, groupNameBase + ".g.hgi");

	const paramFile = group.param;
	const PARAM = "--parameters " + paramFile + " $(PARAM_CVT)";

	for (let style of group.fonts) {
		const fileNameBase = path.parse(style.input).name;
		const inotd = pathjoin(tempdir, fileNameBase + ".in.otd");
		const outotd = pathjoin(tempdir, fileNameBase + ".out.otd");
		const target = pathjoin(outdir, fileNameBase + ".ttf");

		buf += `${outotd} : ${hgifile} ${inotd} ${paramFile} $(CVTFILE) __hgis
	$(APPLYHGI) ${hgifile} ${inotd} -o $@ ${PARAM} ${argv.usevttshell ? " --padvtt" : ""}
`;

		if (argv.usevttshell) {
			const tmpttf = pathjoin(tempdir, fileNameBase + ".tmp.ttf");
			buf += tmpttf + " : " + outotd + "\n" + "\t$(OTFCCBUILD) $^ -o $@\n";
			buf += `${target} : ${tmpttf}\n` + `\t$(VTTSHELL) -q -a $< $@\n`;
			targets.push(target);
		} else {
			buf += target + " : " + outotd + "\n" + "\t$(OTFCCBUILD) $^ -o $@\n";
			targets.push(target);
		}
		intermediates.push(outotd);
	}

	return buf;
});

mk = mk.concat(
	Object.keys(stylegroups).map(function(groupid, k) {
		let buf = "";
		let group = stylegroups[groupid];
		let groupNameBase = groupIDof(groupid, k, group);

		let hglparts = [];
		let hgl = pathjoin(tempdir, groupNameBase + ".g.hgl");
		let target = pathjoin(tempdir, groupNameBase + ".g.hgi");

		let paramFile = group.param;
		let PARAM = "--parameters " + paramFile + " $(PARAM_CVT)";

		for (let style of group.fonts) {
			let { name: fileNameBase, ext: fileNameExt } = path.parse(style.input);
			let source = pathjoin(style.input);
			let inotd = pathjoin(tempdir, fileNameBase + ".in.otd");
			let inhgl = pathjoin(tempdir, fileNameBase + ".in.hgl");

			buf += inotd + " : " + source + "\n" + "\t$(OTFCCDUMP) $< -o $@\n";

			buf +=
				inhgl +
				" : " +
				inotd +
				"\n" +
				`\t$(OTD2HGL) $< -o $@ ${style.allchar ? "--all" : "--ideo-only"}\n`;
			hglparts.push(inhgl);
		}

		buf += hgl + " : " + hglparts.join(" ") + "\n" + "\t$(MERGE) -o $@ $^\n";
		hgls.push(hgl);

		let hgiParts = [];

		for (let j = 0; j < jHint; j++) {
			let hgipart = pathjoin(tempdir, groupNameBase + "-" + j + ".hgi");

			buf += `${hgipart} : ${hgl} ${paramFile}
	$(HINTHGL) $< -o $@ ${PARAM} -d ${jHint} -m ${j}
`;
			hgiParts.push(hgipart);
		}

		buf += target + " : " + hgiParts.join(" ") + "\n" + "\t$(MERGE) $^ -o $@\n";
		hgis.push(target);
		buf +=
			"visual-" +
			styleNameOf(groupid, k, group) +
			" : " +
			hgl +
			"\n" +
			"\t$(PARAMADJ) $< " +
			PARAM +
			" -w $(TESTWORD)\n";

		return buf;
	})
);

mk = mk.concat([
	"__measure-cvt : " +
		config.fonts
			.map(function(style, k) {
				let fileNameBase = path.parse(style.input).name;
				return pathjoin(tempdir, fileNameBase + ".in.otd");
			})
			.join(" ") +
		"\n\t$(NODE) support/measure-cvt $^"
]);

mk = mk.concat([
	"__measure-cvt-save : " +
		config.fonts
			.map(function(style, k) {
				let fileNameBase = path.parse(style.input).name;
				return pathjoin(tempdir, fileNameBase + ".in.otd");
			})
			.join(" ") +
		"\n\t$(NODE) support/measure-cvt $^ -o $(CVTFILE)"
]);

mk = mk.concat(["__build-all : " + targets.join(" ")]);

mk = mk.concat(["__hgls : " + hgls.join(" ")]);

mk = mk.concat(["__hgis : " + hgis.join(" ")]);

fs.writeFileSync(argv.o, mk.join("\n\n"));
