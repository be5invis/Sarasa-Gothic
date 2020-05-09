"use strict";

const path = require("path");

const { Workflow } = require("megaminx");

module.exports = async function (recipeArg, args) {
	const recipePath = path.resolve(recipeArg);
	const recipe = require(recipePath);
	const config = {};
	const flow = new Workflow(config);
	await flow.run(recipe, config, args);
};
