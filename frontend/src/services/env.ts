// Shared API base resolution for ALL Secura AI frontend HTTP calls.
// On non-localhost devices (such as mobile phones accessing via Cloudflare tunnels or remote IPs),
// ALWAYS use same-origin relative paths ("") so the browser calls the same host that served the page.
const envUrl = import.meta.env.VITE_API_BASE_URL;
export const API_BASE_URL: string =
  typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")
    ? ""
    : (envUrl || "");

export const withBase = (path: string): string => `${API_BASE_URL}${path}`;
