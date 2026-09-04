/* Build the web app for the Electron shell: ELECTRON=1 gives Vite a relative
 * base so assets resolve over file://. Output still goes to dist/. */
import { execSync } from 'node:child_process';

process.env.ELECTRON = '1';
execSync('npx vite build', { stdio: 'inherit', env: process.env });
