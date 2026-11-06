// flow-project-bootstrap(ui:true) creates the home Page (+page.flow.svelte). The first code-set of that Page by an agent
// that believed it was writing a new Page was refused with FRONTEND_SOURCE_REVISION_REQUIRED (4 of the 5 frontend runs
// of the light bench), and the bootstrap gave no revision. The bootstrap now returns the revision of the Page, which
// the first code-set passes as it is, and the refusal says exactly what to do: code-get, then code-set with that revision.
var root = new java.io.File(String(arguments[0])).getCanonicalFile();
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var MessageDigest = Packages.java.security.MessageDigest;
var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
var checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
function read(path) { return String(FileUtils.readFileToString(new java.io.File(root, path), "UTF-8")); }
function hash(content) {
	var digest = MessageDigest.getInstance("SHA-256").digest(new java.lang.String(String(content)).getBytes(StandardCharsets.UTF_8));
	var out = "";
	for (var i = 0; i < digest.length; i++) out += ("0" + (digest[i] & 255).toString(16)).slice(-2);
	return out;
}

var bootstrapSource = read("_flow/blocks/project/bootstrap.block.js");
var bootstrap = eval(bootstrapSource.substring(bootstrapSource.indexOf("(function"))
	.replace("run: function (ctx, node) {", "_svelteModel: ensureSvelteModel, run: function (ctx, node) {"));
var starterSource = read("_flow/lib/project-starter.js");
var starter = eval(starterSource.substring(starterSource.indexOf("(function")));
var sourceBlockSource = read("_flow/blocks/frontend/svelte/source.block.js");
var sourceBlock = eval(sourceBlockSource.substring(sourceBlockSource.indexOf("(function")));

var dir = java.nio.file.Files.createTempDirectory("flow-bootstrap-page-revision-").toFile();
try {
	var project = { getDirPath: function () { return String(dir.getAbsolutePath()); } };
	var model = bootstrap._svelteModel({ lib: function (name) { assert(name === "project-starter", "the starter page"); return starter; } }, project, "Shop");
	var page = String(FileUtils.readFileToString(new java.io.File(model.file), "UTF-8"));
	assert(model.created === true && model.path === "_flow/frontbuilder/svelte/model/Shop/src/routes/+page.flow.svelte", "the bootstrap creates the home Page");
	assert(typeof model.revision === "string" && model.revision === hash(page), "the bootstrap gives the revision of the Page it created: " + model.revision);
	assert(bootstrap._svelteModel({ lib: function () { return starter; } }, project, "Shop").revision === model.revision,
		"and the revision of the Page it finds, when it already exists");
	// The tool result carries it, with the next step
	assert(/result\.frontbuilderModelRevision = model\.revision;/.test(bootstrapSource) && /its first code-set passes revision/.test(bootstrapSource),
		"flow-project-bootstrap returns frontbuilderModelRevision and says to pass it");

	// The frontend source tool, as code-set runs it (the validation of the provider stubbed: the Page is valid)
	function context(props) {
		return {
			props: function () { return props; },
			resourceGet: function (request) {
				var content = String(FileUtils.readFileToString(new java.io.File(request.projectDir, request.path), "UTF-8"));
				return { content: content, hash: hash(content), contentLength: content.length };
			},
			authoringTreeSource: function () { return { ok: true, diagnostics: [], children: [] }; },
			authoringContractSource: function () { return { ok: true, items: [] }; },
			notifySourceMutation: function () { return { ok: true }; },
			write: function () {}
		};
	}
	function codeSet(props) { return sourceBlock.run(context(props), { props: props }); }
	var replacement = page.replace("Flow Svelte frontend is ready.", "Welcome to the shop.");
	assert(replacement !== page, "the agent writes its own Page");

	// 1. Without a revision: refused, and the refusal says exactly what to do
	var refusal = null;
	try {
		codeSet({ operation: "set", projectDir: String(dir.getAbsolutePath()), sourceFile: model.path, code: replacement });
	} catch (e) {
		refusal = e;
	}
	assert(refusal && String(refusal.code) === "FRONTEND_SOURCE_REVISION_REQUIRED", "the first code-set without a revision is refused: " + refusal);
	var told = String(refusal.message) + " " + String(refusal.hint);
	["code-get({ sourceFile: \"" + model.path + "\" })", "code-set again", "revision", "frontbuilderModelRevision", "flow-project-bootstrap"].forEach(function (part) {
		assert(told.indexOf(part) !== -1, "the refusal says " + part + ": " + told);
	});

	// 2. With the revision the bootstrap returned: written at once
	var written = codeSet({ operation: "set", projectDir: String(dir.getAbsolutePath()), sourceFile: model.path, code: replacement, revision: model.revision });
	assert(written.written === true && written.code === replacement && written.revision === hash(replacement),
		"the first code-set with the bootstrap revision writes the Page: " + JSON.stringify(written).substring(0, 400));
} finally {
	FileUtils.deleteDirectory(dir);
}
print("bootstrap-page-revision OK (" + checks + " checks)");
