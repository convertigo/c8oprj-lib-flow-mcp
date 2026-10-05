// Every Iconify icon displayed by lib_flow_mcp (blocks, types) is carried as an SVG source with its
// set license, so a server without network nor cache still shows it. A missing file, or a name absent
// from the icon set, otherwise fails silently at run time (".failed" marker in the server cache).
// Usage: icon-sources-carried.js [engineDir] [projectDir]
var projectDir = new java.io.File(arguments.length > 1 ? arguments[1] : ".").getCanonicalFile();
var flowDir = new java.io.File(projectDir, "_flow");
var iconsDir = new java.io.File(flowDir, "icons/iconify");
var FileUtils = Packages.org.apache.commons.io.FileUtils;

var sets = [];
iconsDir.listFiles().forEach(function (dir) { if (dir.isDirectory()) sets.push(String(dir.getName())); });
var reference = new RegExp("(?:^|[^a-z0-9-])(" + sets.join("|") + "):([a-z0-9]+(?:-[a-z0-9]+)*)", "g");
var missing = {};
var references = 0;

(function walk(dir) {
	dir.listFiles().forEach(function (file) {
		var name = String(file.getName());
		if (file.isDirectory()) {
			if (!file.equals(new java.io.File(flowDir, "icons")) && name !== "node_modules") walk(file);
		} else if (/\.(c?js|mjs|ts|json|ya?ml|html|svelte)$/.test(name)) {
			var text = String(FileUtils.readFileToString(file, "UTF-8"));
			var match;
			reference.lastIndex = 0;
			while ((match = reference.exec(text))) {
				references++;
				if (!new java.io.File(iconsDir, match[1] + "/" + match[2] + ".svg").isFile()) {
					missing[match[1] + ":" + match[2]] = String(flowDir.toPath().relativize(file.toPath()));
				}
			}
		}
	});
})(flowDir);

sets.forEach(function (set) {
	if (!new java.io.File(iconsDir, set + "/LICENSE.json").isFile()) missing[set + ":LICENSE.json"] = "icons/iconify/" + set;
});
var names = Object.keys(missing);
if (names.length) {
	throw new Error("Icons displayed but not carried as SVG sources (add the SVG, or use a name of the set): "
		+ names.map(function (id) { return id + " (" + missing[id] + ")"; }).join(", "));
}
if (!references) throw new Error("No icon reference found: the scan is broken");
print("icon-sources-carried OK (" + references + " references, sets: " + sets.join(", ") + ")");
