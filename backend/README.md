# Fact Check Backend (Node.js + Express)

API to fact-check text or URLs using OpenAI and basic web scraping.

## Setup

1) Create a `.env` file in `backend/` with:

```
OPENAI_API_KEY=sk-...
PORT=4000
OPENAI_MODEL=gpt-4o-mini
```

2) Install dependencies:

```
npm install
```

3) Run the server:

```
npm run dev
```

The API will start on `http://localhost:4000`.

## Endpoints

- GET `/health`
  - Response: `{ "status": "ok" }`

- POST `/api/fact-check`
  - Request JSON: `{ "text": string, "url": string }` (provide either or both)
  - Response JSON: `{ "verdict": string, "rationale": string, "citations": string[] }`

Example (PowerShell):

```
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/fact-check -ContentType 'application/json' -Body '{"text":"The moon is made of cheese."}'
```

## CORS

CORS is enabled for all origins by default; adjust in `src/index.js` if needed.

## Notes

- Uses `@mozilla/readability` to extract readable text from URLs.
- Consider adding rate limiting, logging, and stricter input validation for production.
