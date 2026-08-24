const { spawn } = require('child_process');
const path = require('path');

// Run this using Anchor's built-in mechanism
const args = ['run', '--provider.cluster', 'devnet', '--script', 'init-treasury.ts'];

const child = spawn('npx', ['anchor', ...args], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
});

child.on('close', (code) => {
  process.exit(code);
});
