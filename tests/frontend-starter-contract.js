var projectDir = java.nio.file.Files.createTempDirectory("flow-svelte-contract-").toFile();
var sourceFile = new java.io.File(projectDir,
	"libs/flow/frontbuilder/svelte/model/Test/src/routes/+page.flow.svelte");
sourceFile.getParentFile().mkdirs();
var source = '<FlowComponent id="home" label="Home"><Structure /></FlowComponent>\n';
Packages.org.apache.commons.io.FileUtils.writeStringToFile(sourceFile, source, "UTF-8");

function assertTrue(condition, message) {
	if (!condition) throw new Error(message);
}

var blockFile = new java.io.File(arguments.length > 0 ? arguments[0] : ".",
	"libs/flow/blocks/frontend/svelte/source.block.js");
var blockSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(blockFile, "UTF-8"));
var block = eval(blockSource.substring(blockSource.indexOf("(function")));
var props = {
	operation: "get",
	projectDir: String(projectDir.getCanonicalPath()),
	sourceFile: "libs/flow/frontbuilder/svelte/model/Test/src/routes/+page.flow.svelte",
	out: "local.source"
};
var written = null;
var result = block.run({
	props: function () { return props; },
	resourceGet: function () {
		return { content: source, hash: "revision", contentLength: source.length };
	},
	authoringContractSource: function () {
		return { items: [
			{ id: "svelte.text", tag: "Text", properties: { text: { type: "string", intents: ["literal", "source"] } }, slots: {} },
			{ id: "frontbuilder.svelte.callSequence", tag: "CallSequence", properties: {}, slots: {} },
			{ id: "svelte.futurePanel", tag: "FuturePanel", properties: { title: { type: "string", intents: ["literal"] } }, slots: { children: {} } },
			{ id: "flow.block.text.trim", tag: "TextTrim", description: "Trim text" },
			{ id: "project.privateWidget", tag: "PrivateWidget", properties: {}, slots: {} }
		] };
	},
	write: function (_path, value) { written = value; }
}, {});

var tags = result.authoringContract.blocks.map(function (item) { return item.tag; });
assertTrue(tags.indexOf("Text") !== -1 && tags.indexOf("CallSequence") !== -1 &&
	tags.indexOf("FuturePanel") !== -1,
	"The compact source contract did not project every standard Svelte descriptor: " + tags.join(", "));
assertTrue(tags.indexOf("PrivateWidget") === -1 && tags.indexOf("TextTrim") === -1,
	"The compact source contract leaked project or portable descriptors into standard blocks");
assertTrue(result.authoringContract.blocks.filter(function (item) { return item.tag === "FuturePanel"; })[0]
	.slots[0] === "Children",
	"The dynamically projected standard descriptor lost its source wrapper contract");
assertTrue(result.authoringContract.portableBlocks.length === 1 &&
	result.authoringContract.portableBlocks[0].id === "text.trim",
	"Portable blocks were not kept in their dedicated contract section");
assertTrue(written === result, "The source block did not write the contract result");

Packages.org.apache.commons.io.FileUtils.deleteQuietly(projectDir);
print(JSON.stringify({ ok: true, tags: tags }));
