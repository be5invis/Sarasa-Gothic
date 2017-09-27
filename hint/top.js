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

const topActions = {};
topActions.hint = async function() {
	await hr();
	let config = await loadConfig();
	console.log("Hint all fonts.");
	await cp.spawn("node", ["build", "start"], { stdio: "inherit" });
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
	await cp.spawn("node", ["build", "visual-" + which.group], { stdio: "inherit" });
	await hr();
	return false;
};
topActions.addFont = async function() {
	const basePath = "source";
	let ttf = await inquirer.prompt({
		type: "file",
		name: "ttf",
		message: "The path of your font.",
		basePath: basePath
	});
	let have = await inquirer.prompt({
		type: "list",
		message: "Do you have a parameter file?",
		name: "have",
		choices: [{ name: "Yes.", value: true }, { name: "No, create one for me.", value: false }]
	});
	let entry = null;
	if (have.have) {
		let par = await inquirer.prompt({
			type: "file",
			name: "par",
			message: "The path of your parameter file.",
			basePath: basePath
		});
		entry = {
			input: fixpath(path.resolve(basePath, ttf.ttf)),
			param: fixpath(path.resolve(basePath, par.par))
		};
	} else {
		let par = await inquirer.prompt({
			name: "par",
			message: "Save to...",
			default: path.join(basePath, "parameters", path.parse(ttf.ttf).name + ".toml")
		});
		let a_upm = await inquirer.prompt({
			name: "upm",
			message: "Your font's UPM = ?",
			default: 1000
		});
		let upm = a_upm.upm;
		fs.writeFile(
			par.par,
			`
[hinting]
UPM = ${upm}
BLUEZONE_TOP_CENTER = ${0.83 * upm}
BLUEZONE_TOP_LIMIT = ${0.813 * upm}
BLUEZONE_BOTTOM_CENTER = ${-0.07 * upm}
BLUEZONE_BOTTOM_LIMIT = ${-0.045 * upm}
`
		);
		entry = {
			input: fixpath(path.resolve(basePath, ttf.ttf)),
			param: fixpath(par.par)
		};
	}
	let config = await loadConfig();
	config.fonts.push(entry);
	await saveConfig(config);
	console.log(
		`Hinting task for ${entry.input.cyan} successfully registered. Parameter file is ${entry
			.param.cyan}.`
	);
	return false;
};
topActions.deleteFont = async function() {
	let config = await loadConfig();
	let w = await inquirer.prompt({
		type: "list",
		name: "which",
		message: "Delete which one?",
		choices: config.fonts.map((font, j) => ({ value: j, name: font.input }))
	});
	const deleted = config.fonts.splice(w.which, 1);
	await saveConfig(config);
	console.log(`Hinting task for ${deleted[0].input.cyan} successfully deleted.`);
	return false;
};
topActions.toggleTTFA = async function() {
	let config = await loadConfig();
	config.settings.do_ttfautohint = !config.settings.do_ttfautohint;
	await saveConfig(config);
};
topActions.toggleIDH = async function() {
	let config = await loadConfig();
	config.settings.use_externalIDH = !config.settings.use_externalIDH;
	await saveConfig(config);
};
topActions.toggleVTTShell = async function() {
	let config = await loadConfig();
	config.settings.use_VTTShell = !config.settings.use_VTTShell;
	await saveConfig(config);
};
topActions.toggleBuildTTC = async function() {
	let config = await loadConfig();
	config.settings.build_ttc = !config.settings.build_ttc;
	await saveConfig(config);
};
topActions.measureCVT = async function() {
	await hr();
	await cp.spawn("node", ["build", "measure-cvt"], { stdio: "inherit" });
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
topActions.exit = async function() {
	return true;
};

async function startRepl() {
	let over = false;
	while (!over) {
		clear();
		console.log(`
Current hinting tasks
---------------------`);
		let config = await loadConfig();
		for (let font of config.fonts) {
			console.log(`  - ${font.input.cyan}, using parameter ${font.param.cyan}`);
		}
		console.log(
			`\nRun TTFAutohint for non-ideographs: ${("" + config.settings.do_ttfautohint).cyan}`
		);
		if (config.settings.cvt_padding) {
			console.log(`CVT Padding: Fixed, ${("" + config.settings.cvt_padding).cyan}`);
		} else {
			console.log(`CVT Padding: ${"Measured before hinting".cyan}`);
		}
		if (config.settings.use_externalIDH) {
			console.log(`IDEOHINT Instance: ${"External".cyan}`);
		} else {
			console.log(`IDEOHINT Instance: ${"Internal".cyan}`);
		}
		if (config.settings.fpgm_padding) {
			console.log(`FPGM Padding: Active, ${("" + config.settings.fpgm_padding).cyan}`);
		} else {
			console.log(`FPGM Inactive`);
		}
		console.log(`Use VTTShell: ${("" + !!config.settings.use_VTTShell).cyan}`);
		// console.log(`Build TTC: ${("" + !!config.settings.build_ttc).cyan}`);
		console.log("");
		let choice = await inquirer.prompt({
			type: "list",
			message: "What would you do?",
			name: "task",
			pageSize: process.stdout.rows / 2,
			choices: [
				{ name: "Hint all fonts.", value: "hint" },
				{ name: "Adjust parameters.", value: "visual" },
				{ name: "Suggest CVT Padding.", value: "measureCVT" },
				{ name: "Set CVT Padding.", value: "setCVTPadding" },
				{ name: "Set FPGM Padding.", value: "setFPGMPadding" },
				{ name: "Add new hinting task.", value: "addFont" },
				{ name: "Delete hinting task.", value: "deleteFont" },
				{ name: "Toggle TTFAutohint for non-ideographs.", value: "toggleTTFA" },
				{ name: "Toggle use external Ideohint instance.", value: "toggleIDH" },
				{ name: "Toggle VTTShell usage.", value: "toggleVTTShell" },
				//{ name: "Toggle Build TTC.", value: "toggleBuildTTC" },
				{ name: "Cleanup intermediate files.", value: "cleanup" },
				{ name: "Exit.", value: "exit" }
			]
		});
		over = await topActions[choice.task]();
	}
}

async function directTask(command) {
	if (!topActions[command]) {
		throw new Error("Command " + command + " not found.");
	} else {
		await topActions[command]();
	}
}

(async function() {
	if (argv._[0]) {
		await directTask(argv._[0]);
	} else {
		await startRepl();
	}
})().catch(e => console.error(e));
