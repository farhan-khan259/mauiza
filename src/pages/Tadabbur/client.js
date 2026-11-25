import { apiBaseUrl } from '../../utils/api';

export const landingPath = '/live-quran-contemplation';
export const platformPath = landingPath + '/platform';
const hostname = window.location.hostname.toLowerCase();
export const roomApiBase = import.meta.env.VITE_TADABBUR_API_URL ||
  (hostname === 'mauiza.com' || hostname.endsWith('.mauiza.com') ? window.location.origin : apiBaseUrl);
export const peopleOrder = (a, b) => Number(b.raised) - Number(a.raised) ||
  (a.raised && b.raised ? a.raisedAt - b.raisedAt : 0) || a.id.localeCompare(b.id);
const credentialsKey = 'mauiza-live-credentials';

export function storedAuth(id) {
  try {
    const credentials = JSON.parse(localStorage.getItem(credentialsKey) || '{}');
    if (credentials[id]?.auth) return credentials[id].auth;
    const legacy = JSON.parse(localStorage.getItem('mauiza-tadabbur-rooms') || '[]');
    return legacy.find(room => room.id === id)?.auth || '';
  } catch {
    return '';
  }
}

export function remember({ auth, room }) {
  const credentials = JSON.parse(localStorage.getItem(credentialsKey) || '{}');
  credentials[room.id] = { auth, title: room.title };
  const ids = Object.keys(credentials);
  for (const oldId of ids.slice(0, Math.max(0, ids.length - 100))) delete credentials[oldId];
  localStorage.setItem(credentialsKey, JSON.stringify(credentials));
}

export function shareUrl(room) {
  const url = new URL(`${platformPath}/room/${room.id}`, window.location.origin);
  url.hash = 'invite=' + room.invite;
  return url.href;
}

export async function request(path, { auth, method = 'GET', body, signal, keepalive, binary, output } = {}) {
  const headers = {};
  if (auth) headers.Authorization = 'Bearer ' + auth;
  if (binary) headers['Content-Type'] = 'application/octet-stream';
  else if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(new URL('/api/tadabbur' + path, roomApiBase), {
      method, headers, body: binary || (body === undefined ? undefined : JSON.stringify(body)), signal, keepalive,
      cache: 'no-store'
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('The live platform could not connect to the Mauiza API. Check your connection and retry.');
  }
  const type = response.headers.get('content-type') || '';
  if (response.ok && output === 'buffer' && /^(application\/pdf|image\/(png|jpeg|webp))(?:;|$)/i.test(type)) return response.arrayBuffer();
  if (!response.ok && response.status === 413) throw new Error('The server rejected the upload size. Choose a smaller file or ask the site administrator to check the upload limit.');
  const data = type.includes('json') ? await response.json().catch(() => null) : null;
  if (!response.ok || output === 'buffer' || data === null) {
    throw new Error(data?.message || (response.ok ? 'The Mauiza API sent an unexpected response.' : 'The Mauiza API request failed (HTTP ' + response.status + ').'));
  }
  return data;
}

export function plainText(html = '') {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('script,style,sup').forEach(el => el.remove());
  document.querySelectorAll('br').forEach(el => el.replaceWith('\n'));
  document.querySelectorAll('p,h1,h2,h3,h4,li,blockquote').forEach(el => el.append('\n\n'));
  return document.body.textContent.trim();
}

export function safeLink(url) {
  try {
    const target = new URL(url);
    return ['https:', 'http:'].includes(target.protocol) ? target.href : null;
  } catch { return null; }
}

