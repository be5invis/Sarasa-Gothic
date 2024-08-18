import fs from "fs";

const version = process.argv[2];
const outputPath = process.argv[3];

main().catch(e => {
	console.error(e);
	process.exit(1);
});

async function main() {
	const config = JSON.parse(await fs.promises.readFile("config.json", "utf-8"));

	const out = new Out(outputPath);

	out.writeP(`### Everything Package`)
		.write(`| Package | 7z | zip |`)
		.write(`|---------|----|-----|`)
		.write(
			`| SuperTTC |`,
			downloadItem(DOWNLOAD, "", "SuperTTC", version, "7z"),
			` | `,
			downloadItem(DOWNLOAD, "", "SuperTTC", version, "zip"),
			`|`
		)
		.write(
			`| TTC |`,
			downloadItem(DOWNLOAD, "", "TTC", version, "7z"),
			`|`,
			downloadItem(DOWNLOAD, "", "TTC", version, "zip"),
			`|`
		)
		.write(
			`| TTF |`,
			downloadItem(DOWNLOAD, "", "TTF", version, "7z"),
			`| (File too large for GitHub release artifact) |`
		);

	out.writeP(`### Single Family TTF Package`)
		.write(`| Package | 7z | zip |`)
		.write(`|---------|----|-----|`);

	for (const f of config.familyOrder) {
		out.write(
			`| ${f} |`,
			downloadItem(DOWNLOAD, f, "TTF", version, "7z"),
			`|`,
			downloadItem(DOWNLOAD, f, "TTF", version, "zip"),
			`|`
		);
	}
	out.write("");

	out.writeP(`### Single Family & Language TTF Package`);
	out.writeP(`<details>`);
	out.write(generateTableHeader(config));
	for (const subfamily of config.subfamilyOrder) {
		out.write(generateTableRow(config, subfamily, version));
	}
	out.writeP(`</details>`);

	out.writeP(`[SHA-256 hashes](${pkgLink(version, "SHA-256", "txt")})`);

	out.end();
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
	o += "|";
	return o;
}
function generateTableRow(config, sf, version) {
	let o = `| ${sf} `;
	for (const f of config.familyOrder) {
		o += `| ${downloadItem("7z", f + sf, "TTF", version, "7z")} `;
	}
	o += "|";
	return o;
}

class Out {
	constructor(filePath) {
		this.stream = fs.createWriteStream(filePath);
	}

	write(...s) {
		for (const item of s) this.stream.write(item);
		this.stream.write("\n");
		return this;
	}

	writeP(...s) {
		this.write(...s, "\n");
		return this;
	}

	end() {
		this.stream.end();
	}
}

const DOWNLOAD = `📦 Download`;
function downloadItem(label, prefix, format, version, zip) {
	const normalLink = pkgLink(version, `Sarasa${prefix}-${format}-${version}`, zip);
	const unhintedLink = pkgLink(version, `Sarasa${prefix}-${format}-Unhinted-${version}`, zip);
	return `[${label}](${normalLink}) ([Unhinted](${unhintedLink}))`;
}
function pkgLink(version, baseName, format) {
	return `https://github.com/be5invis/Sarasa-Gothic/releases/download/v${version}/${baseName}.${format}`;
}
