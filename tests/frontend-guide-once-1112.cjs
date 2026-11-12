// The guide said that `OnMount once={true}` "survives route round trips": an agent loaded the data of a page under
// once, and the page was empty after each return to it (the PCA of 11/11, "My items"). The frontbuilder witness
// (actionChainRegressions.test.ts, "OnMount once does not run again on a new mount") shows what is true: the chain
// is not run again, the State of the page mounted again starts from its initial value. The guide now says that, and
// tells where a page loads its data.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const guide = fs.readFileSync(path.join(__dirname, '../_flow/resources/guide/frontend-svelte-actions.md'), 'utf8')
  .replace(/\s+/g, ' ');
let checks = 0;
function check(condition, message) { checks++; assert.ok(condition, message); }

check(!/once=\{true\}` survives route round trips/.test(guide), 'the guide no longer says that once survives route round trips');
check(/`OnMount once=\{true\}` runs its chain once per load of the application/.test(guide), 'once runs its chain once per application load');
check(/its State starts from its initial value/.test(guide), 'the State of a page mounted again starts empty');
check(/Load the data of a page with a plain `OnMount`/.test(guide), 'a page loads its data with a plain OnMount');
console.log(JSON.stringify({ ok: true, checks }));
