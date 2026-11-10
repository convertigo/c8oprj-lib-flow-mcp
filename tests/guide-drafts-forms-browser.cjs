'use strict';
// The guides give the recovery of a test draft and of unsaved Studio work, the form of a date field starting on today
// and of a message from an action chain, and the call form of the Playwright tools, each as one rule.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8').replace(/\s+/g, ' ');

const rules = read('_flow/resources/guide/start-rules.md');
assert.match(rules, /A test Flow never promoted is only a working copy: `code-discard\(\{project,name\}\)` deletes it; `flow-object-remove` deletes saved objects only\./,
  'a test draft is deleted with code-discard');
assert.match(rules, /`PROJECT_HAS_UNSAVED_CHANGES`, retry with `saveProject:false` and ask for \*\*Save project\*\*/,
  'unsaved Studio changes: saveProject:false, then Save project');
assert.match(rules, /`SOURCE_WORKING_COPY`, edit that file with `code-get`\/`code-set`, or `code-discard\(\{project,sourceFile\}\)` first/,
  'a source with a working copy is changed through the code tools');

const forms = read('_flow/resources/guide/frontend-svelte-forms.md');
assert.match(forms, /<DateToday \$\$id="today" \$\$out="page\.day" \/>` in the page `OnMount` and `<DatePicker value="@page\.day" \/>`/,
  'a date field starts on today through $$out');
assert.match(forms, /`target` is for `SetValue`, `UpdateList` and `UpdateNumber` only/, 'target belongs to the state actions');
assert.match(forms, /`Status` is a widget, not an action: the `Then`\/`Else` of an `If` in `Actions` set a message State \(`SetValue target="page\.message"`\)/,
  'a message from a chain goes through a State');
assert.match(forms, /<Status actionId="save" successText="Saved\." \/>` beside the form/, 'Status stands in the page');

const skill = read('_flow/resources/skills/convertigo-flow-mcp/SKILL.md');
assert.match(skill, /`browser_click\(\{ element: "Save button", target: "e4" \}\)`/, 'browser_click takes target');
assert.match(skill, /`browser_type\(\{ element: "Name field", target: "e3", text: "Ada" \}\)`/, 'browser_type takes target and text');
assert.match(skill, /`target` is the `\[ref=e4\]` of the latest `browser_snapshot` \(no `ref` argument, never `null`\); on `Ref \.\.\. not found`, take a new snapshot\./,
  'target comes from the latest snapshot');
console.log('guide-drafts-forms-browser OK');
