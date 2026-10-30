// flow-project-bootstrap creates a new Flow project without the sequence template: its project bean alone (no
// connector, no sequence), in the standard YAML format, loaded by the engine; force replaces an existing project after
// a backup, as a project deploy does. Run with Rhino: java -cp <rhino:commons-io> ... tests/project-bootstrap-new.js .
var root = new java.io.File(arguments[0]).getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(file) { return String(FileUtils.readFileToString(file, "UTF-8")); }

var source = read(new java.io.File(root, "_flow/blocks/project/bootstrap.block.js"));
assert(source.indexOf("c8oprj-template-sequence") === -1, "no template is downloaded by default");
assert(/"templateUrl": \{[\s\S]*?"default": "",/.test(source), "the template URL is opt-in");
var block = eval(source.substring(source.indexOf("(function"))
	.replace("run: function (ctx, node) {", "_create: createProject, _yaml: newProjectYaml, run: function (ctx, node) {"));

var yaml = block._yaml("NewFlowApp");
var lines = yaml.split("\n");
assert(/^convertigo: \d+\.\d+\.\d+/.test(lines[0]), "a standard YAML file starts with its convertigo version: " + lines[0]);
assert(lines[1] === "↓NewFlowApp [core.Project]:", "the project bean");
assert(yaml.indexOf("  comment: Flow project\n") !== -1 && yaml.indexOf("  version: 1.0.0\n") !== -1, "neutral comment and version 1.0.0");
assert(!/Connector|Sequence|Mashup|8\.3\.0/.test(yaml), "no connector, no sequence, nothing of the template: " + yaml);
assert(yaml.split("↓").length === 2, "the project bean is the only bean");

var tmp = java.nio.file.Files.createTempDirectory("flow-bootstrap-new-").toFile();
try {
	var calls = [];
	var loaded = { yamlFormat: null, setYamlFormat: function (format) { this.yamlFormat = String(format); } };
	var engine = {
		projectYamlFile: function (name) { return new java.io.File(tmp, name + "/c8oProject.yaml"); },
		theApp: { databaseObjectsManager: {
			importProject: function (file, override) {
				calls.push({ op: "import", file: String(file.getAbsolutePath()), override: override, text: read(file) });
				return loaded;
			},
			deleteProject: function (name) {
				calls.push({ op: "delete", name: String(name), options: Array.prototype.slice.call(arguments, 1).map(function (option) {
					return String(option).replace(/^.*\.|\]$/g, "");
				}) });
			}
		} }
	};
	var project = block._create(engine, "NewFlowApp", null);
	var dir = new java.io.File(tmp, "NewFlowApp");
	assert(project === loaded && calls.length === 1 && calls[0].op === "import" && calls[0].override === true, "the new project is loaded by the engine");
	assert(calls[0].text === yaml, "from the bare project file");
	// Without the engine on the classpath the enum is a JavaPackage named after it.
	assert(/STANDARD\]?$/.test(loaded.yamlFormat), "and saved in the standard YAML format: " + loaded.yamlFormat);
	assert(new java.io.File(dir, ".gitignore").isFile() && read(new java.io.File(dir, ".gitignore")).indexOf("/_private/") === 0, "a .gitignore");
	assert(new java.io.File(dir, ".gitattributes").isFile(), "a .gitattributes");
	assert(!new java.io.File(dir, "_c8oProject").exists() && !new java.io.File(dir, "index.html").exists(), "no template file");

	// force: the existing project is replaced in its own folder, after a backup
	calls.length = 0;
	FileUtils.writeStringToFile(new java.io.File(dir, ".gitignore"), "kept\n", "UTF-8");
	var existing = { getDirPath: function () { return String(dir.getAbsolutePath()); } };
	block._create(engine, "NewFlowApp", existing);
	assert(calls.length === 2 && calls[0].op === "delete" && calls[0].name === "NewFlowApp", "force deletes the existing project first");
	assert(calls[0].options.join(",") === "createBackup,preserveEclipse,preserveVCS", "with a backup, keeping Eclipse and VCS metadata: " + calls[0].options);
	assert(calls[1].op === "import" && calls[1].file === String(new java.io.File(dir, "c8oProject.yaml").getAbsolutePath()), "then creates it again in its folder");
	assert(read(new java.io.File(dir, ".gitignore")) === "kept\n", "a file the project already had is kept");

	// an engine that loads nothing is an error, not a silent success
	engine.theApp.databaseObjectsManager.importProject = function () { return null; };
	var failed = false;
	try { block._create(engine, "Other", null); } catch (e) { failed = /No project loaded/.test(String(e.message)); }
	assert(failed, "a project the engine does not load fails the bootstrap");
} finally {
	FileUtils.deleteDirectory(tmp);
}
print("project-bootstrap-new OK (" + count + " checks)");
