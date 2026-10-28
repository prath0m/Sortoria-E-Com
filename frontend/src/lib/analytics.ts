/** Anonymous, cookie-free page-view beacon. Feeds visits (conversion) and trending products. */

const KEY = 'sartoria-session';

function sessionId(): string {
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return 'anonymous-session';
  }
}

export function track(path: string, extra: { product_id?: number } = {}) {
  if (typeof navigator === 'undefined' || path.startsWith('/admin-panel')) return;
  const body = JSON.stringify({ session_id: sessionId(), path, referrer: document.referrer.slice(0, 300), ...extra });
  const url = '/api/v1/analytics/events/';
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'application/json' }))) return;
  } catch {
    /* fall back to fetch */
  }
  fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => undefined);
}
