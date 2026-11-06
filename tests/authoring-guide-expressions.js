// The light bench showed agents learning the expression subset from refusals: parseInt, Number.isInteger, Math.sqrt
// and a regular expression literal refused, the while block found only in a diagnostic. The authoring guide now opens
// with the expressions in short, aligned with the functions of the engine, and describes the while block and its
// iteration limit.
var root = String(arguments[0]), engineDir = String(arguments[1]);
var files = Packages.org.apache.commons.io.FileUtils, checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
var guide = String(files.readFileToString(new java.io.File(root, "_flow/resources/guide/authoring.md"), "UTF-8"));
var head = guide.substring(0, guide.indexOf("## A complete Flow"));
assert(head.indexOf("## Expressions in short") !== -1 && head.split("\n").length < 30, "the guide opens with a short reminder of the expressions");

// Every number function of the engine is named in the reminder (the Math.* ones as a family)
var utils = eval(String(files.readFileToString(new java.io.File(engineDir, "modules/expression-utils.js"), "UTF-8")));
Object.keys(utils.expressionFunctions({})).filter(function (name) {
	return /^(parseInt|parseFloat|isNaN|isFinite|Number\.is)/.test(name);
}).forEach(function (name) {
	assert(head.indexOf("`" + name) !== -1, "the reminder names " + name);
});
["`Math.*`", "`sqrt`", "`pow`", "`Infinity`", "`text.match(", "`crypto.random`", "`json.push`", "`while`", "`forEach`"].forEach(function (part) {
	assert(head.indexOf(part) !== -1, "the reminder names " + part);
});

// The regex blocks: a regular expression is a block, with regex: true on replace and split
["**Regex:**", "`text.match({ text, pattern:", "`text.replace({ ..., regex: true })`", "`text.split({ ..., regex: true })`"].forEach(function (part) {
	assert(head.indexOf(part) !== -1, "the reminder names the regex blocks: " + part);
});

// The while block, its default limit and how to raise it
["`while({ condition:", "maxIterations", "1000 when omitted", "WHILE_ITERATION_LIMIT", "timeoutMs", "FLOWSCRIPT_LOOP_UNSUPPORTED"].forEach(function (part) {
	assert(guide.indexOf(part) !== -1, "the guide describes the while block: " + part);
});
print("authoring-guide-expressions OK (" + checks + " checks)");
