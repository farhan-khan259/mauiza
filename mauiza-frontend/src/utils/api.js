export const apiBaseUrl = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, "");

export function apiUrl(path) {
  return `${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}
