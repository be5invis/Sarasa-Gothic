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

	o += `## Coarse-grained download links (contains all languages)\n\n`;

	o += ` * [SuperTTC](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-SuperTTC-${version}.7z) ([Unhinted](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-SuperTTC-Unhinted-${version}.7z))\n`;
	o += ` * [TTC](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-TTC-${version}.7z) ([Unhinted](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-TTC-Unhinted-${version}.7z))\n`;
	o += ` * [TTF](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-TTF-${version}.7z) ([Unhinted](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa-TTF-Unhinted-${version}.7z))\n`;

	o += `## Fine-grained download links\n\n`;
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
		o += `[TTF](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa${family}${subfamily}-TTF-${version}.7z) `;
		o += `([Unhinted](https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/Sarasa${family}${subfamily}-TTF-Unhinted-${version}.7z)) `;
	}
	o += "|\n";
	return o;
}
