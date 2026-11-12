// In the PCA of 11/11 the application of the agent had an entity gateway no page called, whose policy opened reads and
// writes without a scope for the non-ADMIN role (one person read and wrote the rows of another), a daily job and a
// demo reset any anonymous caller could run, and a notification HTML built by concatenation. The security review of
// 12/11 (00h13) asked for these rules in the guides; each one is stated where an agent reads it.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const guide = name => fs.readFileSync(path.join(__dirname, '../_flow/resources/guide', name + '.md'), 'utf8').replace(/\s+/g, ' ');
const policy = guide('entities-policy');
const access = guide('multipage-entities-access');
const pages = guide('multipage-entities-pages');
const data = guide('authoring-data');
let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }

// The gateway: (a) only for a page that calls it, (b) no check of the facades, a scope per non-ADMIN role, (c) an allow-list
check(/Set `gateway: true` only when a page uses EntityTable or EntityForm/.test(policy), '(a) a gateway only for its pages');
check(/The gateway inherits no check of the facades/.test(policy), '(b) the facades do not protect the gateway');
check(/gets a `scope` from the policy for every role but ADMIN, or is `Possédé`/.test(policy), '(b) a scope per non-ADMIN role');
check(/allow-list per entity, operation and role, refused by default/.test(policy), '(c) an allow-list');
check(/`delete`, and writes to a journal or a notification entity/.test(policy), '(c) delete, journal, notification refused by default');
// The demo reset and the manual run of a job are guarded by the ADMIN role, never by a symbol alone
check(/`demoReset` requires the ADMIN role, even in demo mode/.test(access), 'demoReset requires ADMIN');
check(/A manual run of a job for the ADMIN is a separate hidden Flow that checks the ADMIN role/.test(pages), 'a manual run checks ADMIN');
check(/never make the job itself public or hidden/.test(pages), 'the job stays private');
// An email body never concatenates values
check(/Never concatenate values into `html`/.test(data), 'no concatenation into an email html');
console.log(JSON.stringify({ ok: true, checks }));
