// In the PCA of 11/11 the agent had a browser and used it 123 times, but clicked 3 times and typed nothing: it looked
// at its pages and never walked a workflow. The declaration could not be saved from its form, every refusal was silent,
// a list was empty after a return; a person found each of them. The guides asked for "one browser proof" and "one
// compact browser pass". An application built from a specification is now done only when each of its acceptance
// criteria that goes through a screen has been walked; a simple page keeps its single pass.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const resources = path.join(__dirname, '../_flow/resources');
const read = file => fs.readFileSync(path.join(resources, file), 'utf8').replace(/\s+/g, ' ');
const proof = read('guide/frontend-svelte-proof.md');
const entry = read('guide/frontend-svelte.md');
const mcpSkill = read('skills/convertigo-flow-mcp/SKILL.md');
const frontendSkill = read('skills/convertigo-flow-frontend-svelte/SKILL.md');
let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }

// The proof guide: the walk, as a user does it, its refusals and returns, and the report
check(proof.includes('## Application Acceptance'), 'the proof guide has an Application Acceptance section');
check(/each of its acceptance criteria that goes through a screen has been walked in the browser/.test(proof), 'each criterion is walked');
check(/fill the form, submit it, read the result on the screen/.test(proof), 'a form is filled and submitted, its result read');
check(/submit one value the specification refuses: its message must show on the screen/.test(proof), 'a refusal must show');
check(/Leave each list page and come back: the list must show again/.test(proof), 'a list survives a return');
check(/A criterion proved only by a direct Flow call is not proved on the screen/.test(proof), 'a direct call is no screen proof');
check(/criterion, path, what the screen showed/.test(proof), 'the handoff reports each criterion');

// The entry guide, the skills: the single pass stays for a simple page, never for an application with a specification
check(/Application Acceptance/.test(entry), 'the entry guide names the section');
check(/application built from a specification is done only when each acceptance criterion that goes through a screen has been walked/.test(mcpSkill),
  'the MCP skill says when an application is done');
check(/does not replace the acceptance walk of each criterion/.test(frontendSkill), 'the frontend skill keeps the compact pass for a simple page only');
console.log(JSON.stringify({ ok: true, checks }));
