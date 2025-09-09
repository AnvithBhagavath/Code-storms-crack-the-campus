import { fetchReadableTextFromUrl } from '../utils/scrape.js';
import { generateFactCheck } from '../utils/openai.js';

export async function factCheck({ text, url }) {
  if (!text && !url) {
    throw new Error('Provide either text or url');
  }

  let sourceText = '';
  let citations = [];

  if (url) {
    try {
      const { title, text: extracted } = await fetchReadableTextFromUrl(url);
      sourceText = `${title}\n\n${extracted}`.trim();
      citations.push(url);
    } catch (err) {
      sourceText = '';
    }
  }

  const claimText = text || `Facts inferred from: ${url}`;
  const result = await generateFactCheck({ claimText, sourceText });

  return { ...result, citations: Array.from(new Set([...(result.citations || []), ...citations])) };
}


