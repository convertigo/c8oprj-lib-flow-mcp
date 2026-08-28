var projectDir = String(new java.io.File(arguments.length > 0 ? arguments[0] : ".").getAbsolutePath());
var source = String(Packages.org.apache.commons.io.FileUtils.readFileToString(
	new java.io.File(projectDir, "libs/flow/blocks/frontend/asset/import.block.js"), "UTF-8"));
var assetImport = eval(source.substring(source.indexOf("(function")));

function assertTrue(value, message) {
	if (!value) throw new Error(message);
}

var root = Packages.java.nio.file.Files.createTempDirectory("flow-asset-import-");
try {
	var input = root.resolve("generated.png");
	Packages.java.nio.file.Files.writeString(input, "png");
	var result = assetImport.run({
		props: function () {
			return {
				project: "AssetProject",
				projectDir: String(root),
				sourceFile: String(input),
				assetPath: "resources/backgrounds/hero.png"
			};
		},
		write: function () {}
	}, {});
	assertTrue(result.ok === true && result.url === "resources/backgrounds/hero.png" &&
		result.mimeType === "image/png" && result.written === true &&
		Packages.java.nio.file.Files.isRegularFile(root.resolve("resources/backgrounds/hero.png")),
		"Asset import did not create the canonical project resource");

	var traversalRejected = false;
	try {
		assetImport.run({
			props: function () {
				return { projectDir: String(root), sourceFile: String(input), assetPath: "resources/../escape.png" };
			},
			write: function () {}
		}, {});
	} catch (_expected) {
		traversalRejected = true;
	}
	assertTrue(traversalRejected, "Asset import accepted a traversal outside resources/");
} finally {
	Packages.org.apache.commons.io.FileUtils.deleteDirectory(root.toFile());
}

print("frontend-asset-import OK");
