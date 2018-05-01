"use strict";

const argv = require("yargs").argv;
const path = require("path");

const { Workflow } = require("megaminx");

function toSet(a) {
	let o = {};
	for (let k of a) {
		o[k] = true;
	}
	return o;
}

const main = async function() {
	const recipePath = path.resolve(argv.recipe);
	const recipe = require(recipePath);
	const config = {};
	const flow = new Workflow(config);
	await flow.run(recipe, config, argv);
};

main().catch(function(e) {
	console.error(e);
	process.exit(1);
});
