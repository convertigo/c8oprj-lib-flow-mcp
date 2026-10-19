// Writing tools require an explicit target project and never write into the project serving the MCP endpoint;
// their content is inline, MCP tools never read the agent's files.
var directory = new java.io.File(arguments[0]).getCanonicalFile();
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(directory, "_flow/lib/mcp.js"), "UTF-8"));
var Files = java.nio.file.Files;
var projects = Files.createTempDirectory("flow-mcp-projects").toFile().getCanonicalFile();
var app = new java.io.File(projects, "App");
new java.io.File(app, "gen").mkdirs();
var outside = Files.createTempDirectory("flow-mcp-outside").toFile().getCanonicalFile();
function write(file, text) {
	Packages.org.apache.commons.io.FileUtils.writeStringToFile(file, text, "UTF-8");
	return String(file.getPath());
}
var code = "const _flow = { sourceVersion: 2 }\n\nfunction Foo({ input, config, result }) {\n  return { text: \"été ${x}\" }\n}\n";
write(new java.io.File(app, "gen/Foo.flow.js"), code);
write(new java.io.File(app, "gen/Foo.diff"), "@@ -1 +1 @@\n-a\n+b\n");
var secret = write(new java.io.File(outside, "secret.flow.js"), "nope");
var realPackages = Packages;
var mockedPackages = {
	java: realPackages.java, org: realPackages.org,
	com: {twinsoft:{convertigo:{engine:{
		Engine: {theApp:null, PROJECTS_PATH:String(projects.getPath())},
		flow: {FlowEngineBridge:{prepareProjectRequest:function (request) { return String(request); }}}
	}}}}
};
var mcp = (function (Packages) { return eval(source); })(mockedPackages);
var server = {convertigoContext:function () { return {project:{getName:function () { return "lib_flow_mcp"; }}}; }};
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function prepare(name, args, ctx) {
	return mcp.prepareToolArguments(ctx || server, {params:{name:name,arguments:args}}, {resolveProject:false});
}
function fails(name, args, pattern, message) {
	try {
		prepare(name, args);
	} catch (e) {
		assert(pattern.test(String(e.message || e)), message + ": " + (e.message || e));
		return;
	}
	assert(false, message + ": no error");
}

["code-set", "code-patch", "code-promote", "code-discard", "flow-object-remove", "flow-project-remove", "tags-apply", "flow-sync-inputs"].forEach(function (name) {
	fails(name, {qname:"Foo.Foo", code:code}, /requires (an explicit )?project/, name + " without project");
	fails(name, {project:"lib_flow_mcp", qname:"lib_flow_mcp.Foo", code:code}, /refuses to write into lib_flow_mcp/, name + " into the MCP project");
});
assert(prepare("code-get", {qname:"Foo.Foo"}).qname === "Foo.Foo", "reading tools keep their default project");
assert(prepare("code-set", {projectDir:String(directory.getPath()), qname:"Foo.Foo", code:code}).code === code, "standalone tests keep projectDir");
assert(prepare("code-set", {project:"App", projectDir:String(app.getPath()), qname:"App.Foo", code:code}).code === code, "inline code");

fails("code-set", {project:"App", projectDir:String(app.getPath()), qname:"App.Foo", contentFile:"App/gen/Foo.flow.js"}, /takes its content inline/, "contentFile is refused");
fails("code-patch", {project:"App", projectDir:String(app.getPath()), qname:"App.Foo", revision:"r1", contentFile:"App/gen/Foo.diff"}, /takes its content inline/, "contentFile is refused for a patch");
print("project-write-guard OK (" + count + " checks)");
