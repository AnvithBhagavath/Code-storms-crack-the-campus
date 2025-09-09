import { fetchReadableTextFromUrl } from '../utils/scrape.js';
import { generateFactCheck, analyzeImageEvidence, summarizeSourceText } from '../utils/openai.js';
import { fetchCorroboratingEvidence } from '../utils/corroborate.js';
import { cacheGet, cacheSet } from '../utils/cache.js';
import { persistedGet, persistedSet } from '../utils/persistedCache.js';
import { fetchGoogleFactChecks } from '../utils/factchecktools.js';

export async function factCheck({ text, url }) {
  if (!text && !url) {
    throw new Error('Provide either text or url');
  }

  let sourceText = '';
  let citations = [];
  let description = '';
  let image = '';
  let imageInsight = '';
  let sourceTitle = '';
  let canonicalUrl = '';

  if (url) {
    // Persistent cache by URL: return exact same result if previously computed
    const persisted = persistedGet(url);
    if (persisted) {
      return persisted;
    }
    try {
      const { title, text: extracted, description: metaDesc, image: metaImage, canonical } = await fetchReadableTextFromUrl(url);
      sourceText = `${title}\n\n${extracted}`.trim();
      citations.push(url);
      description = metaDesc || '';
      image = metaImage || '';
      sourceTitle = title || '';
      canonicalUrl = canonical || '';
    } catch (err) {
      sourceText = '';
    }
  }

  let claimText = text;
  if (!claimText) {
    // Try to infer a concise claim from the source text
    const preview = sourceText.split(/\n+/).filter(Boolean).slice(0, 6).join(' ').slice(0, 600);
    claimText = preview || `Content from ${url}`;
  }
  // Prefer description as the user-facing claim if present
  const claimForModel = description || claimText;
  // If we have an image but little/no text, analyze the image to extract cues
  if (image && (!sourceText || sourceText.length < 200)) {
    try {
      const ai = await analyzeImageEvidence({ imageUrl: image, claimText: description || claimText });
      imageInsight = ai.imageInsight || '';
    } catch {}
  }

  // Check cache for stability
  const cacheKey = JSON.stringify({ claimForModel, sourceTextFingerprint: sourceText.slice(0, 1000), image: Boolean(image) });
  const cached = cacheGet(cacheKey);
  if (cached) {
    return cached;
  }

  let result = await generateFactCheck({ claimText: claimForModel, sourceText, extraEvidenceText: imageInsight });

  const verdictLower = String(result?.verdict || '').toLowerCase();
  if (verdictLower.includes('mixed') || verdictLower.includes('unverifiable')) {
    const [wikiEv, gfcEv] = await Promise.all([
      fetchCorroboratingEvidence(claimForModel),
      fetchGoogleFactChecks(claimForModel)
    ]);
    const mergedText = [wikiEv.text, gfcEv.text].filter(Boolean).join('\n\n');
    const mergedCites = Array.from(new Set([...(wikiEv.citations||[]), ...(gfcEv.citations||[])]));
    if (mergedText) {
      const rerun = await generateFactCheck({ claimText: claimForModel, sourceText, extraEvidenceText: `${imageInsight}\n\n${mergedText}` });
      result = {
        ...rerun,
        citations: Array.from(new Set([...(rerun.citations || []), ...mergedCites]))
      };
    }
  }

  // Optional: summarize source for UI
  let summaryPoints = [];
  try {
    if (sourceText && sourceText.length > 300) {
      const sum = await summarizeSourceText({ sourceText });
      summaryPoints = Array.isArray(sum.summaryPoints) ? sum.summaryPoints : [];
    }
  } catch {}

  // Fallback confidence if missing
  const computedConfidence = (() => {
    const v = String(result?.verdict || '').toLowerCase();
    if (Number.isFinite(result?.confidence)) return result.confidence;
    if (v.includes('true')) return v.includes('mostly') ? 85 : 95;
    if (v.includes('false')) return v.includes('mostly') ? 65 : 40;
    if (v.includes('mixed')) return 60;
    return 55;
  })();

  const payload = { description, image, imageInsight, sourceTitle, canonicalUrl, summaryPoints, ...result, confidence: computedConfidence, citations: Array.from(new Set([...(result.citations || []), ...citations])) };
  cacheSet(cacheKey, payload, 10 * 60 * 1000);
  if (url) persistedSet(url, payload);
  return payload;
}


