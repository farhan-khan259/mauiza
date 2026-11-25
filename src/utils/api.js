const hostname = window.location.hostname.toLowerCase();
const defaultApiUrl = hostname === "mauiza.com" || hostname.endsWith(".mauiza.com")
  ? "https://mauiza-backend.onrender.com"
  : window.location.origin;

export const apiBaseUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, "");

export function apiUrl(path) {
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
