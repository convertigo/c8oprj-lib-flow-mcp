// The pages of the source contract carry the ids their headers declare, also when the header quotes its keys
// ("page": {"id": "..."}) as the generated CRUD pages write it: those ids are the ones Navigate page= expects.
var projectDir = java.nio.file.Files.createTempDirectory("flow-svelte-page-ids-").toFile();
var routes = "_flow/frontbuilder/svelte/model/Test/src/routes/";
function header(meta) {
	return '<!-- @generated -->\n<script module>\nexport const _flow = ' + JSON.stringify(meta, null, 2) + ';\n</script>\n';
}
var sources = {};
sources[routes + "+page.flow.svelte"] = header({ sourceVersion: 2, page: { id: "app_dashboard", title: "Dashboard" } }) +
	'<FlowComponent $$id="app_dashboard"><Structure /></FlowComponent>\n';
sources[routes + "login/+page.flow.svelte"] = header({ sourceVersion: 2, page: { id: "app_login", title: "Sign in" } }) +
	'<FlowComponent $$id="app_login"><Structure /></FlowComponent>\n';
sources[routes + "orders/+page.flow.svelte"] = '<script module>\n  export const _flow = { sourceVersion: 2, page: { id: "order_list", route: "/orders" } };\n</script>\n' +
	'<FlowComponent $$id="order_list"><Structure /></FlowComponent>\n';
sources[routes + "about/+page.flow.svelte"] = '<script module>\n  export const _flow = { sourceVersion: 2 };\n</script>\n' +
	'<FlowComponent $$id="about"><Structure /></FlowComponent>\n';
// The folder is the route of a page: a declared route that differs is kept apart, as declaredRoute.
sources[routes + "items/[id]/+page.flow.svelte"] = '<script module>\n  export const _flow = { sourceVersion: 2, page: { id: "item", route: "/items/:id" } };\n</script>\n' +
	'<FlowComponent $$id="item"><Structure /></FlowComponent>\n';
sources[routes + "adminUsers/+page.flow.svelte"] = '<script module>\n  export const _flow = { sourceVersion: 2, page: { route: "/admin/users" } };\n</script>\n' +
	'<FlowComponent $$id="users"><Structure /></FlowComponent>\n';
Object.keys(sources).forEach(function (path) {
	var file = new java.io.File(projectDir, path);
	file.getParentFile().mkdirs();
	Packages.org.apache.commons.io.FileUtils.writeStringToFile(file, sources[path], "UTF-8");
});

function assertTrue(condition, message) {
	if (!condition) throw new Error(message);
}

var blockFile = new java.io.File(arguments.length > 0 ? arguments[0] : ".", "_flow/blocks/frontend/svelte/source.block.js");
var blockSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(blockFile, "UTF-8"));
var block = eval(blockSource.substring(blockSource.indexOf("(function")));
var props = {
	operation: "get",
	projectDir: String(projectDir.getCanonicalPath()),
	sourceFile: routes + "+page.flow.svelte",
	out: "local.source"
};
var root = sources[routes + "+page.flow.svelte"];
var result = block.run({
	props: function () { return props; },
	resourceGet: function () { return { content: root, hash: "revision", contentLength: root.length }; },
	authoringContractSource: function () { return { items: [] }; },
	write: function () {}
}, {});

var pages = {};
result.authoringContract.pages.forEach(function (page) { pages[page.path] = page.id; });
assertTrue(pages["/"] === "app_dashboard", "quoted header id of the root page: " + JSON.stringify(result.authoringContract.pages));
assertTrue(pages["/login"] === "app_login", "quoted header id of a sub-route page: " + JSON.stringify(result.authoringContract.pages));
assertTrue(pages["/orders"] === "order_list", "unquoted header id and route: " + JSON.stringify(result.authoringContract.pages));
assertTrue(pages["/about"] === "about", "a page without id keeps the route-derived id: " + JSON.stringify(result.authoringContract.pages));
var byId = {};
result.authoringContract.pages.forEach(function (page) { byId[page.id] = page; });
assertTrue(byId.item && byId.item.path === "/items/[id]" && byId.item.declaredRoute === "/items/:id" && byId.item.parameters[0].name === "id",
	"a page is at the route of its folder: " + JSON.stringify(result.authoringContract.pages));
assertTrue(byId.adminUsers && byId.adminUsers.path === "/adminUsers" && byId.adminUsers.declaredRoute === "/admin/users",
	"a page without id takes the id of its folder route: " + JSON.stringify(result.authoringContract.pages));
assertTrue(!Object.prototype.hasOwnProperty.call(byId.order_list, "declaredRoute"), "a route written as its folder is not repeated");
print("frontend-page-ids-quoted-header: 7 checks passed");
