// flow-project-bootstrap also references the libraries a referenced library declares in _flow/dependencies.json
// (lib_flow_sql blocks call data.* of lib_flow_crud_data; runs i2l2_opus, i2l2_glm53).
var root = new java.io.File(arguments[0]).getCanonicalFile();
var IO = Packages.org.apache.commons.io.FileUtils, checks = 0;
function assert(value, message) { checks++; if (!value) throw new Error(message); }
var source = String(IO.readFileToString(new java.io.File(root, '_flow/blocks/project/bootstrap.block.js'), 'UTF-8'));
source = source.substring(source.indexOf('(function')).replace('run: function (ctx, node) {', '_required: typeof requiredReferences === "function" ? requiredReferences : null, run: function (ctx, node) {');
var bootstrap = eval(source);
assert(typeof bootstrap._required === 'function', 'bootstrap reads the required libraries of a reference');
var tmp = java.nio.file.Files.createTempDirectory('mcp-required-refs-').toFile();
try {
 IO.writeStringToFile(new java.io.File(tmp, 'sql/_flow/dependencies.json'), '{"format":"convertigo-flow-dependencies","projects":{"lib_flow_crud_data":"0.1.4","lib_flow_engine":"0.1.89"}}', 'UTF-8');
 new java.io.File(tmp, 'plain').mkdirs();
 assert(JSON.stringify(bootstrap._required(new java.io.File(tmp, 'sql').getPath())) === '["lib_flow_crud_data"]', 'lib_flow_sql requires lib_flow_crud_data, never lib_flow_engine');
 assert(JSON.stringify(bootstrap._required(new java.io.File(tmp, 'plain').getPath())) === '[]', 'no dependencies.json, no added reference');
 assert(source.indexOf('result.addedReferences = addedReferences') > 0 && source.indexOf('allReferences.push(required)') > 0, 'added references are applied and reported');
} finally { IO.deleteDirectory(tmp); }
print(JSON.stringify({passed: true, checks: checks}));
