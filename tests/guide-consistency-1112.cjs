// A read-only review of the texts of kit it36 (Astra, 12/11: experts/flow/consultations/2026-11-12-astra-relecture-kit-it36.md)
// found statements the code contradicts, contradictions between guides and speed rules that cut a verification short.
// Each one is checked here: the wrong statement is gone, the right one lives in one place.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const resources = path.join(__dirname, '../_flow/resources');
const read = file => fs.readFileSync(path.join(resources, file), 'utf8').replace(/\s+/g, ' ');
const guides = fs.readdirSync(path.join(resources, 'guide')).filter(n => n.endsWith('.md')).map(n => [n, read('guide/' + n)]);
const skills = fs.readdirSync(path.join(resources, 'skills')).map(n => [n, read('skills/' + n + '/SKILL.md')]);
const mcp = fs.readFileSync(path.join(__dirname, '../_flow/lib/mcp.js'), 'utf8');
let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }
const none = (texts, pattern) => texts.filter(([, t]) => pattern.test(t)).map(([n]) => n);

// 1. once keeps no state: no guide asks for it to keep a state over a route round trip
check(none(guides, /once=\{true\}` only for bootstrap state that must survive/).length === 0, 'paperboard: once never keeps a state');
check(/load the state of a page on every mount/i.test(read('guide/fullstack-paperboard.md')), 'paperboard: load page state on every mount');
// 2. a call configuration merges as the others (project-config-service.js mergeConfig)
check(!/a call config replaces whole root branches/.test(read('guide/tags.md')), 'tags: no branch replacement');
check(/A call configuration merges by the same rules/.test(read('guide/tags.md')), 'tags: same merge rules');
// 4. the output of a portable block is $$out, never target (frontDocument.ts refuses target)
check(!/Set `target` only to an existing `page\.name`/.test(read('guide/portable-blocks.md')), 'portable blocks: no target');
check(/To write an existing State, use `\$\$out="page\.name"`/.test(read('guide/portable-blocks.md')), 'portable blocks: $$out');
// 6. a typed collection may be assigned (json.array, json.map contracts, parser)
check(!/Create them with `path:` \(not with an assignment\)/.test(read('guide/authoring.md')), 'authoring: assignment allowed');
check(/or assign the call \(it gives the `path`\)/.test(read('guide/authoring.md')), 'authoring: assignment gives the path');
// 7. the browser tools are those of the host: their own schema, never a signature imposed by Flow
check(!/no `ref` argument/.test(read('skills/convertigo-flow-mcp/SKILL.md')), 'skill: no imposed browser signature');
check(/Read the schema of the browser tools of your host and use its argument names/.test(read('skills/convertigo-flow-mcp/SKILL.md')), 'skill: host schema');
check(!/browser_click \{element, ref\}/.test(mcp), 'mcp: no imposed browser signature');
// 8. a mock is allowed while building, never at delivery without the agreement of the user
check(!/mock acceptable but explicit;/.test(read('guide/fullstack-paperboard.md')), 'paperboard: no mock at delivery');
check(/replace every mock the request needs before delivery, unless the user accepts it/.test(read('guide/fullstack-paperboard.md')), 'paperboard: mocks replaced before delivery');
// 9. a source that already does what is asked still has its visible behavior verified
check(none(guides.concat(skills), /satisfies the request, stop and answer|proves the request is already satisfied, stop/).length === 0, 'no stop without verification');
check(/verify the visible behavior asked that is not observed yet/.test(read('guide/frontend-svelte.md')), 'frontend: verify before answering');
// 10. no count of repairs ends a walk that still fails
check(none(guides, /Stop after at most two focused repairs|the two allowed focused repair passes|allow one focused browser diagnostic instead/).length === 0, 'no repair quota');
check(/keep each diagnostic on a failed path, and go on while a fix resolves an identified failure/i.test(read('guide/frontend-svelte-proof.md')), 'proof: go on while a fix resolves a failure');
// 11. a run that ends ok is no acceptance
check(!/Saved Flow passed\. Stop unless|run\/test passed\. Stop unless/.test(mcp), 'mcp: ok is no verdict');
check(/Execution completed\. Compare the result with the expected outcome/.test(mcp), 'mcp: compare with the expected outcome');
// 5. the marker of a FullSync reset is the last one applied, no one-time value (generateSvelteProject.ts, resetGuard)
check(!/runs once per browser and marker value/.test(read('guide/fullsync.md')), 'fullsync: no once per marker value');
check(/skipped while it is the last marker this browser applied/.test(read('guide/fullsync.md')), 'fullsync: the last marker applied');
console.log(JSON.stringify({ ok: true, checks }));
