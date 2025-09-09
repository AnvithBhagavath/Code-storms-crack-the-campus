import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

if (!apiKey) {
  console.warn('Warning: OPENAI_API_KEY is not set. Set it in .env');
}

export const openai = new OpenAI({ apiKey });

export async function generateFactCheck({ claimText, sourceText }) {
  const system = `You are a rigorous, neutral fact-checking assistant.
Given a user claim and extracted source text from reliable web pages, determine:
- Verdict: True / Mostly True / Mixed / Mostly False / False / Unverifiable
- Rationale: concise, cite specific evidence
- Citations: list the most relevant sources (with titles/urls if provided)
Return strict JSON with keys: verdict, rationale, citations (array of strings).`;

  const user = `Claim:\n${claimText}\n\nSource text:\n${sourceText?.slice(0, 12000) || 'N/A'}`;

  const response = await openai.chat.completions.create({
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


