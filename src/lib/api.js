import axios from 'axios';
import { isDesktop } from './desktop';

// The desktop app runs its own bundled conversion engine on 127.0.0.1:5000
// (spawned by electron/main.cjs). Local `npm run dev` also expects a local
// Flask server. The live website talks to the deployed conversion server.
// Override any of this with VITE_API_URL.
export const API_BASE_URL =
  import.meta.env.VITE_API_URL
  || (isDesktop() || import.meta.env.DEV ? 'http://localhost:5000' : 'https://api.filequik.in');

export const api = axios.create({ baseURL: API_BASE_URL });

export async function checkServerHealth() {
  try {
    const res = await api.get('/health', { timeout: 4000 });
    return res.status === 200;
  } catch (_) {
    return false;
  }
}
