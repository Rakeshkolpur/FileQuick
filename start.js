import { spawn } from 'node:child_process';
import readline from 'node:readline';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let children = [];

const start = (name, args) => {
  const child = spawn(npm, args, { stdio: 'inherit', shell: true });
  child.on('close', (code) => console.log(`[${name}] exited (${code})`));
  return child;
};

const startAll = () => {
  children = [start('frontend', ['run', 'dev']), start('backend', ['run', 'server'])];
};

const stopAll = () => children.forEach((c) => { try { c.kill(); } catch (_) { /* noop */ } });

startAll();

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
rl.on('line', (line) => {
  const cmd = line.trim().toLowerCase();
  if (cmd === 'r' || cmd === 'restart') { stopAll(); setTimeout(startAll, 800); }
  else if (cmd === 'q' || cmd === 'quit' || cmd === 'exit') { stopAll(); process.exit(0); }
  else if (cmd === 'h' || cmd === 'help') console.log('  r = restart   q = quit');
});

process.on('SIGINT', () => { stopAll(); process.exit(0); });
process.on('SIGTERM', () => { stopAll(); process.exit(0); });

console.log('Dev servers starting…  (type "h" for commands)');
