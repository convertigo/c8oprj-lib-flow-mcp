// Offline Rhino runner. Keep test artifacts under this checkout and exit after shell tests start Java workers.
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
const [test, ...args] = process.argv.slice(2);
if (!test || !process.env.CONVERTIGO_TEST_CLASSPATH) {
  console.error('Usage: CONVERTIGO_TEST_CLASSPATH=".../lib/*" node tests/run-rhino.cjs <test.js> <test arguments...>');
  process.exit(2);
}
const privateDir = path.join(root, '_private');
fs.mkdirSync(privateDir, {recursive:true});
const runner = path.join(privateDir, 'run-rhino.js');
fs.writeFileSync(runner, 'var testFile = arguments[0]; arguments = Array.prototype.slice.call(arguments, 1);\ntry { load(testFile); java.lang.System.exit(0); } catch (e) { print(String(e)); if(e.stack) print(e.stack); java.lang.System.exit(1); }\n');
const result = spawnSync('java', ['-Djava.awt.headless=true', '-Djava.io.tmpdir=' + privateDir, '-cp', process.env.CONVERTIGO_TEST_CLASSPATH,
  'org.mozilla.javascript.tools.shell.Main', '-version', '200', runner, path.resolve(root, test), ...args],
  {cwd:root, encoding:'utf8', timeout:180000, env:{...process.env, TMPDIR:privateDir}, maxBuffer:8*1024*1024});
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
if (result.error) console.error(result.error.message);
process.exit(result.status === null ? 1 : result.status);
