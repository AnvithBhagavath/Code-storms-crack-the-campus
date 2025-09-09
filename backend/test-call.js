const payload = { url: 'https://example.com' };
const res = await fetch('http://localhost:4000/api/fact-check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});
const text = await res.text();
console.log('Status:', res.status);
console.log(text);
