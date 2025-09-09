import fetch from 'node-fetch';

async function searchWikipediaTitles(query, limit = 3) {
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: String(limit),
    format: 'json',
    utf8: '1',
    origin: '*'
  });
  const url = `https://en.wikipedia.org/w/api.php?${params.toString()}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'FactCheckBot/1.0' } });
  if (!res.ok) return [];
  const data = await res.json();
  const results = data?.query?.search || [];
  return results.map(r => r.title).slice(0, limit);
}

async function fetchWikipediaSummary(title) {
  const encoded = encodeURIComponent(title);
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'FactCheckBot/1.0' } });
  if (!res.ok) return null;
  const data = await res.json();
  const extract = (data?.extract || '').trim();
  const pageUrl = data?.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encoded}`;
  return { title: data?.title || title, extract, url: pageUrl };
}

export async function fetchCorroboratingEvidence(query) {
  try {
    const titles = await searchWikipediaTitles(query, 3);
    const summaries = await Promise.all(titles.map(fetchWikipediaSummary));
    const filtered = summaries.filter(Boolean);
    const text = filtered.map(s => `${s.title}\n${s.extract}`).join('\n\n');
    const citations = filtered.map(s => s.url);
    return { text, citations };
  } catch {
    return { text: '', citations: [] };
  }
}


