/**
 * proxy-server.js
 * Lightweight Express proxy that forwards PDF extraction requests
 * to the Anthropic API. Run alongside Vite dev server.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-ant-... node proxy-server.js
 *
 * Then in vite.config.js, /api/extract proxies to this server.
 */

const express = require('express')
const cors    = require('cors')
const app     = express()

app.use(cors({ origin: 'http://localhost:3000' }))
app.use(express.json({ limit: '25mb' }))

const PORT = process.env.PROXY_PORT || 4001

app.post('/api/extract-invoice', async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return res.status(500).json({
      error: 'ANTHROPIC_API_KEY is not set. Add it to your .env file.',
    })
  }

  const { base64, mediaType } = req.body

  if (!base64 || !mediaType) {
    return res.status(400).json({ error: 'base64 and mediaType are required' })
  }

  const EXTRACTION_PROMPT = `
You are an invoice data extraction specialist. Extract ALL structured data from this invoice PDF.

Return ONLY a valid JSON object with this exact structure — no markdown, no explanation, just raw JSON:

{
  "vendor": {
    "name": "",
    "email": "",
    "phone": "",
    "address": "",
    "tax_number": ""
  },
  "invoice_number": "",
  "invoice_date": "",
  "due_date": "",
  "currency": "USD",
  "reference": "",
  "notes": "",
  "terms": "",
  "items": [
    {
      "description": "",
      "quantity": 1,
      "unit_price": 0,
      "discount_pct": 0,
      "tax_pct": 0
    }
  ],
  "subtotal": 0,
  "discount_amount": 0,
  "tax_amount": 0,
  "total": 0,
  "confidence": 0.95
}

Rules:
- Dates must be in YYYY-MM-DD format
- currency must be a 3-letter ISO code (USD, GBP, EUR, PKR, AED, etc.)
- All numbers must be plain numbers, not strings
- If a field is not found, use null for strings and 0 for numbers
- Extract every line item individually — do not merge them
- confidence is a float 0–1 reflecting your overall extraction confidence
- If this is not an invoice or quotation, return { "error": "Not an invoice" }
`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: [
              {
                type:   'document',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return res.status(response.status).json({
        error: err?.error?.message ?? `Anthropic API error ${response.status}`,
      })
    }

    const data = await response.json()
    const raw  = data.content?.find(b => b.type === 'text')?.text ?? ''
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim()

    try {
      const parsed = JSON.parse(cleaned)
      if (parsed.error) return res.status(422).json({ error: parsed.error })
      return res.json(parsed)
    } catch {
      return res.status(422).json({ error: 'Could not parse extraction response.' })
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

app.listen(PORT, () => {
  console.log(`Proxy server → http://localhost:${PORT}`)
  console.log(`API key:       ${process.env.ANTHROPIC_API_KEY ? '✓ set' : '✗ MISSING — set ANTHROPIC_API_KEY'}`)
})
