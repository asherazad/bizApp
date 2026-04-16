/**
 * pdfExtractor.js
 * Free, zero-API PDF extraction using pdfjs-dist (Mozilla PDF.js).
 * Runs entirely in the browser — no server, no API key, no cost.
 *
 * Works on text-based PDFs (WaveApps, QuickBooks, Zoho, etc.)
 * For scanned PDFs, falls back to a warning.
 */

// ─── Load PDF.js from CDN (loaded once, cached by browser) ───
let _pdfjs = null

async function getPdfJs() {
  if (_pdfjs) return _pdfjs
  const mod = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs')
  mod.GlobalWorkerOptions.workerSrc =
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs'
  _pdfjs = mod
  return mod
}

// ─── Extract all text from PDF ────────────────────────────
export async function extractTextFromPDF(file) {
  const pdfjs    = await getPdfJs()
  const arrayBuf = await file.arrayBuffer()
  const pdf      = await pdfjs.getDocument({ data: arrayBuf }).promise
  const lines    = []

  for (let p = 1; p <= pdf.numPages; p++) {
    const page    = await pdf.getPage(p)
    const content = await page.getTextContent()
    // Sort items by vertical position (y desc) then horizontal (x asc)
    const sorted  = content.items
      .filter(i => i.str?.trim())
      .sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5]
        return Math.abs(yDiff) > 3 ? yDiff : a.transform[4] - b.transform[4]
      })
    sorted.forEach(i => lines.push(i.str.trim()))
  }

  return lines
}

// ─── Parse extracted lines into invoice fields ────────────
export function parseInvoiceLines(lines) {
  const text = lines.join('\n')

  // ── Helpers ───────────────────────────────────────────
  function find(patterns) {
    for (const pat of patterns) {
      const m = text.match(pat)
      if (m) return m[1]?.trim() ?? null
    }
    return null
  }

  function findDate(patterns) {
    const raw = find(patterns)
    if (!raw) return null
    return normaliseDate(raw)
  }

  function normaliseDate(raw) {
    if (!raw) return null
    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
    // Month name formats: "November 27, 2025" or "27 November 2025"
    const months = { january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',
                     july:'07',august:'08',september:'09',october:'10',november:'11',december:'12' }
    let m = raw.match(/([a-z]+)\s+(\d{1,2}),?\s+(\d{4})/i)
    if (m) {
      const mo = months[m[1].toLowerCase()]
      if (mo) return `${m[3]}-${mo}-${m[2].padStart(2,'0')}`
    }
    m = raw.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/i)
    if (m) {
      const mo = months[m[2].toLowerCase()]
      if (mo) return `${m[3]}-${mo}-${m[1].padStart(2,'0')}`
    }
    // DD/MM/YYYY or MM/DD/YYYY
    m = raw.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`
    return raw
  }

  function parseMoney(str) {
    if (!str) return 0
    return parseFloat(str.replace(/[^0-9.]/g, '')) || 0
  }

  function detectCurrency(text) {
    if (/£|GBP/.test(text)) return 'GBP'
    if (/€|EUR/.test(text)) return 'EUR'
    if (/₨|PKR/.test(text)) return 'PKR'
    if (/د\.إ|AED/.test(text)) return 'AED'
    if (/﷼|SAR/.test(text)) return 'SAR'
    return 'USD'
  }

  // ── Core fields ───────────────────────────────────────
  const invoiceNumber = find([
    /Invoice\s*(?:Number|No\.?|#)[:\s]+([A-Z0-9\-\/]+)/i,
    /(?:^|\n)#\s*([A-Z0-9\-]+)/im,
    /INV[-#]?\s*([0-9]+)/i,
  ])

  const invoiceDate = findDate([
    /Invoice\s*Date[:\s]+(.+?)(?:\n|$)/i,
    /Date\s*(?:of\s*Invoice)?[:\s]+(.+?)(?:\n|$)/i,
    /Issued[:\s]+(.+?)(?:\n|$)/i,
  ])

  const dueDate = findDate([
    /(?:Payment\s*)?Due(?:\s*Date)?[:\s]+(.+?)(?:\n|$)/i,
    /Pay\s*By[:\s]+(.+?)(?:\n|$)/i,
    /Due\s*On[:\s]+(.+?)(?:\n|$)/i,
  ])

  const currency = detectCurrency(text)

  const total = parseMoney(find([
    /Amount\s*Due\s*\([A-Z]+\)[:\s]+\$?([\d,]+\.?\d*)/i,
    /Total[:\s]+\$?([\d,]+\.?\d*)/i,
    /Grand\s*Total[:\s]+\$?([\d,]+\.?\d*)/i,
    /Balance\s*Due[:\s]+\$?([\d,]+\.?\d*)/i,
  ]))

  const subtotal = parseMoney(find([
    /Subtotal[:\s]+\$?([\d,]+\.?\d*)/i,
    /Sub\s*Total[:\s]+\$?([\d,]+\.?\d*)/i,
  ])) || total

  const taxAmount = parseMoney(find([
    /(?:VAT|GST|Tax)[:\s]+\$?([\d,]+\.?\d*)/i,
    /Sales\s*Tax[:\s]+\$?([\d,]+\.?\d*)/i,
  ]))

  const discountAmount = parseMoney(find([
    /Discount[:\s]+\$?([\d,]+\.?\d*)/i,
  ]))

  // ── Vendor (billed from) ───────────────────────────────
  // Usually the first prominent company name at top of invoice
  const vendorNameRaw = find([
    /^(.+?(?:Ltd|LLC|Inc|Corp|Pvt|Solutions|Technologies|Services|Group|Co\.)\.?)/im,
  ]) ?? lines[0] ?? ''

  const vendorTax = find([
    /NTN[:\s]+([0-9\-]+)/i,
    /VAT\s*(?:No|Number|#)[:\s]+([A-Z0-9\-]+)/i,
    /GST[:\s]+([A-Z0-9\-]+)/i,
    /Tax\s*(?:No|Number|ID)[:\s]+([A-Z0-9\-]+)/i,
    /EIN[:\s]+([0-9\-]+)/i,
  ])

  // ── Bill-to client ─────────────────────────────────────
  const billToIdx = lines.findIndex(l => /bill\s*to/i.test(l))
  let clientName = null, clientAddress = null, clientEmail = null, clientPhone = null

  if (billToIdx >= 0) {
    // Next non-empty line after "BILL TO" is typically the company name
    for (let i = billToIdx + 1; i < Math.min(billToIdx + 8, lines.length); i++) {
      const l = lines[i]
      if (!clientName && l && !/invoice|date|due|amount/i.test(l)) {
        clientName = l; continue
      }
      if (clientName && !clientEmail && /[@]/.test(l)) { clientEmail = l; continue }
      if (clientName && !clientPhone && /^\+?[\d\s\-()]{7,}$/.test(l)) { clientPhone = l; continue }
    }
  }

  // ── Notes / terms ──────────────────────────────────────
  const notesIdx  = lines.findIndex(l => /notes\s*\/?\s*terms/i.test(l))
  const notesText = notesIdx >= 0
    ? lines.slice(notesIdx + 1, notesIdx + 12).join('\n').trim()
    : ''

  // ── Line items ─────────────────────────────────────────
  // Strategy: find rows where we have: description + number + number + money
  const items = []
  const moneyPat   = /\$?([\d,]+\.\d{2})/
  const qtyPat     = /^(\d+(?:\.\d+)?)$/

  // Find the header row index (Services / Description / Item)
  const headerIdx = lines.findIndex(l =>
    /^(services?|description|item|particulars)/i.test(l)
  )

  if (headerIdx >= 0) {
    let i = headerIdx + 1
    while (i < lines.length) {
      const line = lines[i]

      // Stop at totals section
      if (/^(subtotal|total|amount due|balance|tax|discount|notes)/i.test(line)) break

      // Skip column headers (Quantity, Rate, Amount)
      if (/^(quantity|rate|amount|price|unit)/i.test(line)) { i++; continue }

      // A line item description: not a number, not empty
      if (line && !moneyPat.test(line) && !qtyPat.test(line) && line.length > 2) {
        const desc = line
        let   qty        = 1
        let   unitPrice  = 0
        let   lineAmount = 0

        // Look ahead up to 5 lines for qty, rate, amount
        const lookahead = lines.slice(i + 1, i + 6)
        const nums = lookahead.filter(l => moneyPat.test(l) || qtyPat.test(l))

        if (nums.length >= 3) {
          qty        = parseFloat(nums[0].replace(/[^0-9.]/g,'')) || 1
          unitPrice  = parseMoney(nums[1])
          lineAmount = parseMoney(nums[2])
          i += 4
        } else if (nums.length === 2) {
          unitPrice  = parseMoney(nums[0])
          lineAmount = parseMoney(nums[1])
          i += 3
        } else if (nums.length === 1) {
          lineAmount = parseMoney(nums[0])
          unitPrice  = lineAmount
          i += 2
        } else {
          i++; continue
        }

        // Sanity check: skip if amounts are 0 and description is short
        if (unitPrice === 0 && lineAmount === 0 && desc.length < 4) continue

        // Sub-bullet lines (starting with •) — append to previous item description
        if (/^[•·\-]/.test(desc) && items.length > 0) {
          items[items.length - 1].description += `\n${desc}`
          continue
        }

        items.push({
          description: desc,
          quantity:    qty,
          unit_price:  unitPrice || lineAmount,
          discount_pct:0,
          tax_pct:     0,
        })
        continue
      }
      i++
    }
  }

  // Fallback: if no items found via table, try scanning for money lines
  if (items.length === 0) {
    lines.forEach((line, idx) => {
      const m = line.match(moneyPat)
      if (!m) return
      if (/total|subtotal|due|tax|discount/i.test(line)) return
      const prev = lines[idx - 1] ?? ''
      if (prev && !moneyPat.test(prev)) {
        items.push({
          description: prev,
          quantity:    1,
          unit_price:  parseMoney(m[1]),
          discount_pct:0,
          tax_pct:     0,
        })
      }
    })
  }

  return {
    vendor: {
      name:       vendorNameRaw,
      email:      find([/([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/]) ?? null,
      phone:      null,
      address:    null,
      tax_number: vendorTax,
    },
    client: {
      name:    clientName,
      email:   clientEmail,
      phone:   clientPhone,
      address: clientAddress,
    },
    invoice_number: invoiceNumber,
    invoice_date:   invoiceDate,
    due_date:       dueDate,
    currency,
    reference:      null,
    notes:          notesText,
    terms:          null,
    items,
    subtotal,
    discount_amount: discountAmount,
    tax_amount:      taxAmount,
    total,
    confidence:      items.length > 0 ? 0.82 : 0.45,
    _source:         'pdfjs-local',
  }
}

// ─── Main entry: file → structured invoice data ───────────
export async function extractInvoiceFromPDF(file) {
  if (file.type !== 'application/pdf') {
    throw new Error('Only PDF files are supported with the free parser. Upload a PDF.')
  }

  let lines
  try {
    lines = await extractTextFromPDF(file)
  } catch (err) {
    throw new Error(`Could not read PDF: ${err.message}`)
  }

  if (!lines.length) {
    throw new Error('This PDF appears to be scanned (image-only). No text could be extracted.')
  }

  const result = parseInvoiceLines(lines)

  if (!result.invoice_number && !result.total) {
    throw new Error('Could not find invoice data. Make sure this is a text-based invoice PDF.')
  }

  return result
}

// ─── fileToBase64 kept for compatibility ─────────────────
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = () => resolve(reader.result.split(',')[1])
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

// ─── Normalise extracted data ─────────────────────────────
export function normaliseExtracted(data) {
  return {
    ...data,
    invoice_date: data.invoice_date || new Date().toISOString().slice(0, 10),
    currency:     data.currency || 'USD',
    items: (data.items || []).map((item, i) => ({
      ...item,
      _id:          crypto.randomUUID(),
      sort_order:   i,
      quantity:     Number(item.quantity)     || 1,
      unit_price:   Number(item.unit_price)   || 0,
      discount_pct: Number(item.discount_pct) || 0,
      tax_pct:      Number(item.tax_pct)      || 0,
    })),
  }
}
