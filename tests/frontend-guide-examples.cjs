const { execFileSync } = require('node:child_process');
const { resolve } = require('node:path');
const provider = process.env.FLOW_FRONTBUILDER_RESOURCE_ROOT;
if (!provider) throw new Error('FLOW_FRONTBUILDER_RESOURCE_ROOT must point to the Svelte provider for guide example tests');
execFileSync(process.execPath, [resolve(provider, 'node_modules/tsx/dist/cli.mjs'), '--test',
  resolve(__dirname, 'support/frontend-guide-examples.mts')], { stdio: 'inherit' });
