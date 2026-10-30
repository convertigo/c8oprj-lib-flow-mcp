// The compact palette item of a block cut its properties at 24 in alphabetical order: a DataTable (39 properties) lost
// source, selectable and selected, and its events were not given, so the agent of a trial looked for them in the guide.
// The compact item now keeps every property, the texts of the interface (labels, placeholders) last, and the handlers
// of the events of the block.
var project = new java.io.File(arguments[0]).getCanonicalFile();
var mcp = eval(String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(project, "_flow/lib/mcp.js"), "UTF-8")));
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
var names = ["caption", "class", "clearLabel", "clearSortLabel", "columns", "dense", "emptyText", "filterLabel", "filterPlaceholder",
	"filterable", "layout", "locale", "maxRowActions", "moreActionsLabel", "nextLabel", "offset", "pageSize", "pageSummaryLabel",
	"previousLabel", "query", "rowActions", "rowActionsLabel", "rowCountLabel", "rowKey", "selectAllLabel", "selectRowLabel",
	"selectable", "selected", "selectedCountLabel", "serverSide", "showCaption", "sortAscendingLabel", "sortDescendingLabel",
	"sortDirection", "sortKey", "source", "stickyHeader", "style", "total"];
var properties = {};
names.forEach(function (name) { properties[name] = { type: /able$|dense|Header|Caption|serverSide/.test(name) ? "boolean" : "string" }; });
properties.layout.enum = ["auto", "table", "cards"];
var item = { id: "svelte.dataTable", label: "Data table", kind: "widget", properties: properties, apply: { tool: "authoring-mutate" },
	events: { click: { handler: "OnClick", label: "Row action" }, change: { handler: "OnChange" }, selectionChange: { handler: "OnSelectionChange" } } };
var answer = mcp.toolResponse({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "authoring-palette", arguments: { query: "DataTable" } } },
	{ ok: true, items: [item] }, {}).result.structuredContent;
var compact = answer.items[0];
var listed = compact.properties.map(function (entry) { return entry.split(":")[0]; });
assert(listed.length === names.length, "every property is listed: " + listed.length + " of " + names.length);
["source", "selectable", "selected", "rowActions", "maxRowActions"].forEach(function (name) {
	assert(listed.indexOf(name) >= 0, name + " is listed: " + listed.join(","));
});
assert(listed.slice(-12).every(function (name) { return /(?:Label|Text|Placeholder)$/.test(name); }), "labels last: " + listed.slice(-12).join(","));
assert(compact.properties.indexOf("layout:string(auto|table|cards)") >= 0, "an enumeration keeps its values");
assert(JSON.stringify(compact.events) === JSON.stringify(["OnClick", "OnChange", "OnSelectionChange"]), "the handlers of its events: " + JSON.stringify(compact.events));
var plain = mcp.toolResponse({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "authoring-palette", arguments: {} } },
	{ ok: true, items: [{ id: "svelte.text", properties: { text: { type: "string" } } }] }, {}).result.structuredContent.items[0];
assert(plain.events === undefined, "a block without events has none");
print("palette-compact-contract OK (" + checks + " checks)");
