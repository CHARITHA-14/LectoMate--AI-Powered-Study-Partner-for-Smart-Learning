// Central API base URL -- set VITE_API_URL in your .env or hosting environment
// Falls back to localhost for local development
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
export const API = `${API_BASE_URL}/api`;
