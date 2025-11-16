// const BASE = 'http://localhost:3001';
const BASE = '';
export async function generate(prompt: string) {
  const r = await fetch(`${BASE}/api/v1/generate`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ prompt }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json() as Promise<{ completion: { text: string }, cacheHit: boolean }>;
}

export function stream(prompt: string, onToken: (t: string) => void) {
  const es = new EventSource(`${BASE}/api/v1/stream?prompt=${encodeURIComponent(prompt)}`);
  es.onmessage = (e) => onToken(e.data);
  es.onerror = () => es.close();
  return () => es.close();
}

export async function health() {
  const r = await fetch(`${BASE}/api/v1/admin/health`);
  return r.json() as Promise<{ status: string; time: number }>;
}
