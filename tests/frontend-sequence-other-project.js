// @.Seq names a sequence of the page project. A page reading @.sales_by_category while the sequence belongs to a
// referenced project got the generic "Call the sequence with a CallSequence first": the warning now gives the
// reference to write, @Sales.sales_by_category, and its CallSequence.
var root = String(arguments[0] || "");
var files = Packages.org.apache.commons.io.FileUtils;
var blockSource = String(files.readFileToString(new java.io.File(root, "_flow/blocks/frontend/svelte/source.block.js"), "UTF-8"));
var block = eval(blockSource.substring(blockSource.indexOf("(function")));
function assertTrue(condition, message) { if (!condition) throw new Error(message); }

var workspace = java.nio.file.Files.createTempDirectory("flow-sequence-other-project-").toFile().getCanonicalFile();
try {
	var app = new java.io.File(workspace, "App"), sales = new java.io.File(workspace, "Sales");
	files.writeStringToFile(new java.io.File(app, "c8oProject.yaml"), [
		"convertigo: 8.5.0",
		"↓App [core.Project]:",
		"  ↓project [references.ProjectSchemaReference]:",
		"    projectName: lib_flow_engine=https://example.invalid/lib_flow_engine.zip",
		"  ↓project1 [references.ProjectSchemaReference]:",
		"    projectName: Sales",
		""
	].join("\n"), "UTF-8");
	files.writeStringToFile(new java.io.File(sales, "_c8oProject/sequences/sales_by_category.yaml"), "comment: ''\n", "UTF-8");
	var sourceFile = "_flow/frontbuilder/svelte/model/App/src/routes/+page.flow.svelte";
	var code = '<script module>\n  export const _flow = { sourceVersion: 2 };\n</script>\n\n<FlowComponent $$id="home" label="Home"><Structure>' +
		'<Text $$id="total" text="@.sales_by_category.total" /></Structure></FlowComponent>\n';
	files.writeStringToFile(new java.io.File(app, sourceFile), code, "UTF-8");
	function check(sequence) {
		var props = { operation: "check", projectDir: String(app.getAbsolutePath()), sourceFile: sourceFile, code: code };
		return block.run({
			props: function () { return props; },
			resourceGet: function () { return { content: code, hash: "revision", contentLength: code.length }; },
			authoringTreeSource: function () {
				return { ok: true, children: [], diagnostics: [{ level: "warning", code: "FRONTEND_SEQUENCE_RESULT_UNKNOWN",
					message: "No CallSequence of this page or its layouts produces the result @." + sequence + ": the value stays empty.",
					path: "frontAst.slots.structure.children[0].props.text",
					hint: "Call the sequence with a CallSequence first, or read the result of a sequence that is called." }] };
			},
			authoringContractSource: function () { return { ok: true, items: [] }; },
			write: function () {}
		}, { props: props });
	}
	function warning(result) {
		var found = (result.diagnostics || []).filter(function (item) { return item.code === "FRONTEND_SEQUENCE_RESULT_UNKNOWN"; });
		assertTrue(found.length === 1, "one sequence result warning: " + JSON.stringify(result));
		return found[0];
	}

	var other = warning(check("sales_by_category"));
	assertTrue(other.suggestedReference === "@Sales.sales_by_category" &&
		String(other.hint).indexOf('requestable="Sales.sales_by_category"') >= 0 && String(other.hint).indexOf("@Sales.sales_by_category") >= 0,
		"a sequence of a referenced project gives @Project.Sequence: " + JSON.stringify(other));

	// A sequence of the page project itself, or of no referenced project, keeps the generic hint.
	files.writeStringToFile(new java.io.File(app, "_c8oProject/sequences/sales_by_category.yaml"), "comment: ''\n", "UTF-8");
	var own = warning(check("sales_by_category"));
	assertTrue(/^Call the sequence/.test(String(own.hint)) && own.suggestedReference === undefined, "own sequence: " + JSON.stringify(own));
	var unknown = warning(check("missing_sequence"));
	assertTrue(/^Call the sequence/.test(String(unknown.hint)), "unknown sequence: " + JSON.stringify(unknown));
} finally {
	files.deleteQuietly(workspace);
}
print("frontend-sequence-other-project: ok");
