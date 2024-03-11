import fs from "fs";

const version = process.argv[2];
const output = process.argv[3];

main().catch(e => {
	console.error(e);
	process.exit(1);
});

async function main() {
	const config = JSON.parse(await fs.promises.readFile("config.json", "utf-8"));

	let o = "";

	o += `## SuperTTC and TTC Archives (Contain all families and languages)\n\n`;

	o += ` * [SuperTTC](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-SuperTTC-${version}.zip) ([Unhinted](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-SuperTTC-Unhinted-${version}.zip))\n`;
	o += ` * [TTC](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-TTC-${version}.zip) ([Unhinted](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-TTC-Unhinted-${version}.zip))\n`;

	o += `## TTF Archives\n\n`;
	o += `### Single Family, Multiple Languages Package\n\n`;
	for (const family of config.familyOrder) {
		o += `* [${family}](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa${family}-TTF-${version}.zip) `;
		o += `([Unhinted](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa${family}-TTF-Unhinted-${version}.zip))\n`;
	}

	o += `### Single Family & Language\n\n`;
	o += generateTableHeader(config);
	for (const subfamily of config.subfamilyOrder) {
		o += generateTableRow(config, subfamily, process.argv[2]);
	}

	await fs.promises.writeFile(process.argv[3], o);
}

function generateTableHeader(config) {
	let o = `| Locale `;
	for (const family of config.familyOrder) {
		o += "| " + family + " ";
	}
	o += "|\n";
	o += `|---`;
	for (const family of config.familyOrder) {
		o += "|---";
	}
	o += "|\n";
	return o;
}

function generateTableRow(config, subfamily, version) {
	let o = `| ${subfamily} `;
	for (const family of config.familyOrder) {
		o += "| ";
		o += `[TTF](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa${family}${subfamily}-TTF-${version}.zip) `;
		o += `([Unhinted](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa${family}${subfamily}-TTF-Unhinted-${version}.zip)) `;
	}
	o += "|\n";
	return o;
}
