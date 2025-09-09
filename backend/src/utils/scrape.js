import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export async function fetchReadableTextFromUrl(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'FactCheckBot/1.0' } });
  if (!res.ok) throw new Error(`Failed to fetch URL: ${res.status}`);
  const html = await res.text();

  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  const text = article?.textContent?.trim() || '';
  return {
    title: article?.title || dom.window.document.title || '',
    text,
  };
}


