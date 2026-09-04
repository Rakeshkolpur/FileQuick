/* Dev runner: start Vite on a fixed port, wait for it, then launch Electron
 * pointed at it. Ctrl-C or closing the window stops both. */
import { spawn } from 'node:child_process';
import net from 'node:net';

const PORT = 5173;
const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'inherit', shell: true });

const stopAll = (code = 0) => { try { vite.kill(); } catch { /* */ } process.exit(code); };
process.on('SIGINT', () => stopAll(0));
process.on('SIGTERM', () => stopAll(0));
vite.on('exit', (c) => stopAll(c ?? 0));

const waitForPort = () => new Promise((resolve) => {
  const tick = setInterval(() => {
    const sock = net.connect(PORT, '127.0.0.1');
    sock.on('connect', () => { sock.destroy(); clearInterval(tick); resolve(); });
    sock.on('error', () => sock.destroy());
  }, 300);
});

await waitForPort();
const electron = spawn('npx', ['electron', '.'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, VITE_DEV_SERVER_URL: `http://localhost:${PORT}` },
});
electron.on('exit', (c) => stopAll(c ?? 0));
