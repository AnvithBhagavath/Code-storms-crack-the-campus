import { fetchReadableTextFromUrl } from '../utils/scrape.js';
import { generateFactCheck, analyzeImageEvidence } from '../utils/openai.js';
import { fetchCorroboratingEvidence } from '../utils/corroborate.js';

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

  if (url) {
    try {
      const { title, text: extracted, description: metaDesc, image: metaImage } = await fetchReadableTextFromUrl(url);
      sourceText = `${title}\n\n${extracted}`.trim();
      citations.push(url);
      description = metaDesc || '';
      image = metaImage || '';
      sourceTitle = title || '';
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

  let result = await generateFactCheck({ claimText: claimForModel, sourceText, extraEvidenceText: imageInsight });

  const verdictLower = String(result?.verdict || '').toLowerCase();
  if (verdictLower.includes('mixed') || verdictLower.includes('unverifiable')) {
    const evidence = await fetchCorroboratingEvidence(claimForModel);
    if (evidence.text) {
      const rerun = await generateFactCheck({ claimText: claimForModel, sourceText, extraEvidenceText: `${imageInsight}\n\n${evidence.text}` });
      result = {
        ...rerun,
        citations: Array.from(new Set([...(rerun.citations || []), ...evidence.citations]))
      };
    }
  }

  // Fallback confidence if missing
  const computedConfidence = (() => {
    const v = String(result?.verdict || '').toLowerCase();
    if (Number.isFinite(result?.confidence)) return result.confidence;
    if (v.includes('true')) return v.includes('mostly') ? 85 : 95;
    if (v.includes('false')) return v.includes('mostly') ? 65 : 40;
    if (v.includes('mixed')) return 60;
    return 55;
  })();

  return { description, image, imageInsight, sourceTitle, ...result, confidence: computedConfidence, citations: Array.from(new Set([...(result.citations || []), ...citations])) };
}


