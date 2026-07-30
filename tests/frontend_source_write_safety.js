var projectDir = String(arguments[0] || "");
var blockFile = new java.io.File(projectDir, "libs/flow/blocks/frontend/svelte/source.block.js");
var blockSource = String(Packages.org.apache.commons.io.FileUtils.readFileToString(blockFile, "UTF-8"));
var block = eval(blockSource.substring(blockSource.indexOf("(function")));
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var MessageDigest = Packages.java.security.MessageDigest;
var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
var notificationRequests = [];

function assertTrue(condition, message) {
	if (!condition) throw new Error(message);
}

assertTrue(blockSource.indexOf("ConcurrentHashMap") < 0,
	"Source writes must not retain one lock per edited path.");
assertTrue(blockSource.indexOf("var sourceWriteLock = new ReentrantLock()") >= 0,
	"Source writes must use the bounded global authoring lock.");

function hash(content) {
	var digest = MessageDigest.getInstance("SHA-256").digest(StandardCharsets.UTF_8.encode(String(content)).array());
	var out = "";
	for (var i = 0; i < digest.length; i++) {
		out += ("0" + (digest[i] & 255).toString(16)).slice(-2);
	}
	return out;
}

function context(props) {
	return {
		props: function () { return props; },
		resourceGet: function (request) {
			var file = new java.io.File(request.projectDir, request.path);
			var content = String(FileUtils.readFileToString(file, "UTF-8"));
			return { content: content, hash: hash(content), contentLength: content.length };
		},
		resourcePatch: function (request) {
			assertTrue(request.dryRun === true, "Frontend source patch must only preview through resourcePatch.");
			return {
				content: String(props.previewCode),
				hunks: [{ oldStart: 1, newStart: 1 }]
			};
		},
		authoringTreeSource: function () {
			return { ok: true, diagnostics: [], children: [] };
		},
		notifySourceMutation: function (request) {
			notificationRequests.push(request);
			return { ok: true };
		},
		write: function () {}
	};
}

function run(props) {
	return block.run(context(props), { props: props });
}

function expectError(props, code) {
	var thrown = null;
	try {
		run(props);
	} catch (error) {
		thrown = error;
	}
	assertTrue(thrown != null, "Expected write to fail with " + (code || "an I/O error"));
	if (code) {
		var error = thrown;
		assertTrue(String(error.code || "") === code,
			"Expected " + code + " but got " + String(error.code || "") + ": " + String(error.message || error));
	}
}

var root = Packages.java.nio.file.Files.createTempDirectory("flow-source-write-safety").toFile();
var sourceFile = "libs/flow/frontbuilder/svelte/model/Test/src/routes/+page.flow.svelte";
var source = new java.io.File(root, sourceFile);
var first = "<FlowComponent id=\"first\"><Structure /></FlowComponent>\n";
var second = "<FlowComponent id=\"second\"><Structure /></FlowComponent>\n";
var third = "<FlowComponent id=\"third\"><Structure /></FlowComponent>\n";

var created = run({
	operation: "set",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	code: first
});
assertTrue(created.written === true && created.code === first, "Creation without revision should succeed.");
assertTrue(created.sourceFile === sourceFile, "Creation should report the written source.");
assertTrue(notificationRequests.length === 1 &&
	notificationRequests[0].projectDir === String(root.getAbsolutePath()) &&
	notificationRequests[0].path === sourceFile,
	"Creation should notify the runtime about the changed source.");

expectError({
	operation: "set",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	code: second
}, "FRONTEND_SOURCE_REVISION_REQUIRED");
assertTrue(String(FileUtils.readFileToString(source, "UTF-8")) === first,
	"Update without revision changed the existing source.");

var updated = run({
	operation: "set",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	revision: created.revision,
	code: second
});
assertTrue(updated.written === true && updated.code === second, "Update with the current revision should succeed.");
assertTrue(notificationRequests.length === 2, "Update should emit one source mutation notification.");

expectError({
	operation: "set",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	revision: created.revision,
	code: third
}, "FRONTEND_SOURCE_STALE_REVISION");
assertTrue(String(FileUtils.readFileToString(source, "UTF-8")) === second,
	"Stale revision changed the existing source.");

var patched = run({
	operation: "patch",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	revision: updated.revision,
	codepatch: "@@ -1 +1 @@",
	previewCode: third
});
assertTrue(patched.written === true && patched.code === third &&
	patched.oldRevision === updated.revision && patched.hunks.length === 1,
	"Patch with the current revision should use the validated atomic write path.");
assertTrue(notificationRequests.length === 3, "Patch should emit one source mutation notification.");

expectError({
	operation: "patch",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	revision: updated.revision,
	codepatch: "@@ -1 +1 @@",
	previewCode: first
}, "FRONTEND_SOURCE_STALE_REVISION");
assertTrue(String(FileUtils.readFileToString(source, "UTF-8")) === third,
	"Stale patch revision changed the existing source.");

var parent = source.getParentFile();
assertTrue(parent.setWritable(false, false), "Unable to make the source directory read-only for the failure test.");
try {
	expectError({
		operation: "set",
		projectDir: String(root.getAbsolutePath()),
		sourceFile: sourceFile,
		revision: patched.revision,
		code: first
	}, "");
} finally {
	parent.setWritable(true, false);
}
assertTrue(String(FileUtils.readFileToString(source, "UTF-8")) === third,
	"Failed atomic write truncated or replaced the existing source.");
assertTrue(notificationRequests.length === 3, "Failed writes must not emit source mutation notifications.");

print("frontend source write safety tests passed");
