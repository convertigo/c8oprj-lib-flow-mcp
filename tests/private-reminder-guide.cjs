// Exact guide fences, production FlowScript parser, expression evaluator and core control blocks.
// Entity/JDBC doubles prove orchestration only; see the guide for real-engine acceptance checks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const engine = path.resolve(__dirname, '../../lib_flow_engine/_flow');
const entity = path.resolve(__dirname, '../../lib_flow_entity/_flow');
const read = file => fs.readFileSync(file, 'utf8');
const plain = value => JSON.parse(JSON.stringify(value));
const load = file => vm.runInNewContext(read(file));
const moduleOf = name => load(path.join(engine, 'modules', name + '.js'));
const sourceService = moduleOf('block-code-source-service');
const parser = moduleOf('flow-script-parser-service');
const expressions = moduleOf('expression-utils');
const nodes = moduleOf('flow-node-utils');
const syntax = moduleOf('template-syntax');
const codec = moduleOf('source-attribute-name-codec');
const destinationContract = moduleOf('destination-contract');
const raise = (code, message) => { throw Object.assign(new Error(message), {code}); };
const env = {
  templateSyntax: syntax, destinationContract, sourceAttributeNameCodec: () => codec,
  normalizeTree: plain, raise, isScopePath: p => /^(input|config|local|result|request|current|trace|parent)(\.|$)/.test(p),
  objectPathParts: p => p.split('.'), blockCatalog: b => b || {},
  safeIdentifier: s => String(s).replace(/[^\w$]/g, '_'), blockLocalName: s => s.split('.').at(-1),
  balancedObjectEnd: sourceService.balancedObjectEnd,
  normalizeFlowScriptFunctionSyntax: sourceService.normalizeFlowScriptFunctionSyntax,
  canonicalFlowDefinition: d => nodes.canonicalFlowDefinition(d, {normalizeTree: plain}),
  isRuntimeHandle: () => false, sanitizeRuntimeValue: plain,
};
const fences = {};
for (const name of ['jobs', 'jobs-runner']) {
  const guide = read(path.join(__dirname, '../_flow/resources/guide/entities', name + '.md'));
  for (const m of guide.matchAll(/<!-- example: ([\w-]+) -->\s*```(\w+)\n([\s\S]*?)```/g)) fences[m[1]] = {language: m[2], code: m[3]};
}
const contracts = {}, implementations = {};
for (const name of ['set', 'if', 'return', 'throw', 'try', 'forEach', 'while', 'log', 'flow.call', 'entity.read', 'entity.list', 'entity.save']) {
  const root = name.startsWith('entity.') ? entity : engine;
  const code = read(path.join(root, 'blocks', name.replaceAll('.', '/') + '.block.js'));
  const at = code.indexOf('{'), end = sourceService.balancedObjectEnd(code, at);
  const meta = vm.runInNewContext('(' + code.slice(at, end + 1) + ')');
  contracts[name] = {...meta, props: meta.properties};
  if (['set', 'if', 'return', 'throw', 'try', 'forEach', 'while', 'flow.call'].includes(name)) {
    implementations[name] = vm.runInNewContext(code.slice(end + 1), {
      flowEngineClass: () => ({nanoTime: () => Date.now() * 1e6}),
    });
  }
}
// The SQL library is not in this checkout. Its documented transaction slot is a double below.
contracts['sql.transaction'] = {props: {connection: {kind: 'template', type: 'string'}}, slots: [{name: 'nodes'}]};
contracts['app.actor'] = {props: {}};
const programs = {};
for (const id of ['prepare-reminder', 'manual-reminder', 'run-reminders']) programs[id] = parser.parseFlowScript(contracts, fences[id].code, env);
const flows = {PrepareReminder: 'prepare-reminder', PrepareReminderManually: 'manual-reminder', RunReminders: 'run-reminders'};

function fixture(count = 2) {
  const state = {
    tasks: Array.from({length: count}, (_, i) => ({key: {id: String(i + 1)}, revision: '1', values: {
      title: 'sensitive-title-' + i, statut: 'aRelancer', dateEcheance: '2026-11-01', preparedDue: null,
    }})), reminders: [], logs: [], enabled: true, roles: [], writes: 0, transactions: 0,
    failSave: null, failCommit: false, beforeRead: null,
  };
  const logger = {};
  for (const level of ['info', 'warn', 'error', 'debug', 'trace']) logger[level] = message => {
    const space = message.indexOf(' ');
    state.logs.push({event: space < 0 ? message : message.slice(0, space), data: space < 0 ? null : JSON.parse(message.slice(space + 1))});
  };
  const logCode = read(path.join(engine, 'blocks/log.block.js'));
  const logImpl = vm.runInNewContext(logCode.slice(sourceService.balancedObjectEnd(logCode, logCode.indexOf('{')) + 1), {
    flowEngineClass: () => ({logContext: logger}),
  });
  function execute(id, input = {}, config = {jobs: {enabled: state.enabled}}) {
    const ctx = {scopes: {input, config, local: {}, result: {}, current: null, request: {}}, stopped: false};
    ctx.props = n => n.props || n;
    ctx.read = p => p.split('.').reduce((o, k) => o?.[k], ctx.scopes);
    ctx.write = (p, value) => {
      const keys = p.split('.'), last = keys.pop(); let o = ctx.scopes;
      for (const k of keys) o = o[k] ??= {};
      o[last] = value; return value;
    };
    ctx.expr = v => expressions.evaluate(ctx, v, env);
    ctx.template = ctx.render = v => expressions.renderTree(ctx, v, env);
    ctx.literal = plain;
    ctx.input = (p, fallback) => p.value === undefined ? fallback : ctx.template(p.value);
    ctx.returnValue = v => {ctx.stopped = true; ctx.returned = v; return v;};
    ctx.canContinue = () => true;
    ctx.throwFlow = e => {throw e;}; ctx.raise = raise;
    ctx.flowGet = name => ({source: name});
    ctx.runFlowSource = (name, config, options) => ({result: execute(flows[options.namedFlowName || name], options.input, config)});
    ctx.runLoopBody = ns => ctx.runNodes(ns);
    ctx.runNodes = ns => {
      for (const n of ns) {
        if (ctx.stopped) break;
        const props = ctx.props(n); let value;
        if (implementations[n.block]) value = implementations[n.block].run(ctx, n);
        else if (n.block === 'log') value = logImpl.run(ctx, n);
        else if (n.block === 'app.actor') value = {user: 'server-user', roles: state.roles};
        else if (n.block === 'sql.transaction') {
          assert.equal(ctx.template(props.connection), 'app'); state.transactions++;
          const before = plain({tasks: state.tasks, reminders: state.reminders});
          try {ctx.runNodes(n.nodes || []); if (state.failCommit) throw {code: 'SQL_COMMIT_FAILED'};} catch (error) {Object.assign(state, before); throw error;}
        } else if (n.block.startsWith('entity.')) {
          assert.equal(ctx.expr(props.checkAccess), false, 'trusted mode is a source constant');
          const entityName = ctx.template(props.entity);
          if (n.block === 'entity.read') {
            const key = ctx.expr(props.key); if (state.beforeRead) state.beforeRead(key, state);
            const row = state.tasks.find(t => t.key.id === key.id); assert(row); value = plain(row);
          } else if (n.block === 'entity.list') {
            const options = ctx.expr(props.options);
            const rows = entityName === 'Task' ? state.tasks.filter(t => t.values.statut === options.filter.statut) : state.reminders.filter(r => r.values.replayKey === options.filter.replayKey);
            const offset = options.offset || 0;
            value = {rows: plain(rows.slice(offset, offset + options.limit)), hasMore: rows.length > offset + options.limit,
              nextOffset: rows.length > offset + options.limit ? offset + options.limit : null};
          } else {
            state.writes++;
            const values = ctx.expr(props.values); const key = props.key ? ctx.expr(props.key) : null;
            if (state.failSave?.(entityName, values, key, state)) throw {code: 'SQL_FIXTURE_FAILURE', message: 'secret-credential sensitive-title'};
            if (entityName === 'Reminder') {
              if (state.reminders.some(r => r.values.replayKey === values.replayKey)) throw {code: 'ENTITY_UNIQUE_CONFLICT'};
              value = {key: {id: String(state.reminders.length + 1)}, values: {state: 'PREPARED', ...values}};
              state.reminders.push(plain(value));
            } else {
              const row = state.tasks.find(t => t.key.id === key.id);
              if (row.revision !== ctx.template(props.revision)) throw {code: 'ENTITY_REVISION_CONFLICT'};
              Object.assign(row.values, values); row.revision = String(Number(row.revision) + 1); value = plain(row);
            }
          }
        } else throw Error('Unsupported compiled block ' + n.block);
        if (n.out) ctx.write(n.out, value);
      }
    };
    ctx.runNodes(programs[id].nodes);
    return plain(ctx.returned === undefined ? ctx.scopes.result : ctx.returned);
  }
  return {state, run: (name, input) => execute(flows[name], input)};
}

test('exact model and all Flow fences compile against the installed entity/core contracts', () => {
  assert.equal(Object.keys(fences).length, 4);
  const model = JSON.parse(fences['reminder-model'].code);
  const entityLoad = name => load(path.join(entity, 'lib', name + '.js'));
  assert.deepEqual(plain(entityLoad('entity-format').check(model, entityLoad('entity-traits'))), []);
  const resolved = entityLoad('entity-model').resolve(model, entityLoad('entity-traits'));
  assert.equal(resolved.entities.Reminder.fields.replayKey.unique, true);
  assert.equal(resolved.entities.Task.fields.statut.computed, true);
  assert.equal(programs['prepare-reminder'].flow.accessibility, 'private');
  assert.equal(programs['run-reminders'].flow.accessibility, 'private');
  assert.equal(programs['manual-reminder'].flow.authenticatedContextRequired, true);
  // Check every compiled call and property, including all child slots, against real descriptors.
  function check(ns) {for (const n of ns) {
    const c = contracts[n.block]; assert(c, n.block);
    for (const p of Object.keys(n.props || {})) assert(p in (c.props || {}), n.block + '.' + p);
    for (const slot of c.slots || []) check(n[slot.name] || []);
  }}
  Object.values(programs).forEach(p => check(p.nodes));
});
test('disabled worker has no read/write, transaction or log effect', () => {
  for (const disabled of [false, 'false', null, undefined]) {
    const f = fixture(); f.state.enabled = disabled;
    assert.deepEqual(f.run('RunReminders'), {enabled: false, prepared: 0});
    assert.equal(f.state.transactions, 0); assert.equal(f.state.writes, 0); assert.equal(f.state.logs.length, 0);
  }
});
test('run and replay preserve one reminder and marker per due cycle, with count-only logs', () => {
  const f = fixture(); assert.equal(f.run('RunReminders').prepared, 2);
  const before = plain({tasks: f.state.tasks, reminders: f.state.reminders});
  assert.equal(f.run('RunReminders').prepared, 0);
  assert.deepEqual({tasks: f.state.tasks, reminders: f.state.reminders}, before);
  assert.doesNotMatch(JSON.stringify(f.state.logs), /sensitive|secret|2026-11-01/);
  f.state.tasks[0].values.dateEcheance = '2026-11-02';
  assert.equal(f.run('RunReminders').prepared, 1); assert.equal(f.state.reminders.length, 3);
  f.state.tasks[0].values.dateEcheance = '2026-11-01';
  assert.equal(f.run('RunReminders').prepared, 0); assert.equal(f.state.reminders.length, 3);
  assert.equal(f.state.tasks[0].values.preparedDue, '2026-11-01');
});
test('failure between reminder and marker rolls back only that task, then replay resumes', () => {
  const f = fixture(3);
  f.state.failSave = (e, _v, key) => e === 'Task' && key.id === '2';
  assert.throws(() => f.run('RunReminders'), {code: 'REMINDER_FAILED', message: 'Operation failed'});
  assert.equal(f.state.reminders.length, 1); assert.equal(f.state.tasks[1].values.preparedDue, null);
  assert.equal(f.state.logs.at(-1).event, 'REMINDER_JOB_FAILED');
  assert.deepEqual(f.state.logs.at(-1).data, {scanned: 1, prepared: 1});
  assert.doesNotMatch(JSON.stringify(f.state.logs), /secret|sensitive|SQL_FIXTURE/);
  f.state.failSave = null; assert.equal(f.run('RunReminders').prepared, 2);
  assert.equal(f.state.reminders.length, 3); assert.equal(f.run('RunReminders').prepared, 0);
});
test('a unique or revision conflict aborts the unit and fresh replay succeeds', () => {
  for (const code of ['ENTITY_UNIQUE_CONFLICT', 'ENTITY_REVISION_CONFLICT']) {
    const f = fixture(1);
    f.state.failSave = (entityName) => {if (entityName === (code.includes('UNIQUE') ? 'Reminder' : 'Task')) throw {code};};
    assert.throws(() => f.run('PrepareReminder', {key: {id: '1'}}), {code});
    assert.equal(f.state.reminders.length, 0); assert.equal(f.state.tasks[0].values.preparedDue, null);
    f.state.failSave = null; assert.equal(f.run('PrepareReminder', {key: {id: '1'}}).prepared, true);
  }
});
test('manual role is server-owned and the manual path shares the worker unit even with scheduling off', () => {
  const f = fixture(1); f.state.enabled = false;
  const input = {key: {id: '1'}, user: 'manager', roles: ['MANAGER'], checkAccess: false};
  for (const roles of [[], ['USER']]) {f.state.roles = roles; assert.throws(() => f.run('PrepareReminderManually', input), {code: 'FORBIDDEN'});}
  assert.equal(f.state.transactions, 0);
  f.state.roles = ['MANAGER']; assert.equal(f.run('PrepareReminderManually', input).preparation.prepared, true);
  f.state.enabled = true; assert.equal(f.run('RunReminders').prepared, 0);
  f.state.tasks[0].values.dateEcheance = '2026-11-02'; f.state.failSave = () => true;
  assert.throws(() => f.run('PrepareReminderManually', input), {code: 'REMINDER_FAILED', message: 'Operation failed'});
});
test('multiple stable pages, pending rows, rereads and explicit cap', () => {
  const f = fixture(401); assert.deepEqual(f.run('RunReminders'), {enabled: true, scanned: 401, prepared: 401, complete: true});
  assert.equal(f.state.reminders.length, 401); assert.equal(f.run('RunReminders').prepared, 0);
  const skipped = fixture(2); skipped.state.beforeRead = (_key, s) => {s.tasks[0].values.statut = 'aJour';};
  assert.equal(skipped.run('RunReminders').prepared, 1);
  const capped = fixture(1001); assert.equal(capped.run('RunReminders').complete, false);
  assert.equal(capped.state.reminders.length, 1000); assert.equal(capped.run('RunReminders').prepared, 0);
});

test('commit failure rolls back both writes; replay repairs an existing reminder without another insert', () => {
  const f = fixture(1); f.state.failCommit = true;
  assert.throws(() => f.run('RunReminders'), {code: 'REMINDER_FAILED'});
  assert.equal(f.state.reminders.length, 0); assert.equal(f.state.tasks[0].values.preparedDue, null);
  f.state.failCommit = false; assert.equal(f.run('RunReminders').prepared, 1);
  f.state.tasks[0].values.preparedDue = null;
  assert.equal(f.run('RunReminders').prepared, 0); assert.equal(f.state.reminders.length, 1);
  assert.equal(f.state.tasks[0].values.preparedDue, '2026-11-01');
});

test('changed guide envelopes stay within summary/drawer budgets through the MCP serializer', () => {
  // Java names are resolved at module load; none of these serializer paths performs I/O.
  const Packages = {java: {io: {}, nio: {file: {}, charset: {}},
    lang: {CharSequence: class {}, System: {getProperty: () => null}}, util: {concurrent: {ConcurrentHashMap: Map}}}};
  const mcp = vm.runInNewContext(read(path.join(__dirname, '../_flow/lib/mcp.js')), {Packages});
  const names = ['entities', 'entities/jobs', 'entities/jobs-runner', 'crud-business/jobs', 'multipage-entities/operations'];
  for (const name of names) {
    const text = read(path.join(__dirname, '../_flow/resources/guide', name + '.md'));
    assert.match(text, /^# [^\n]+\n\n[^\n]{40,}\.\n/);
    const uri = 'flow://guide/' + name;
    const request = {id: 1, method: 'tools/call', params: {name: 'flow-resource-get', arguments: {uri}}};
    const result = mcp.finalizeResponse({scopes: {config: {}}}, request, mcp.jsonRpcResult(1, {
      content: [{type: 'text', text: 'Resource text is in structuredContent.text.'}],
      structuredContent: {ok: true, uri, mimeType: 'text/markdown', source: 'resources/read', text},
    })).result;
    assert.equal(result.structuredContent.text, text);
    assert.equal(result.structuredContent.continuation, undefined);
    const size = JSON.stringify(result).length;
    assert(size < (name.includes('/') ? 12000 : 6000), name + ': ' + size);
    console.log('MCP envelope ' + name + ': ' + size + ' characters');
  }
});
