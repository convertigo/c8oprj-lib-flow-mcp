// The guide of the business Flows of the entity widgets says what the widgets do: they call each Flow over HTTP, as
// the gateway, so the Flow is hidden or public, never private (the default without accessibility), with a required
// session and object inputs (21/11, L34F: an agent read the hidden advice as the cause of an HTTP failure).
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const guide=fs.readFileSync(path.join(root,'_flow/resources/guide/entities/widgets/flows.md'),'utf8');
const flat=guide.replace(/\s+/g,' ');
test('the flows guide says the widget calls each Flow over HTTP, hidden or public, never private',()=>{
 assert.match(flat,/The widget calls each Flow over HTTP from the browser, as it calls the gateway: `POST \/projects\/<project>\/\.json\?__sequence=<Flow>`/);
 assert.match(flat,/each Flow is `hidden` \(callable over HTTP, not listed\) or `public`, never `private`/);
 assert.match(flat,/a `private` Flow, the default without `accessibility`, answers that call from a non-administrator session as an unknown requestable/);
 assert.match(flat,/`code-run` and `requestable-execute` also run `private` Flows: prove the call from the page/);
});
test('the flows guide example declares hidden, a required session and an object options input',()=>{
 const example=/```javascript\n([\s\S]*?)```/.exec(guide);
 assert.ok(example,'an example');
 assert.match(example[1],/accessibility: "hidden"/);
 assert.match(example[1],/authenticatedContextRequired: true/);
 assert.match(example[1],/inputs: \{ options: \{ type: "object", default: \{\} \} \}/);
 assert.match(example[1],/entity\.list\(\{ entity: "Dossier", checkAccess: true, options: input\.options \}\)/);
});
test('the HTTP call of the guide is the one of the entity transport',{skip:!fs.existsSync(path.join(root,'../lib_flow_entity'))},()=>{
 const transport=fs.readFileSync(path.join(root,'../lib_flow_entity/_flow/frontbuilder/svelte/components/entity/entity-transport.js'),'utf8');
 assert.match(transport,/export function entityFlowRequest[\s\S]*?return callProjectFlow\(/);
 assert.match(transport,/export function entityRequest[\s\S]*?return callProjectFlow\('EntityGateway'/);
});
