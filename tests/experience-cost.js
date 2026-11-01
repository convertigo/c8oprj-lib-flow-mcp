// Reuses the proven neutral fixture, then times both the actual advice block and the public router.
// Run with tests/run-rhino.cjs and the same arguments as experience-push.js.
load(new java.io.File(arguments[1], 'tests/experience-push.js').getPath());
function ms(start) { return Number(java.lang.System.nanoTime() - start) / 1000000; }
function percentile(values, p) { var sorted = values.slice().sort(function(a,b) {return a-b;}); return sorted[Math.floor((sorted.length-1)*p)]; }
function measure(run, count) {
  var times = [];
  for (var n = 0; n < count; n++) { var start = java.lang.System.nanoTime(); run(n); times.push(ms(start)); }
  return {p50Ms:percentile(times,.5),p95Ms:percentile(times,.95),minMs:Math.min.apply(Math,times)};
}
var benchmarkRequest = {method:'tools/call',params:{name:'code-check',arguments:{projectDir:app,name:'Orders'}}};
var benchmarkHeaders = {'Mcp-Session-Id':sessionId+'-benchmark'};
function component(mode) { return direct(benchmarkHeaders, 'benchmark', {experience:mode}, benchmarkRequest, directResponse); }
component('on');
for (var warm = 0; warm < 100; warm++) { component('off'); component('on'); }
var cacheReads = Number(attributes.get('lib_flow_mcp.experience.control.v1').get('reads'));
var offTimes = [], onTimes = [];
for (var n = 0; n < 500; n++) {
  var modes = n % 2 ? ['on','off'] : ['off','on'];
  modes.forEach(function(mode) {
    var started = java.lang.System.nanoTime(); component(mode);
    (mode === 'on' ? onTimes : offTimes).push(ms(started));
  });
}
assert(Number(attributes.get('lib_flow_mcp.experience.control.v1').get('reads')) === cacheReads, 'Benchmark re-read unchanged drawers');
var freshPush = measure(function(n) {
  direct({'Mcp-Session-Id':sessionId+'-fresh-'+n}, 'benchmark', {}, directRequest, directResponse);
}, 30);
var routerOff = [], routerOn = [], routerSession = sessionId+'-router-cost';
tool('code-check', {projectDir:app,name:'Orders'}, 'on', routerSession);
for (var warm = 0; warm < 10; warm++) tool('code-check', {projectDir:app,name:'Orders'}, warm%2 ? 'on':'off', routerSession);
for (var n = 0; n < 60; n++) {
  var modes = n % 2 ? ['on','off'] : ['off','on'];
  modes.forEach(function(mode) {
    var started = java.lang.System.nanoTime();
    var answer = tool('code-check', {projectDir:app,name:'Orders'}, mode, routerSession);
    assert(!exp(answer), 'Warm benchmark unexpectedly pushed advice');
    (mode === 'on' ? routerOn : routerOff).push(ms(started));
  });
}
var result = {
  component:{iterations:500,offP50Ms:percentile(offTimes,.5),onP50Ms:percentile(onTimes,.5),onP95Ms:percentile(onTimes,.95),
    addedP50Ms:percentile(onTimes,.5)-percentile(offTimes,.5)},
  firstPushWithJournal:freshPush,
  router:{iterations:60,offP50Ms:percentile(routerOff,.5),onP50Ms:percentile(routerOn,.5),onP95Ms:percentile(routerOn,.95),
    addedP50Ms:percentile(routerOn,.5)-percentile(routerOff,.5)},
  unchangedDrawerReads:0,
  estimatedAddedTokens:{sqlAndCommon:Math.ceil(ace.addedChars(exp(first))/4),front:Math.ceil(ace.addedChars(exp(front))/4),error:Math.ceil(ace.addedChars(exp(error))/4),
    saturated:bounded.estimatedTokens},
  tokenMethod:'ceil(serialized additions in structuredContent and text / 4), same approximation as ACE prototype; no model tokenizer'
};
var benchmarkFile = new File(root, 'cost.json');
Files.writeString(benchmarkFile.toPath(), JSON.stringify(result,null,2), UTF8);
print('experience-cost ' + JSON.stringify(result));
