// All tool intents capture the same server-owned target context before providers.
var directory = new java.io.File(arguments[0]).getCanonicalFile();
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(new java.io.File(directory, "_flow/lib/mcp.js"), "UTF-8"));
var realPackages = Packages;
var calls = [];
var mockedPackages = {
	java: realPackages.java, org: realPackages.org,
	com: {twinsoft:{convertigo:{engine:{
		Engine: {theApp:{databaseObjectsManager:{}}},
		flow: {FlowEngineBridge:{prepareProjectRequest:function (request) {
			var args = JSON.parse(String(request));
			if (args.tagContext !== undefined) throw new Error("Caller tag context was not removed");
			calls.push(args);
			args.tagContext = {project:"Proof",assignments:{"Proof.sq:Sample":["second","first"]}};
			args.frontendSourceDrafts = {"/Proof/_flow/engine.yaml":"draft"};
			args.sourceRemovals = ["/Proof/_flow/removed.flow.js"];
			return JSON.stringify(args);
		}}}
	}}}}
};
var mcp = (function (Packages) { return eval(source); })(mockedPackages);
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
["code-run", "code-analyze", "flow-test", "authoring-tree", "authoring-palette", "authoring-mutate"].forEach(function (name) {
	var args = mcp.prepareToolArguments(null, {params:{name:name,arguments:{
		project:"Proof",projectDir:String(directory),qname:"Proof.Sample",tagContext:{project:"Forged"}
	}}}, {resolveProject:false});
	assert(args.tagContext.project === "Proof", name + " did not capture server tags");
	assert(JSON.stringify(args.tagContext.assignments["Proof.sq:Sample"]) === '["second","first"]', "Order changed");
	assert(args.frontendSourceDrafts["/Proof/_flow/engine.yaml"] === "draft", name + " did not carry source drafts");
	assert(args.sourceRemovals.length === 1, name + " did not carry explicit source absence");
});
assert(calls.length === 6, "Host preparation was bypassed for a tool intent");
mockedPackages.com.twinsoft.convertigo.engine.Engine.theApp = null;
var standalone = mcp.prepareToolArguments(null, {params:{name:"code-run",arguments:{
	projectDir:String(directory),qname:"Proof.Sample",tagContext:{project:"Forged"}
}}}, {resolveProject:false});
assert(standalone.tagContext === undefined && calls.length === 6, "Standalone requests must not forge host tag context");
print("project-request-context OK (" + count + " checks)");
