// Run only against an owned disposable runtime/project. Credentials stay in memory.
// MCP_SDK_ROOT=<installed @modelcontextprotocol/sdk> TAGS_TEST_BASE_URL=<loopback /convertigo>
// TAGS_TEST_PROJECT=<disposable Flow project with named configs> node tests/tags-http-contract.mjs
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const base = new URL(process.env.TAGS_TEST_BASE_URL || '');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use an owned loopback runtime');
const project = process.env.TAGS_TEST_PROJECT;
const proofFlow = process.env.TAGS_TEST_CONFIG_PROOF_FLOW;
const proofValues = proofFlow ? JSON.parse(process.env.TAGS_TEST_CONFIG_PROOF_VALUES || '[]') : [];
assert(project && process.env.MCP_SDK_ROOT, 'Explicit disposable project and SDK installation required');
const { Client } = await import(pathToFileURL(path.join(process.env.MCP_SDK_ROOT, 'dist/esm/client/index.js')));
const { StreamableHTTPClientTransport } = await import(pathToFileURL(path.join(process.env.MCP_SDK_ROOT, 'dist/esm/client/streamableHttp.js')));
const cookies = new Map();
// Reuse an unprivileged engine session; it is separate from the setup login.
const mcpCookies = new Map();
let xsrf = 'Fetch';
let token = '';
let stage = 'authenticate';
let checks = 0;
const clients = [];
const createdIds = [];
const endpoint = suffix => new URL(base.href.replace(/\/$/, '') + suffix);
const check = (condition, message) => { checks++; assert(condition, message); };

function find(value, predicate) {
  if (!value || typeof value !== 'object') return undefined;
  if (predicate(value)) return value;
  for (const child of Object.values(value)) {
    const found = find(child, predicate);
    if (found) return found;
  }
}

async function adminPost(suffix, args) {
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded', 'X-XSRF-TOKEN': xsrf };
  if (cookies.size) headers.Cookie = [...cookies].map(([key, value]) => `${key}=${value}`).join('; ');
  const response = await fetch(endpoint(suffix), {
    method: 'POST', headers, body: new URLSearchParams(args), signal: AbortSignal.timeout(60000)
  });
  for (const cookie of response.headers.getSetCookie()) {
    const [name, ...parts] = cookie.split(';')[0].split('=');
    cookies.set(name, parts.join('='));
  }
  xsrf = response.headers.get('X-XSRF-TOKEN') || xsrf;
  check(response.ok, `Administrative fixture setup failed: HTTP ${response.status}`);
  return response.text();
}

async function connect(suffix, bearer) {
  const client = new Client({name:'tags-contract', version:'1.0.0'});
  clients.push(client);
  await client.connect(new StreamableHTTPClientTransport(endpoint(suffix), {
    requestInit: {headers: bearer ? {Authorization:`Bearer ${bearer}`} : {}},
    fetch: async (url, init) => {
      const headers = new Headers(init.headers);
      if (mcpCookies.size) headers.set('Cookie', [...mcpCookies].map(([key,value]) => `${key}=${value}`).join('; '));
      const response = await fetch(url, {...init,headers});
      for (const cookie of response.headers.getSetCookie()) {
        const [name,...parts] = cookie.split(';')[0].split('=');
        mcpCookies.set(name,parts.join('='));
      }
      return response;
    }
  }), {timeout:60000});
  return client;
}

async function catalogue(client) {
  let cursor;
  const tools = [];
  do {
    const page = await client.listTools(cursor ? {cursor} : {}, {timeout:60000});
    tools.push(...page.tools);
    cursor = page.nextCursor;
  } while (cursor);
  for (const name of ['tags-get','tags-apply']) {
    const tool = tools.find(item => item.name === name);
    check(tool && tool.inputSchema.properties.scope, `${name} missing from live catalogue`);
    check(!tool.inputSchema.properties.request && !tool.inputSchema.properties.out, 'Protocol internals leaked');
  }
  return tools.length;
}

async function listEntries(client, method, key) {
  const entries = [];
  let cursor;
  do {
    const page = await client[method](cursor ? {cursor} : {}, {timeout:60000});
    entries.push(...page[key]);
    cursor = page.nextCursor;
  } while (cursor);
  return entries;
}

async function call(client, name, args) {
  const response = await client.callTool({name,arguments:args}, undefined, {timeout:60000});
  if (response.isError) throw new Error(`Tool ${name} returned an error: ${response.content?.[0]?.text || 'unknown'}`);
  if (response.structuredContent) return response.structuredContent;
  for (const content of response.content || []) {
    if (content.type === 'text') {
      try { return JSON.parse(content.text); } catch { /* ordinary non-JSON guidance */ }
    }
  }
  throw new Error(`Tool ${name} returned no JSON result`);
}

async function get(client) {
  const response = await call(client, 'tags-get', {scope:'projectObjects',project});
  const snapshot = find(response, value => typeof value.revision === 'string' && value.tags && value.assignments);
  check(snapshot, 'Missing tag snapshot');
  return snapshot;
}

async function apply(client, action, input, revision) {
  const response = await call(client, 'tags-apply', {
    scope:'projectObjects',project,revision:revision || (await get(client)).revision,action,input
  });
  const snapshot = find(response, value => typeof value.revision === 'string' && value.tags && value.assignments);
  check(snapshot?.done === true, 'Tag command did not complete');
  return snapshot;
}

async function rejected(client, action, input, revision, reason) {
  let message = '';
  try { await apply(client, action, input, revision); }
  catch (error) { message = String(error.message); }
  check(message.toLowerCase().includes(reason.toLowerCase()), `Expected ${reason} rejection`);
}

let legacy;
let summary;
try {
  const authenticated = await adminPost('/admin/services/engine.Authenticate', {
    authType:'login',authUserName:process.env.TAGS_TEST_ADMIN || 'admin',authPassword:process.env.TAGS_TEST_PASSWORD || 'admin'
  });
  check(authenticated.includes('<authenticated>true</authenticated>'), 'Fixture administrator not authenticated');
  const issued = JSON.parse(await adminPost('/projects/lib_ConvertigoMCP/.json', {
    __project:'lib_ConvertigoMCP',__sequence:'McpManagedTokenCreate',label:'Disposable tags contract',ttlSeconds:'300'
  }));
  const credentials = find(issued, value => value.status === 'ok' && typeof value.token === 'string');
  const issuanceError = find(issued, value => typeof value.message === 'string');
  check(credentials, 'No short-lived fixture token' + (issuanceError ? `: ${issuanceError.message}` : ''));
  token = credentials.token;
  // Subsequent MCP requests carry only the bearer, never the administrator cookie.
  await adminPost('/admin/services/engine.Authenticate', {authType:'logout'});
  cookies.clear();
  stage = 'anonymous rejection';
  let denied = false;
  let denialMessage = '';
  try { await connect('/api/flow-mcp'); } catch (error) { denialMessage = String(error); denied = /401|unauthorized|bearer token is required/i.test(denialMessage); }
  check(denied, `Anonymous Flow MCP request was not refused: ${denialMessage}`);
  try { await connect('/api/mcp'); denied = false; } catch (error) { denied = /401|unauthorized|bearer token.*required/i.test(String(error)); }
  check(denied, 'Anonymous legacy MCP request was not refused');
  stage = 'live catalogues';
  legacy = await connect('/api/mcp', token);
  const flow = await connect('/api/flow-mcp', token);
  const legacyTools = await catalogue(legacy);
  const flowTools = await catalogue(flow);
  const legacyResources = (await listEntries(legacy,'listResources','resources')).length;
  const legacyPrompts = (await listEntries(legacy,'listPrompts','prompts')).length;
  const flowResources = await listEntries(flow,'listResources','resources');
  check(flowResources.some(resource => resource.uri === 'flow://guide/tags'), 'Tag guide missing from live resources');
  stage = 'Flow configuration contribution';
  await call(legacy, 'databaseobject-tree-get', {target:project,childrenDepth:0,properties:'none'});
  const initial = await get(flow);
  const target = proofFlow ? initial.targets.find(value => value === `${project}.sq:${proofFlow}`) : initial.targets[0];
  const configs = initial.contributions?.flow?.fields?.configs?.items?.enum;
  check(target && Array.isArray(configs) && configs.length, 'Missing typed named-configuration contribution');
  const first = await apply(flow, 'create', {definition:{
    label:'Disposable MCP tag',presentation:{color:'#3366CC'},metadata:{flow:{configs:[configs[0]]}}
  }});
  createdIds.push(first.id);
  const visible = await get(legacy);
  check(visible.tags[first.id]?.label === 'Disposable MCP tag', 'Legacy JSON lost UUID tag keys');
  check(visible.tags[first.id].metadata.flow.configs[0] === configs[0], 'Named configuration was lost');
  check(visible.dirty === true && visible.revision === first.revision, 'MCP adapters do not share the draft');
  const secondDefinition = {label:'Disposable second tag'};
  if (proofFlow) {
    check(configs.length >= 2 && proofValues.length === 2, 'Two named configurations and proof values required');
    secondDefinition.metadata = {flow:{configs:[configs[1]]}};
  }
  const second = await apply(legacy, 'create', {definition:secondDefinition});
  createdIds.push(second.id);
  stage = 'ordering and validation';
  const originalOrder = initial.assignments[target] || [];
  const assigned = await apply(legacy, 'assign', {targets:[target],tagIds:[second.id,first.id]});
  check(JSON.stringify(assigned.assignments[target]) === JSON.stringify([...originalOrder,second.id,first.id]), 'Legacy assignment order changed');
  async function prove(expected) {
    const run = await call(flow, 'code-run', {project,qname:`${project}.${proofFlow}`,includeTrace:false});
    check(run.ok === true && JSON.stringify(run.result.baserow) === JSON.stringify(expected), 'Runtime did not use ordered draft tag configurations');
  }
  if (proofFlow) await prove(proofValues[0]);
  const reordered = await apply(flow, 'reorder', {targets:[target],tagIds:[...originalOrder,first.id,second.id]});
  check(JSON.stringify((await get(legacy)).assignments[target]) === JSON.stringify(reordered.assignments[target]), 'Reorder not shared');
  if (proofFlow) await prove(proofValues[1]);
  await rejected(legacy, 'create', {definition:{label:'Stale'}}, initial.revision, 'revision');
  await rejected(flow, 'create', {definition:{label:'Invalid config',metadata:{flow:{configs:['MissingDisposableConfig']}}}}, reordered.revision, 'Invalid metadata');
  check((await get(flow)).revision === reordered.revision, 'Refused command changed draft');
  stage = 'explicit Save and Reload';
  const saved = await call(legacy, 'project-save', {project});
  check(find(saved, value => value.saved === true), 'Explicit Save failed');
  check(!(await get(flow)).dirty, 'Save did not clean the draft');
  const updatedDefinition = {...(await get(flow)).tags[first.id],label:'Unsaved label'};
  await apply(flow, 'update', {id:first.id,definition:updatedDefinition});
  const reload = await call(legacy, 'project-reload', {project});
  check(find(reload, value => value.reloaded === true), `Explicit Reload failed: ${JSON.stringify(reload)}`);
  const reloaded = await get(flow);
  check(reloaded.tags[first.id]?.label === 'Disposable MCP tag' && !reloaded.dirty, 'Reload failed to discard unsaved tags');
  stage = 'workspace snapshot';
  const local = await call(flow, 'tags-get', {scope:'workspaceProjects',referenceProject:project});
  check(local.membershipOrder === 'explicit' && local.referenceTargets?.includes(project), 'Workspace reference preview missing');
  summary = {ok:true,checks,legacyVersion:legacy.getServerVersion().version,flowVersion:flow.getServerVersion().version,
    legacyTools,flowTools,legacyResources,legacyPrompts,adminSession:false,configContribution:true,runtimeProof:!!proofFlow};
} catch (error) {
  const message = String(error.message).replaceAll(token || '__no_secret__', '[redacted]');
  console.error(JSON.stringify({ok:false,stage,checks,message:message.slice(0,2000)}));
  process.exitCode = 1;
} finally {
  if (legacy && createdIds.length) {
    try {
      for (const id of createdIds) {
        const snapshot = await get(legacy);
        const memberCount = Object.values(snapshot.assignments).filter(ids => ids.includes(id)).length;
        await apply(legacy, 'delete', {id,confirmed:true,memberCount}, snapshot.revision);
      }
      await call(legacy, 'project-save', {project});
    } catch { console.error('Disposable tag cleanup failed; inspect the owned test project.'); process.exitCode = 1; }
  }
  await Promise.allSettled(clients.map(client => client.close()));
  token = '';
}
if (summary && process.exitCode !== 1) console.log(JSON.stringify(summary));
