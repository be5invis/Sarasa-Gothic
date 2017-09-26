const fs = require("fs-extra");
const path = require("path");
const os = require("os");
const cp = require("child-process-promise");
const argv = require("yargs").argv;
const sg = require("./support/stylegroups");
const colors = require("colors");
const clear = require("clear");

const inquirer = require("inquirer");
inquirer.prompt.registerPrompt("file", require("inquirer-file-path"));

const cores = os.cpus().length;
const entryDir = argv.entry || __dirname;
const configPath = argv.config || path.join(entryDir, "source", "fonts.json");
function fixpath(p) {
	return path
		.relative(entryDir, path.resolve(p))
		.split(path.sep)
		.join("/");
}

async function hr() {
	process.stdout.write("-".repeat(process.stdout.columns) + "\n");
}

async function loadConfig() {
	const txt = await fs.readFile(configPath, "utf-8");
	const config = JSON.parse(txt);
	if (!config || !config.settings || !config.fonts) {
		throw "Bad config!";
	}
	return config;
}

async function saveConfig(config) {
	await fs.writeFile(configPath, JSON.stringify(config, null, 2));
}

async function beforeMake() {
	await fs.ensureDir("build");
	await fs.ensureDir("out");
	const cvtmkPath = path.resolve(entryDir, "build", "_CVT.mk");
	if (!fs.existsSync(cvtmkPath)) {
		await fs.writeFile(cvtmkPath, "CVT_PADDING = 0");
	}
	let config = await loadConfig();
	if (config.settings.cvt_padding) {
		await fs.writeFile(cvtmkPath, "CVT_PADDING = " + config.settings.cvt_padding);
	}
	const fpgmmkPath = path.resolve(entryDir, "build", "_FPGM.mk");
	await fs.writeFile(fpgmmkPath, "FPGM_PADDING = " + (config.settings.fpgm_padding - 0 || 0));
}

function idhParam(config) {
	const a = [];
	if (config.settings.use_externalIDH) {
		a.push(`XX_IDH_INSTANCE=ideohint`);
	} else {
		if (os.platform() === "win32") {
			a.push(`XX_IDH_INSTANCE=${path.join(entryDir, "../node_modules/.bin/ideohint.cmd")}`);
		} else {
			a.push(`XX_IDH_INSTANCE=${path.join(entryDir, "../node_modules/.bin/ideohint")}`);
		}
	}
	/*
	if (config.settings.build_ttc) {
		a.push(`XX_BUILD_TTC=--buildttc`);
	}
	*/
	if (config.settings.use_VTTShell) {
		a.push(`XX_USE_VTTSHELL=--usevttshell`);
	}

	if (os.platform() === "win32") {
		a.push(
			`XX_TTCIZE_INSTANCE=${path.join(entryDir, "../node_modules/.bin/otfcc-ttcize.cmd")}`
		);
	} else {
		a.push(`XX_TTCIZE_INSTANCE=${path.join(entryDir, "../node_modules/.bin/otfcc-ttcize")}`);
	}
	return a;
}

const topActions = {};
topActions.hint = async function() {
	await hr();
	let config = await loadConfig();
	console.log("Hint all fonts.");
	await beforeMake();
	if (!config.settings.cvt_padding) {
		await cp.spawn(
			"make",
			["-f", "support/makefile", "-j", cores, ...idhParam(config), "__measure-cvt-save"],
			{ stdio: "inherit" }
		);
	}
	await cp.spawn("make", ["-f", "support/makefile", "-j", cores, ...idhParam(config), `all`], {
		stdio: "inherit"
	});
	console.log("Done.");
	await hr();
	return false;
};
topActions.visual = async function() {
	const config = await loadConfig();
	let stylegroups = sg.stylegroupsOf(config);

	let which = await inquirer.prompt({
		type: "list",
		message: "Which font (group)?",
		name: "group",
		choices: sg.printStylegroups(stylegroups).concat({ value: null, name: "Cancel" })
	});
	if (!which.group) return false;
	console.log("Started UI for adjusting parameters.".green);
	console.log(
		"Press Control-C in the terminal/command prompt to go back to the main menu.".green
	);
	await hr();
	await beforeMake();
	await cp.spawn(
		"make",
		["-f", "support/makefile", "-j", cores, ...idhParam(config), "visual-" + which.group],
		{ stdio: "inherit" }
	);
	await hr();
	return false;
};
topActions.measureCVT = async function() {
	await hr();
	await beforeMake();
	await cp.spawn(
		"make",
		["-f", "support/makefile", "-j", cores, ...idhParam(config), "measure-cvt"],
		{ stdio: "inherit" }
	);
	await beforeMake();
	await hr();
	return false;
};
topActions.setCVTPadding = async function() {
	let v = await inquirer.prompt({
		name: "value",
		message: "Type CVT padding value. Leave 0 for automatic."
	});
	let config = await loadConfig();
	config.settings.cvt_padding = v.value - 0;
	await saveConfig(config);
};
topActions.setFPGMPadding = async function() {
	let v = await inquirer.prompt({
		name: "value",
		message: "Type FPGM padding value. Leave 0 for automatic."
	});
	let config = await loadConfig();
	config.settings.fpgm_padding = v.value - 0;
	await saveConfig(config);
};
topActions.cleanup = async function() {
	await fs.remove("build");
	console.log("Complete.");
};

async function directTask(command) {
	await topActions[command]();
}

(async function() {
	if (argv._[0]) {
		await directTask(argv._[0]);
	}
})();
