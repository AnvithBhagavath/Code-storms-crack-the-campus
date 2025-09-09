import OpenAI from 'openai';

const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
let _client = null;

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (_client) return _client;
  _client = new OpenAI({ apiKey });
  return _client;
}

function mockFactCheck({ claimText, sourceText }) {
  const lower = `${claimText} ${sourceText || ''}`.toLowerCase();
  let verdict = 'Unverifiable';
  if (lower.includes('confirmed') || lower.includes('official')) verdict = 'True';
  else if (lower.includes('rumor') || lower.includes('fake')) verdict = 'False';
  else if (lower.includes('report') || lower.includes('may')) verdict = 'Mixed';
  return {
    verdict,
    rationale: 'Mock mode enabled. Provide OPENAI_API_KEY for real checks.',
    citations: []
  };
}

export async function generateFactCheck({ claimText, sourceText, extraEvidenceText = '' }) {
  const system = `You are a rigorous, neutral fact-checking assistant.
Given a user claim and extracted source text from reliable web pages, determine:
- Verdict: True / Mostly True / Mixed / Mostly False / False / Unverifiable
- Rationale: concise, cite specific evidence
- Citations: list the most relevant sources (with titles/urls if provided)
Return strict JSON with keys: verdict, rationale, citations (array of strings).`;

  const user = `Claim:\n${claimText}\n\nSource text:\n${sourceText?.slice(0, 9000) || 'N/A'}\n\nExtra evidence:\n${extraEvidenceText?.slice(0, 3000) || 'N/A'}`;

  const mockMode = String(process.env.MOCK_MODE || '').toLowerCase() === 'true';
  const client = getOpenAIClient();
  if (!client || mockMode) {
    return mockFactCheck({ claimText, sourceText });
  }

  const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    const content = response.choices?.[0]?.message?.content || '{}';
    try {
      return JSON.parse(content);
    } catch {
      return { verdict: 'Unverifiable', rationale: 'Malformed JSON from model', citations: [] };
    }
}

export async function analyzeImageEvidence({ imageUrl, claimText = '' }) {
  const client = getOpenAIClient();
  const mockMode = String(process.env.MOCK_MODE || '').toLowerCase() === 'true';
  if (!client || mockMode) {
    return { imageInsight: 'Image analysis unavailable in mock mode.' };
  }

  const system = 'You analyze images for factual content, logos, text (OCR), and visible claims. Return a short, objective summary and any verifiable cues.';
  const messages = [
    {
      role: 'system',
      content: system
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: `If relevant, relate your analysis to this claim: ${claimText || 'N/A'}. Keep it under 120 words.` },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    }
  ];

  const response = await client.chat.completions.create({
    model,
    messages,
    temperature: 0.2
  });
  const content = response.choices?.[0]?.message?.content?.trim?.() || '';
  return { imageInsight: content || 'No visual cues detected.' };
}


