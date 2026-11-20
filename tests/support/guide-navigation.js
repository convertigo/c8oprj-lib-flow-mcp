// The text of a served guide without the navigation the MCP derives from the guide files (mcp.js guideNavigation:
// the prerequisite of a child, the children or the tree of start, the related blocks and components), to compare a
// served guide with its file.
function withoutGuideNavigation(text) {
	return String(text)
		.replace(/\n\nPrerequisite: read `flow:\/\/guide\/[^`]+` first\./, "")
		.replace(/\n+## (Children|Guide tree)\n[\s\S]*$/, "\n")
		.replace(/\n+Related (blocks|components): [^\n]*(\nRelated components: [^\n]*)?\n*$/, "\n")
		.replace(/\s+$/, "") + "\n";
}
function sameGuideText(served, file) { return withoutGuideNavigation(served) === String(file).replace(/\s+$/, "") + "\n"; }
