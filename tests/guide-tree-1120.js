// The guide tree (20/11): one name form, the path (flow://guide/<family>/<topic>), and a navigation the MCP derives from
// the guide files when it serves a guide, never written in them: the prerequisite of a child, the children of a guide
// with their own children, the two-level tree in start, the palette blocks and components its examples use.
// This test checks the convention on the real guides and the rendering of the navigation.
var root = new java.io.File(arguments[0]).getCanonicalFile();
var FU = Packages.org.apache.commons.io.FileUtils;
var __flowProjectDir = String(root.getAbsolutePath());
var mcp = eval(String(FU.readFileToString(new java.io.File(root, "_flow/lib/mcp.js"), "UTF-8")));
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
var guides = new java.io.File(root, "_flow/resources/guide"), names = [];
(function walk(dir, prefix) {
	dir.listFiles().forEach(function (file) {
		var name = String(file.getName());
		if (file.isDirectory()) walk(file, prefix + name + "/");
		else if (/\.md$/.test(name)) names.push(prefix + name.replace(/\.md$/, ""));
	});
})(guides, "");
names.sort();
function read(name) { return String(FU.readFileToString(new java.io.File(guides, name + ".md"), "UTF-8")); }

// The convention: no orphan, one name form, a description, and no navigation written by hand.
var keys = {};
names.forEach(function (name) {
	var parent = name.indexOf("/") < 0 ? "" : name.substring(0, name.lastIndexOf("/")), key = name.toLowerCase().replace(/\//g, "-");
	assert(!parent || names.indexOf(parent) !== -1, name + " has no parent guide " + parent + ".md");
	assert(!keys[key], "two guides differ by their separators only: " + keys[key] + " and " + name);
	keys[key] = name;
	assert(names.every(function (other) { return other === name || name.indexOf(other + "-") !== 0; }), name + " is named <parent>-<topic>: move it to <parent>/<topic>");
	assert(mcp.guideDescription(read(name)).length > 10, name + " has no description line");
	assert(!/^(Sub-guide of |Prerequisite: |## Drawers$|## Children$|## Guide tree$|Related (blocks|components): )/m.test(read(name)), name + " writes navigation by hand");
});
assert(names.length > 60, "the guides are found: " + names.length);

// The rendering, with the real guides and a small palette.
var palette = { blocks: { "entity.list": true, "entity.save": true, "entity.read": true, "sql.transaction": true, "flow.call": true },
	components: { EntityTable: true, Text: true } };
function nav(name) { return mcp.guideNavigation(name, read(name), names, function (kid) { return mcp.guideDescription(read(kid)); }, palette); }
var lists = nav("entities/model/lists"), description = mcp.guideDescription(read("entities/model/lists"));
assert(lists.indexOf("Prerequisite: read `flow://guide/entities/model` first.") > lists.indexOf(description) &&
	lists.indexOf("Prerequisite:") < lists.indexOf("\n## "), "a child names its parent first, after its description: " + lists.substring(0, 300));
var entities = nav("entities");
assert(/\n## Children\n\n(- `flow:\/\/guide\/entities\/[a-z-]+`[^\n]*\n)+/.test(entities), "a guide lists its children last");
assert(entities.indexOf("- `flow://guide/entities/model` (authoring, format, lists, schema, unique): " + mcp.guideDescription(read("entities/model"))) !== -1,
	"a child shows its own children and its description");
assert(nav("entities/model/lists").indexOf("## Children") === -1, "a leaf lists no children");
var start = nav("start");
assert(/\n## Guide tree\n/.test(start) && /^- entities: [^\n]*\bmodel \(5\)/m.test(start) && /^- start: rules \(3\), syntax$/m.test(start), "start holds the tree on two levels");
names.filter(function (name) { return name.indexOf("/") < 0 && name !== "start"; }).forEach(function (family) {
	assert(new RegExp("^- (" + family + ": |([a-z-]+, )*" + family + "(, |$))", "m").test(start), "start names the family " + family);
});
assert(start.indexOf("Related blocks") === -1 && start.length < 6000, "start stays a short root: " + start.length + " characters");
var jobs = nav("entities/jobs");
assert(/\nRelated blocks: `entity\.list`, `entity\.read`, `entity\.save`, `sql\.transaction` \(contract: `flow-block-get`\)\.\n/.test(jobs),
	"the related blocks are the palette blocks of the examples: " + (/Related blocks: [^\n]*/.exec(jobs) || [""])[0]);
var fake = mcp.guideNavigation("x", "# X\n\nA guide.\n\n```javascript\nrows.push({ a: 1 })\nconst t = entity.list({ entity: \"T\" })\n```\n\n```svelte\n<Structure><EntityTable entity=\"T\" /><Unknown /></Structure>\n```\n",
	["x"], function () { return ""; }, palette);
assert(/Related blocks: `entity\.list` \(/.test(fake) && /Related components: `EntityTable` \(contract: `code-get` with `contractBlocks`\)/.test(fake) &&
	fake.indexOf("rows.push`") === -1, "JavaScript methods and unknown tags are not palette names: " + fake);

// Served: resources/read of a guide carries the navigation, once.
var response = mcp.finalizeResponse({}, { jsonrpc: "2.0", id: 1, method: "resources/read", params: { uri: "flow://guide/entities/model/lists" } },
	{ jsonrpc: "2.0", id: 1, result: { contents: [{ uri: "flow://guide/entities/model/lists", mimeType: "text/markdown", text: read("entities/model/lists") }] } });
var served = response.result.contents[0].text;
assert(served.split("Prerequisite: read `flow://guide/entities/model` first.").length === 2, "the served guide names its prerequisite once: " + served.substring(0, 300));
print("guide-tree-1120 OK (" + count + " checks, " + names.length + " guides)");
