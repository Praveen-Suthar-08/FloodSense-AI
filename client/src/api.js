const base = (import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== '')
  ? import.meta.env.VITE_API_URL
  : '';

export async function api(path, options = {}) {
  const url = base ? `${base}/api${path}` : `/api${path}`;
  const token = localStorage.getItem('floodsense_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const r = await fetch(url, { ...options, headers });
  if (!r.ok) {
    const errBody = await r.json().catch(() => ({}));
    throw Error(errBody.error || `Request failed with status ${r.status}`);
  }
  return r.status === 204 ? null : r.json();
}

export { base };
