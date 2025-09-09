$body = @{ url = 'https://example.com' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://localhost:4000/api/fact-check -ContentType 'application/json' -Body $body | ConvertTo-Json -Depth 5
