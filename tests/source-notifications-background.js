// A frontend source write answers before the Studio follows it. The notification of a write refreshes the Project
// Explorer and reveals the source on the UI thread, and synchronizes the development viewer under the frontend
// authoring lock of the server, which the Studio holds while it describes its tree: on the caller's thread, a
// code-set with reveal:true waited more than 300 s for its answer while the Studio was busy. In the Studio the
// notifications run on one background thread, in the order of the writes; a server notifies on the caller's thread.
// Run with Rhino: java -cp <rhino:commons-io> org.mozilla.javascript.tools.shell.Main tests/source-notifications-background.js <lib_flow_mcp dir>
var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getCanonicalPath());
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var TimeUnit = java.util.concurrent.TimeUnit;
var count = 0;
function assert(value, message) { count++; if (!value) throw new Error(message); }
function read(dir, path) { return String(FileUtils.readFileToString(new java.io.File(dir, path), "UTF-8")); }

var mcp = eval(read(projectDir, "_flow/lib/mcp.js"));

// 1. In the Studio, the writes are notified after the answer, in their order, even when the Studio is busy.
var studioBusy = new java.util.concurrent.CountDownLatch(1);
var notified = new java.util.concurrent.CountDownLatch(3);
var calls = java.util.Collections.synchronizedList(new java.util.ArrayList());
function slowStudio(dir, path, reveal) {
	studioBusy.await(30, TimeUnit.SECONDS);
	calls.add(dir + "|" + path + "|" + reveal);
	notified.countDown();
}
var started = java.lang.System.nanoTime();
assert(mcp.queueSourceNotifications("/work/App", ["routes/+page.flow.svelte", "routes/items/+page.flow.svelte"], true,
	{ background: true, notify: slowStudio }) === true, "the Studio notification of a write is queued");
assert(mcp.queueSourceNotifications("/work/App", ["routes/orders/+page.flow.svelte"], false,
	{ background: true, notify: slowStudio }) === true, "the next write is queued behind the first one");
var answeredMs = (java.lang.System.nanoTime() - started) / 1000000;
assert(answeredMs < 1000 && calls.size() === 0, "the writes answered without waiting for the Studio (" + answeredMs + " ms)");
studioBusy.countDown();
assert(notified.await(30, TimeUnit.SECONDS), "the queued notifications ran once the Studio was free");
assert(String(calls.toString()) === "[/work/App|routes/+page.flow.svelte|true, /work/App|routes/items/+page.flow.svelte|true, " +
	"/work/App|routes/orders/+page.flow.svelte|false]", "the notifications kept the order of the writes and their reveal: " + calls);

// 2. A failing notification does not stop the next ones.
var afterFailure = new java.util.concurrent.CountDownLatch(1);
assert(mcp.queueSourceNotifications("/work/App", ["broken.flow.svelte", "next.flow.svelte"], false, { background: true,
	notify: function (dir, path) {
		if (path === "broken.flow.svelte") throw new Error("Studio unavailable");
		afterFailure.countDown();
	} }) === true, "a notification is queued");
assert(afterFailure.await(30, TimeUnit.SECONDS), "a failing notification does not stop the next ones");

// 3. Outside the Studio the caller notifies (its notification drops the snapshots the next call reads), as without
//    sources to notify.
assert(mcp.queueSourceNotifications("/work/App", ["routes/+page.flow.svelte"], true,
	{ background: false, notify: slowStudio }) === false, "a server notifies on the caller's thread");
assert(mcp.queueSourceNotifications("/work/App", [], true, { background: true, notify: slowStudio }) === false,
	"nothing is queued without a source");

// 4. The Svelte source block leaves the notification to the library when it queued it, else notifies itself.
var blockSource = read(projectDir, "_flow/blocks/frontend/svelte/source.block.js");
var block = eval(blockSource.substring(blockSource.indexOf("(function")));
var root = java.nio.file.Files.createTempDirectory("flow-source-notifications").toFile();
var sourceFile = "_flow/frontbuilder/svelte/model/Test/src/routes/+page.flow.svelte";
function context(props, queued, engineNotifications, queuedNotifications) {
	return {
		props: function () { return props; },
		lib: function () {
			return {
				sourceStore: function () {
					return {
						drafts: false,
						sourceDrafts: function () { return {}; },
						exists: function (file) { return file.isFile(); },
						dirty: function () { return false; }
					};
				},
				queueSourceNotifications: function (dir, paths, reveal) {
					queuedNotifications.push({ dir: dir, paths: paths, reveal: reveal });
					return queued;
				}
			};
		},
		resourceGet: function (request) {
			var content = read(request.projectDir, request.path);
			return { content: content, hash: String(content.length), contentLength: content.length };
		},
		authoringTreeSource: function () { return { ok: true, diagnostics: [], children: [] }; },
		authoringContractSource: function () { return { ok: true, items: [] }; },
		notifySourceMutation: function (request) { engineNotifications.push(request); return { ok: true }; },
		write: function () {}
	};
}
function write(code, revision, queued) {
	var engineNotifications = [];
	var queuedNotifications = [];
	var props = { operation: "set", projectDir: String(root.getAbsolutePath()), sourceFile: sourceFile, code: code,
		revision: revision, reveal: true };
	var result = block.run(context(props, queued, engineNotifications, queuedNotifications), { props: props });
	return { result: result, engine: engineNotifications, queued: queuedNotifications };
}
var studio = write("<FlowComponent $$id=\"first\"><Structure /></FlowComponent>\n", undefined, true);
assert(studio.result.written === true && studio.queued.length === 1 && studio.queued[0].paths[0] === sourceFile &&
	studio.queued[0].reveal === true && studio.engine.length === 0,
	"a write queued by the library is not notified again on the caller's thread: " + JSON.stringify(studio));
var server = write("<FlowComponent $$id=\"second\"><Structure /></FlowComponent>\n", studio.result.revision, false);
assert(server.result.written === true && server.queued.length === 1 && server.engine.length === 1 &&
	server.engine[0].path === sourceFile && server.engine[0].reveal === true,
	"a write the library did not queue is notified on the caller's thread: " + JSON.stringify(server));

print("source-notifications-background OK (" + count + " checks)");
