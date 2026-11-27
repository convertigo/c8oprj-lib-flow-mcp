const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(path.join(__dirname, '../_flow/resources/guide/authoring/blocks.md'), 'utf8');
test('the guide distinguishes requester errors from MCP tool errors', () => {
  const section = source.split(/^## /m).find(text => text.includes('c8o call') && text.includes('requestable-execute')) ?? '';
  for (const marker of [/requester/i, /\b200\b/, /\berror\b/i, /tool error|isError/i, /--anonymous\b/, /--as\b/]) {
    assert.match(section, marker);
  }
});
