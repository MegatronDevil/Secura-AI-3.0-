// Shared API base resolution for ALL Secura AI frontend HTTP calls.
const envUrl = import.meta.env.VITE_API_BASE_URL;

// If an explicit API URL is provided in the build (VITE_API_BASE_URL), ALWAYS honor it.
// Otherwise, fallback to same-origin for relative reverse proxies or default to localhost.
export const API_BASE_URL: string = envUrl
  ? envUrl.replace(/\/+$/, "")
  : (typeof window !== "undefined" && !window.location.hostname.includes("localhost") && !window.location.hostname.includes("127.0.0.1")
    ? ""
    : "http://127.0.0.1:8000");

export const withBase = (path: string): string => `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
