// Dynamic API configuration based on current hostname
// This allows the dashboard to work from both localhost and remote network access

const API_PORT = 4000;
const hostname = window.location.hostname;

// Use current hostname (localhost when local, IP when remote)
export const API_BASE_URL = `http://${hostname}:${API_PORT}`;
export const WS_BASE_URL = `ws://${hostname}:${API_PORT}`;

// Full URLs
export const API_STREAM_URL = `${WS_BASE_URL}/stream`;
export const API_EVENTS_URL = `${API_BASE_URL}/events`;
export const API_THEMES_URL = `${API_BASE_URL}/api/themes`;
export const API_KAI_CONTEXT_URL = `${API_BASE_URL}/api/kai/context`;
export const API_HAIKU_URL = `${API_BASE_URL}/api/haiku/summarize`;
export const API_ACTIVITIES_URL = `${API_BASE_URL}/api/activities`;
export const API_TOKEN_USAGE_URL = `${API_BASE_URL}/api/token-usage`;
