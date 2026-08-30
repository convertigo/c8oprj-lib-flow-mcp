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
		authoringContractSource: function (request) {
			var drafts = request && request.frontendSourceDrafts || {};
			var paths = Object.keys(drafts);
			if (paths.length === 0) return { ok: true, items: [] };
			var draft = String(drafts[paths[0]] || "");
			if (draft.indexOf("<BrokenSvelte>") >= 0) {
				throw new Error("Unexpected end of Svelte component");
			}
			var id = draft.match(/\bid\s*:\s*["']([^"']+)["']/);
			var tag = draft.match(/\btag\s*:\s*["']([^"']+)["']/);
			return {
				ok: true,
				items: id ? [{ id: id[1], tag: tag ? tag[1] : "" }] : []
			};
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

var contextual = run({
	operation: "rg",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	pattern: "id=\"second\"",
	context: 0
});
assertTrue(contextual.matchCount === 1 && contextual.extracts.length === 1 &&
	contextual.extracts[0].sourceFile === sourceFile &&
	contextual.extracts[0].revision === updated.revision &&
	contextual.extracts[0].line === 1 && contextual.extracts[0].startLine === 1 &&
	contextual.extracts[0].endLine === 1,
	"Contextual search should return the source identity, revision and exact line range needed by code-patch.");

var patched = run({
	operation: "patch",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	revision: contextual.extracts[0].revision,
	codepatch: "@@ -1 +1 @@",
	previewCode: third
});
assertTrue(patched.written === true && patched.code === third &&
	patched.oldRevision === updated.revision && patched.hunks.length === 1,
	"Patch with the current revision should use the validated atomic write path.");
assertTrue(notificationRequests.length === 3, "Patch should emit one source mutation notification.");

var ranged = run({
	operation: "get",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	revision: patched.revision,
	startLine: 1,
	endLine: 1
});
assertTrue(ranged.code === third.trim() && ranged.startLine === 1 && ranged.endLine === 1 &&
	ranged.totalLines === 2 && ranged.partial === true && ranged.authoringContract === undefined,
	"Bounded reads should return only the requested lines while preserving the full-source revision.");
expectError({
	operation: "get",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	revision: updated.revision,
	startLine: 1,
	endLine: 1
}, "FRONTEND_SOURCE_STALE_REVISION");
expectError({
	operation: "get",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	startLine: 0,
	endLine: 1
}, "FRONTEND_SOURCE_RANGE_INVALID");
expectError({
	operation: "get",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: sourceFile,
	startLine: 1
}, "FRONTEND_SOURCE_RANGE_INCOMPLETE");

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

var componentSourceFile = "libs/flow/frontbuilder/svelte/components/TestBadge.flow.svelte";
var componentSource = [
	"<script module>",
	"  export const _meta = {",
	"    id: \"svelte.testBadge\",",
	"    tag: \"TestBadge\",",
	"    label: \"Test badge\",",
	"    insert: { id: \"testBadge\", kind: \"testBadge\", tag: \"TestBadge\" },",
	"    implementation: { kind: \"flow-svelte\", file: \"./TestBadge.flow.svelte\" }",
	"  };",
	"</script>",
	"<script>let { label = \"Badge\" } = $props();</script>",
	"<span>{label}</span>",
	""
].join("\n");

var componentCreated = run({
	operation: "set",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: componentSourceFile,
	code: componentSource
});
assertTrue(componentCreated.written === true && componentCreated.code === componentSource,
	"A canonical provider component with static _meta should be writable without a FlowComponent root.");

var componentCheck = run({
	operation: "check",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: componentSourceFile,
	code: componentSource
});
assertTrue(componentCheck.ok === true && componentCheck.errorCount === 0,
	"A valid provider component should pass code-check.");

var missingMetaCheck = run({
	operation: "check",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: componentSourceFile,
	code: "<span>Missing metadata</span>\n"
});
assertTrue(missingMetaCheck.ok === false &&
	missingMetaCheck.diagnostics[0].code === "FRONTEND_COMPONENT_META_REQUIRED",
	"Provider components without module-level _meta must remain rejected.");

var brokenComponentCheck = run({
	operation: "check",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: componentSourceFile,
	code: componentSource.replace("<span>{label}</span>", "<BrokenSvelte>")
});
assertTrue(brokenComponentCheck.ok === false &&
	brokenComponentCheck.diagnostics[0].code === "FRONTEND_COMPONENT_PARSE_FAILED",
	"Provider component drafts must be parsed by the frontbuilder before writes.");

var modelWithoutRoot = "libs/flow/frontbuilder/svelte/model/Test/src/routes/raw.flow.svelte";
var modelCheck = run({
	operation: "check",
	projectDir: String(root.getAbsolutePath()),
	sourceFile: modelWithoutRoot,
	code: componentSource
});
assertTrue(modelCheck.ok === false && modelCheck.diagnostics[0].code === "FRONTEND_FLOW_COMPONENT_REQUIRED",
	"Raw provider syntax must not weaken the FlowComponent contract of application model sources.");

print("frontend source write safety tests passed");
