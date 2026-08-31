import axios from 'axios';

// Dev: falls back to the Flask server on :5000
// Prod: set VITE_API_URL in the environment
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const api = axios.create({ baseURL: API_BASE_URL });

export async function checkServerHealth() {
  try {
    const res = await api.get('/health', { timeout: 4000 });
    return res.status === 200;
  } catch (_) {
    return false;
  }
}
