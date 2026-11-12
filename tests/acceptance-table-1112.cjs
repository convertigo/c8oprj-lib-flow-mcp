// L26F (12/11, it87): with a specification that states its criteria without the walk of the grader, as in the PCA, ML4
// walked the screen at length and still missed a refusal not shown and a save that did not return to the list: the
// rule to walk each criterion at the end was not enough. The agent now writes its acceptance table from the
// specification before building (criterion, path, seen), fills the seen column during the walk and gives the table in
// its final answer: in the start guide, the skills and the proof guide (the acceptance plan of the engine says it too).
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const resources = path.join(__dirname, '../_flow/resources');
const read = file => fs.readFileSync(path.join(resources, file), 'utf8').replace(/\s+/g, ' ');
let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }

check(/An application from a specification first writes its acceptance table \(criterion, path, seen\), then fills it on the screen/.test(read('guide/start.md')),
  'start: the table first');
check(/Before building, write the acceptance table from the specification: one line per criterion that goes through a screen/.test(read('guide/frontend-svelte-proof.md')),
  'proof guide: the table before building');
check(/fill its seen column during the walk/.test(read('guide/frontend-svelte-proof.md')), 'proof guide: filled during the walk');
check(/Before building it, write its acceptance table from the specification \(criterion, path, seen\)/.test(read('skills/convertigo-flow-mcp/SKILL.md')),
  'MCP skill: the table before building');
check(/write the acceptance table \(criterion, path, seen\) from the specification before building/.test(read('skills/convertigo-flow-frontend-svelte/SKILL.md')),
  'frontend skill: the table before building');
console.log(JSON.stringify({ ok: true, checks }));
