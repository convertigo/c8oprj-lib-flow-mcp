// Definitions of guide FlowScript texts, read by the engine itself (Rhino: the FlowScript v3 Java reader), for Node
// tests that orchestrate guide examples with doubles. Usage:
//   java -cp <classpath> org.mozilla.javascript.tools.shell.Main -version 200 guide-flow-definitions.js <engine _flow> <request.json>
// request: { blocks: { "<name>": "<block code>" }, flows: { "<id>": "<Flow code>" } }. Prints one JSON line:
// { "<id>": <definition> }. The blocks are set first (blockCodeSet) so that the Flows may call them.
var File = java.io.File, FU = Packages.org.apache.commons.io.FileUtils;
// The engine properties as the test runner sets them (tools/run-library-tests.cjs of lib_flow_engine).
var EPM = Packages.com.twinsoft.convertigo.engine.EnginePropertiesManager;
EPM.initProperties();
EPM.setProperty(EPM.PropertyName.SERVER_BUILD, "studio");
var engineRoot = new File(arguments[0]).getCanonicalFile();
var request = JSON.parse(String(FU.readFileToString(new File(arguments[1]), "UTF-8")));
var temporary = java.nio.file.Files.createTempDirectory(engineRoot.getParentFile().getParentFile().toPath(), "flow-guide-definitions-").toFile();
var __flowEngineDir = String(engineRoot), __flowProjectDir = String(temporary);
try {
	FU.writeStringToFile(new File(temporary, "c8oProject.yaml"), "projectName: lib_flow_sql\nprojectName: lib_flow_crud_data\nprojectName: lib_flow_entity\n", "UTF-8");
	var engine = eval(String(FU.readFileToString(new File(engineRoot, "Engine.js"), "UTF-8")));
	var api = function (method, args) { return JSON.parse(String(engine[method](JSON.stringify(args)))); };
	Object.keys(request.blocks || {}).forEach(function (name) {
		var set = api("blockCodeSet", { name: name, code: request.blocks[name] });
		if (!set.ok) throw new Error("block " + name + ": " + JSON.stringify(set.error || set));
	});
	var definitions = {};
	Object.keys(request.flows || {}).forEach(function (id) {
		var code = request.flows[id], name = (/function\s+(\w+)/.exec(code) || [])[1] || "GuideExample";
		var out = api("flowSourceValidate", { name: name, code: code });
		if (!out.ok) throw new Error("Flow " + id + ": " + JSON.stringify(out.error || out.diagnostics));
		definitions[id] = out.definition;
	});
	print(JSON.stringify(definitions));
} finally {
	FU.deleteQuietly(temporary);
}
java.lang.System.exit(0);
