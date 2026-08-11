var projectDir = arguments.length > 0 ? arguments[0] : ".";
var FileUtils = Packages.org.apache.commons.io.FileUtils;
var StandardCharsets = Packages.java.nio.charset.StandardCharsets;
var Files = Packages.java.nio.file.Files;
var MessageDigest = Packages.java.security.MessageDigest;
var JavaString = Packages.java.lang.String;
var tempRoot = Files.createTempDirectory("flow-engine-internal-sync-test-");
var projectRoot = tempRoot.resolve("lib_flow_engine");
var workspaceRoot = tempRoot.resolve("workspace");
var cacheClears = 0;

function assertTrue(condition, message) {
	if (!condition) {
		throw new Error(message);
	}
}

function sha256(value) {
	var bytes = MessageDigest.getInstance("SHA-256").digest(
		new JavaString(String(value)).getBytes(StandardCharsets.UTF_8));
	var out = "";
	for (var index = 0; index < bytes.length; index++) {
		out += ("0" + ((bytes[index] & 255).toString(16))).slice(-2);
	}
	return out;
}

function request(args, id) {
	return {
		jsonrpc: "2.0",
		id: id || 1,
		method: "tools/call",
		params: { name: "flow-resource-patch", arguments: args }
	};
}

function errorMessage(response) {
	return response && response.error ? String(response.error.message || response.error) : "";
}

try {
	Files.createDirectories(projectRoot.resolve("libs/flow/modules"));
	Files.createDirectories(workspaceRoot);
	var enginePath = projectRoot.resolve("libs/flow/Engine.js");
	var modulePath = projectRoot.resolve("libs/flow/modules/example.js");
	var originalEngine = "(function () { return { version: 'old' }; }())\n";
	var targetEngine = "(function () { return { version: 'new' }; }())\n";
	var originalModule = "(function () { return { value: 1 }; }())\n";
	var targetModule = "(function () { return { value: 2 }; }())\n";
	Files.writeString(enginePath, originalEngine, StandardCharsets.UTF_8);
	Files.writeString(modulePath, originalModule, StandardCharsets.UTF_8);

	var blockFile = new java.io.File(projectDir,
		"libs/flow/blocks/mcp/tool/flow/resource/patch.block.js");
	var blockSource = String(FileUtils.readFileToString(blockFile, "UTF-8"));
	var runtimeSource = blockSource.substring(blockSource.indexOf("(function ()"));
	var realPackages = Packages;
	var mockedPackages = {
		java: realPackages.java,
		org: realPackages.org,
		com: {
			twinsoft: {
				convertigo: {
					engine: {
						Engine: {
							USER_WORKSPACE_PATH: String(workspaceRoot),
							projectDir: function () { return String(projectRoot); },
							theApp: {
								databaseObjectsManager: {
									getLoadedProjectByName: function () { return {}; },
									getOriginalProjectByName: function () { return {}; }
								}
							}
						},
						flow: {
							FlowEngineBridge: {
								clearCaches: function () { cacheClears++; }
							}
						}
					}
				}
			}
		}
	};
	var implementation = (function (Packages) { return eval(runtimeSource); }(mockedPackages));
	var written = null;
	var normalCalls = 0;
	var capturedResolveProject = null;
	var mcp = {
		requestValue: function (_ctx, value) { return value; },
		toolArguments: function (value) { return value.params.arguments; },
		runToolBlock: function (_ctx, value, options, handler) {
			capturedResolveProject = options.resolveProject;
			try {
				return {
					jsonrpc: "2.0",
					id: value.id,
					result: { structuredContent: handler(value.params.arguments) }
				};
			} catch (error) {
				return { jsonrpc: "2.0", id: value.id, error: { code: -32602, message: String(error) } };
			}
		}
	};
	var ctx = {
		props: function (node) { return node.props; },
		lib: function () { return mcp; },
		resourcePatch: function (args) { normalCalls++; return { ok: true, args: args }; },
		write: function (_path, value) { written = value; }
	};

	var syncFiles = [{
		path: "libs/flow/Engine.js",
		content: targetEngine,
		baseHash: sha256(originalEngine),
		sha256: sha256(targetEngine)
	}, {
		path: "libs/flow/modules/example.js",
		content: targetModule,
		baseHash: sha256(originalModule),
		sha256: sha256(targetModule)
	}];
	var dryRun = implementation.run(ctx, { props: { request: request({
		project: "lib_flow_engine",
		scope: "engine-internal",
		revision: "9bb744e",
		files: syncFiles
	}) } });
	assertTrue(capturedResolveProject === false && dryRun.result.structuredContent.dryRun === true &&
		dryRun.result.structuredContent.changed === true && dryRun.result.structuredContent.applied === false,
		"engine-internal synchronization should default to a non-mutating dry-run");
	assertTrue(String(Files.readString(enginePath, StandardCharsets.UTF_8)) === originalEngine && cacheClears === 0,
		"dry-run changed an engine resource or cleared runtime caches");
	var invalidBatch = implementation.run(ctx, { props: { request: request({
		project: "lib_flow_engine",
		scope: "engine-internal",
		revision: "9bb744e",
		dryRun: false,
		files: [syncFiles[0], {
			path: "libs/flow/modules/example.js",
			content: "(function () {",
			baseHash: sha256(originalModule),
			sha256: sha256("(function () {")
		}]
	}, 11) } });
	assertTrue(invalidBatch.error &&
		String(Files.readString(enginePath, StandardCharsets.UTF_8)) === originalEngine &&
		String(Files.readString(modulePath, StandardCharsets.UTF_8)) === originalModule && cacheClears === 0,
		"engine-internal synchronization partially applied a batch that failed validation");

	var applied = implementation.run(ctx, { props: { request: request({
		project: "lib_flow_engine",
		scope: "engine-internal",
		revision: "9bb744e",
		dryRun: false,
		files: syncFiles
	}, 2) } });
	assertTrue(applied.result.structuredContent.applied === true && cacheClears === 1 &&
		String(Files.readString(enginePath, StandardCharsets.UTF_8)) === targetEngine &&
		String(Files.readString(modulePath, StandardCharsets.UTF_8)) === targetModule,
		"engine-internal synchronization did not atomically apply and invalidate caches");
	assertTrue(written === applied, "resource patch wrapper did not publish the MCP response");

	var stale = implementation.run(ctx, { props: { request: request({
		project: "lib_flow_engine",
		scope: "engine-internal",
		revision: "9bb744e",
		dryRun: false,
		files: syncFiles
	}, 3) } });
	assertTrue(/changed since it was read/.test(errorMessage(stale)) && cacheClears === 1,
		"engine-internal synchronization did not reject a stale base hash");

	var forbidden = implementation.run(ctx, { props: { request: request({
		project: "lib_flow_engine",
		scope: "engine-internal",
		revision: "9bb744e",
		files: [{
			path: "libs/flow/blocks/forbidden.js",
			content: targetEngine,
			baseHash: sha256(targetEngine),
			sha256: sha256(targetEngine)
		}]
	}, 4) } });
	assertTrue(/Unsupported or duplicate/.test(errorMessage(forbidden)),
		"engine-internal synchronization accepted an out-of-contract resource");

	var normal = implementation.run(ctx, { props: { request: request({
		project: "another_project",
		scope: "project",
		path: "libs/example.js",
		patch: "unused"
	}, 5) } });
	assertTrue(normalCalls === 1 && capturedResolveProject === true && normal.result.structuredContent.ok === true,
		"ordinary project resource patching no longer delegates to the established capability");
	print("engine_internal_resource_sync: ok");
} finally {
	FileUtils.deleteDirectory(tempRoot.toFile());
}
