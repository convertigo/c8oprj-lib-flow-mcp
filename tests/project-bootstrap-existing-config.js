// flow-project-bootstrap on an existing project never removes nor replaces its _flow/engine.yaml configuration: with
// ui:true it only adds the frontend keys that are missing (config.sql, its named queries and initializers stay as they
// are), keeps a value it would set differently with a warning, and a second bootstrap changes nothing.
// Run with Rhino on the Convertigo classpath (Jackson YAML): tests/project-bootstrap-existing-config.js <root> .
var root = new java.io.File(arguments[0]).getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(file) { return String(FileUtils.readFileToString(file, "UTF-8")); }

var source = read(new java.io.File(root, "_flow/blocks/project/bootstrap.block.js"));
var block = eval(source.substring(source.indexOf("(function"))
	.replace("run: function (ctx, node) {", "_ensure: ensureFlowEngine, _svelteModel: ensureSvelteModel, run: function (ctx, node) {"));
var starterSource = read(new java.io.File(root, "_flow/lib/project-starter.js"));
var starter = eval(starterSource.substring(starterSource.indexOf("(function")));

var yamlMapper = new Packages.com.fasterxml.jackson.databind.ObjectMapper(new Packages.com.fasterxml.jackson.dataformat.yaml.YAMLFactory());
var jsonMapper = new Packages.com.fasterxml.jackson.databind.ObjectMapper();
function parseYaml(text) { return JSON.parse(String(jsonMapper.writeValueAsString(yamlMapper.readTree(String(text))))); }
var ctx = { parseYaml: parseYaml };

var tmp = java.nio.file.Files.createTempDirectory("flow-bootstrap-existing-").toFile();
function projectWith(engineYaml) {
	var flowEngine = {
		source: engineYaml,
		qname: "",
		getEngineSource: function () { return this.source; },
		setEngineSource: function (text) { this.source = String(text); },
		setEngineQName: function (name) { this.qname = String(name); },
		getEngineQName: function () { return this.qname; }
	};
	return {
		flowEngine: flowEngine,
		getFlowEngine: function () { return flowEngine; },
		getName: function () { return "Books"; },
		getDirPath: function () { return String(tmp.getAbsolutePath()); }
	};
}
function ensure(project, ui) {
	var modelPath = ui ? "_flow/frontbuilder/svelte/model/Books/src/routes/+page.flow.svelte" : "";
	// the base signature had no ctx
	return block._ensure.length === 5
		? block._ensure(ctx, project, ui, "_flow/frontbuilder/svelte", modelPath)
		: block._ensure(project, ui, "_flow/frontbuilder/svelte", modelPath);
}

var sqlBlock = [
	"  sql:",
	"    connections:",
	"      books:",
	"        url: \"jdbc:hsqldb:file:.//_flow/resources/sql/books/database/books\"",
	"        user: SA",
	"        password: \"${Books.books.db.password.secret=}\"",
	"        dialect: hsqldb",
	"    initializers:",
	"      books:",
	"        connection: books",
	"        schemaFile: _flow/resources/sql/books/schema.json",
	"    queries:",
	"      books_list:",
	"        connection: books",
	"        readOnly: true",
	"        sql: 'SELECT ID AS \"id\", TITLE AS \"title\" FROM BOOK ORDER BY TITLE'",
	"        parameters:",
	"        - {name: shelf, type: string}",
	"        columns:",
	"          - {name: id, type: int64, nullable: false}",
	"          - {name: title, type: string, nullable: false}"
].join("\n");
var existingYaml = [
	"version: 1",
	"engineQName: lib_flow_engine.Engine",
	"bindings: {}",
	"config:",
	"  demo:",
	"    login: \"${Books.demo.login=false}\"",
	sqlBlock,
	""
].join("\n");

try {
	// 1. ui:true on a backend project: config.sql is untouched, the frontend keys are added
	var project = projectWith(existingYaml);
	var before = parseYaml(existingYaml);
	var flow = ensure(project, true);
	var after = parseYaml(project.flowEngine.source);
	assert(JSON.stringify(after.config.sql) === JSON.stringify(before.config.sql),
		"config.sql is identical after the ui bootstrap: " + project.flowEngine.source);
	assert(after.config.sql.queries.books_list && after.config.sql.queries.books_list.sql.indexOf("FROM BOOK") !== -1,
		"the named query books_list is still declared");
	assert(JSON.stringify(after.config.sql.initializers) === JSON.stringify(before.config.sql.initializers), "the initializer is kept");
	assert(project.flowEngine.source.indexOf(sqlBlock + "\n") !== -1, "the sql text is kept as written");
	assert(after.config.demo.login === "${Books.demo.login=false}", "demo.login is kept");
	assert(after.config.frontbuilder && after.config.frontbuilder.svelte.modelPath ===
		"_flow/frontbuilder/svelte/model/Books/src/routes/+page.flow.svelte", "the frontend config is added");
	assert(after.configVisibility && after.configVisibility.frontbuilder === "private", "and its visibility");
	assert(flow.written === true && flow.configuredSvelte === true, "the merged source is written");
	assert(flow.merge && flow.merge.added.join(",") === "config.frontbuilder,configVisibility",
		"the bootstrap reports what it added: " + JSON.stringify(flow.merge));
	assert(flow.merge.kept.length === 0, "nothing differs");

	// 2. a second bootstrap, without then with ui, is idempotent
	var merged = project.flowEngine.source;
	var model = new java.io.File(tmp, "_flow/frontbuilder/svelte/model/Books/src/routes/+page.flow.svelte");
	model.getParentFile().mkdirs();
	FileUtils.writeStringToFile(model, "<script></script>\n", "UTF-8");
	var again = ensure(project, false);
	assert(project.flowEngine.source === merged && again.written === false, "a second bootstrap without ui changes nothing");
	again = ensure(project, true);
	assert(project.flowEngine.source === merged && again.written === false, "nor a second one with ui");

	// 3. a key the bootstrap would set differently keeps its value, with a warning
	var otherModel = existingYaml.replace("  sql:\n", "  frontbuilder:\n    svelte:\n      modelPath: _flow/frontbuilder/svelte/model/Other/src/routes/+page.flow.svelte\n  sql:\n");
	project = projectWith(otherModel);
	flow = ensure(project, true);
	after = parseYaml(project.flowEngine.source);
	assert(after.config.frontbuilder.svelte.modelPath === "_flow/frontbuilder/svelte/model/Other/src/routes/+page.flow.svelte",
		"an existing modelPath is kept: " + project.flowEngine.source);
	assert(JSON.stringify(after.config.sql) === JSON.stringify(before.config.sql), "config.sql is kept");
	assert(after.config.frontbuilder.svelte.target === "svelte5", "the missing frontend keys are added next to it");
	assert(flow.merge && flow.merge.kept.join(",") === "config.frontbuilder.svelte.modelPath", "the kept value is reported");

	// 4. a project without config gets the whole block; bindings: {} stays
	project = projectWith("version: 1\nengineQName: lib_flow_engine.Engine\nbindings: {}\n");
	flow = ensure(project, true);
	after = parseYaml(project.flowEngine.source);
	assert(after.config.demo.login === "${Books.demo.login=false}" && after.config.frontbuilder.svelte.target === "svelte5",
		"the missing config is added: " + project.flowEngine.source);
	assert(project.flowEngine.source.indexOf("bindings: {}\n") !== -1, "bindings stay");

	// 5. the engine.yaml of a backend written by flow-resource-patch is JSON (the backend of the L2F bench, anonymized):
	// it was kept unchanged with CONFIG_NOT_MERGED and no modelPath. It is merged, written back as JSON with its indent,
	// the existing keys in their order and the missing ones at the end of their object, and the Page model is created.
	var jsonYaml = [
		'{',
		'  "version": 1,',
		'  "engineQName": "lib_flow_engine.Engine",',
		'  "bindings": {},',
		'  "config": {',
		'    "sql": {',
		'      "connections": {',
		'        "books": {',
		'          "url": "jdbc:hsqldb:file:.//_flow/resources/sql/books/database/catalog",',
		'          "user": "SA",',
		'          "password": "${Books.db.password.secret=}",',
		'          "dialect": "hsqldb",',
		'          "driverClass": "org.hsqldb.jdbc.JDBCDriver",',
		'          "nativeRead": true,',
		'          "nativeWrite": true',
		'        }',
		'      },',
		'      "initializers": {',
		'        "books": {',
		'          "connection": "books",',
		'          "schemaFile": "_flow/resources/sql/books/schema.json"',
		'        }',
		'      },',
		'      "queries": {',
		'        "bookById": {',
		'          "connection": "books",',
		'          "readOnly": true,',
		'          "maxRows": 200,',
		'          "sql": "SELECT ID AS \\"id\\", SHELF AS \\"shelf\\", TITLE AS \\"title\\" FROM BOOK WHERE ID = :id",',
		'          "parameters": [',
		'            {',
		'              "name": "id",',
		'              "type": "int64",',
		'              "nullable": false',
		'            }',
		'          ],',
		'          "columns": [',
		'            {',
		'              "name": "id",',
		'              "type": "int64",',
		'              "nullable": false',
		'            },',
		'            {',
		'              "name": "title",',
		'              "type": "string",',
		'              "nullable": false',
		'            }',
		'          ]',
		'        }',
		'      }',
		'    }',
		'  }',
		'}',
		''
	].join("\n");
	var modelFile = new java.io.File(tmp, "_flow/frontbuilder/svelte/model/Books/src/routes/+page.flow.svelte");
	FileUtils.deleteQuietly(modelFile);
	project = projectWith(jsonYaml);
	before = JSON.parse(jsonYaml);
	var page = block._svelteModel({ lib: function () { return starter; } }, project, "Books");
	flow = ensure(project, true);
	assert(flow.merge && flow.merge.source !== null, "a JSON engine.yaml is merged, not CONFIG_NOT_MERGED: " + JSON.stringify(flow.merge));
	var text = project.flowEngine.source;
	after = JSON.parse(text);
	assert(JSON.stringify(after.config.sql) === JSON.stringify(before.config.sql), "config.sql is identical in value and order: " + text);
	assert(after.config.sql.connections.books.password === "${Books.db.password.secret=}", "the secret symbol is kept");
	assert(after.config.frontbuilder && after.config.frontbuilder.svelte.modelPath === page.path, "modelPath is set: " + text);
	assert(after.config.demo.login === "${Books.demo.login=false}" && after.configVisibility.frontbuilder === "private",
		"demo.login and the visibility are added");
	assert(flow.merge.added.join(",") === "config.demo,config.frontbuilder,configVisibility" && flow.merge.kept.length === 0,
		"the bootstrap reports what it added: " + JSON.stringify(flow.merge));
	assert(Object.keys(after).join(",") === "version,engineQName,bindings,config,configVisibility" &&
		Object.keys(after.config).join(",") === "sql,demo,frontbuilder", "the existing keys keep their order, the new ones end their object");
	assert(text === JSON.stringify(after, null, 2) + "\n" && text.indexOf(jsonYaml.substring(0, jsonYaml.indexOf('    "sql"'))) === 0,
		"the text stays JSON with a 2-space indent");
	assert(flow.written === true && flow.configuredSvelte === true, "the merged source is written");
	assert(page.exists && modelFile.isFile(), "the Page model exists, as on a new project");
	again = ensure(project, true);
	assert(project.flowEngine.source === text && again.written === false, "a second bootstrap changes nothing");

	// 6. in JSON too, a value the bootstrap would set differently is kept, with a warning
	var otherJson = JSON.stringify((function (doc) {
		doc.config.frontbuilder = { svelte: { modelPath: "_flow/frontbuilder/svelte/model/Other/src/routes/+page.flow.svelte" } };
		return doc;
	})(JSON.parse(jsonYaml)), null, 2) + "\n";
	project = projectWith(otherJson);
	flow = ensure(project, true);
	after = JSON.parse(project.flowEngine.source);
	assert(after.config.frontbuilder.svelte.modelPath === "_flow/frontbuilder/svelte/model/Other/src/routes/+page.flow.svelte" &&
		after.config.frontbuilder.svelte.target === "svelte5", "the existing modelPath is kept, the missing keys added: " + project.flowEngine.source);
	assert(flow.merge.kept.join(",") === "config.frontbuilder.svelte.modelPath", "the kept value is reported");
} finally {
	FileUtils.deleteDirectory(tmp);
}
print("project-bootstrap-existing-config OK (" + count + " checks)");
