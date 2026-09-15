#!/usr/bin/env node
let input = '';
for await (const chunk of process.stdin) input += chunk;
const name = String(process.argv[2] || '');
const list = JSON.parse(input);
const item = list.find((entry) => entry.name === name);
if (!item) process.exit(2);
const env = item.pm2_env || {};
process.stdout.write([
    item.pid || 0,
    env.status || '',
    env.pm_cwd || '',
    env.pm_exec_path || '',
    env.restart_time || 0
].join('|'));
