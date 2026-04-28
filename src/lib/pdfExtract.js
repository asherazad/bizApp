// Client-side PDF text + position extraction using pdfjs-dist.
// Returns structured invoice fields including line items detected via column layout.
export async function extractFromPDF(file) {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const allItems = [];
  let pageYOffset = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp      = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      allItems.push({
        str: item.str,
        x:   Math.round(item.transform[4]),
        y:   Math.round(pageYOffset + vp.height - item.transform[5]),
        w:   Math.round(item.width),
      });
    }
    pageYOffset += vp.height + 20;
  }

  allItems.sort((a, b) => a.y !== b.y ? a.y - b.y : a.x - b.x);

  // Group into visual lines (items within 4px vertically = same row)
  const lines = [];
  for (const item of allItems) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(item.y - last.y) <= 4) {
      last.items.push(item);
      last.text += ' ' + item.str;
    } else {
      lines.push({ y: item.y, items: [item], text: item.str });
    }
  }

  const fullText = lines.map(l => l.text).join('\n');

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const months = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  function get(patterns) {
    for (const re of patterns) { const m = fullText.match(re); if (m) return m[1]?.trim() || ''; }
    return '';
  }
  function parseDate(str) {
    if (!str) return '';
    const m1 = str.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
    if (m1) { const mo = months[m1[2].slice(0,3).toLowerCase()]; if (mo) return `${m1[3]}-${String(mo).padStart(2,'0')}-${m1[1].padStart(2,'0')}`; }
    const m2 = str.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
    return '';
  }
  function cleanNum(s) { return parseFloat(String(s||'').replace(/,/g,'')) || 0; }

  // ── Scalar fields ─────────────────────────────────────────────────────────────
  const invoice_number = get([
    /invoice\s*(?:no\.?|number|#)\s*[:\-]?\s*([A-Z0-9\-]+)/i,
    /\binv[oice]*\s*#?\s*[:\-]?\s*([0-9]+)/i,
  ]);
  const invoice_date = parseDate(get([
    /(?:invoice\s+)?date\s*[:\-]\s*([^\n\r]+)/i,
    /dated?\s*[:\-]\s*([^\n\r]+)/i,
  ]));
  const due_date = parseDate(get([
    /due\s+date\s*[:\-]\s*([^\n\r]+)/i,
    /payment\s+due\s*[:\-]\s*([^\n\r]+)/i,
    /due\s*[:\-]\s*([^\n\r]+)/i,
  ]));
  const vendor_name = get([/(?:from|issued\s+by|billed\s+by)\s*[:\-]\s*([^\n\r]+)/i]);
  const client_name = get([
    /bill(?:ed)?\s+to\s*[:\-]?\s*([^\n\r]+)/i,
    /(?:to|attn\.?)\s*[:\-]\s*([^\n\r]+)/i,
    /client\s*[:\-]\s*([^\n\r]+)/i,
  ]);
  const po_number_ref = get([
    /(?:po|purchase\s*order|p\.o\.)\s*(?:no\.?|number|#)?\s*[:\-]?\s*([A-Z0-9\-]+)/i,
    /order\s*(?:no|number|#)\s*[:\-]\s*([A-Z0-9\-]+)/i,
  ]);
  const currMatch = fullText.match(/\b(USD|EUR|GBP|AED|PKR)\b/);
  const currency  = currMatch ? currMatch[1] : 'PKR';
  const taxMatch  = fullText.match(/(?:tax|gst|vat|sts)[^\d\n]{0,20}([\d,]+(?:\.\d{1,2})?)/i);
  const tax_amount = taxMatch ? String(cleanNum(taxMatch[1])) : '0';
  const ntnMatch  = fullText.match(/ntn\s*[:\-]?\s*([\d\-]+)/i);
  const notes = ntnMatch ? `NTN: ${ntnMatch[1]}` : '';

  // ── Line items via column layout ──────────────────────────────────────────────
  const line_items = [];

  const headerIdx = lines.findIndex(l =>
    /description|particulars|item|detail|service/i.test(l.text) &&
    /(?:amount|total|rate|price|qty|quantity)/i.test(l.text)
  );

  if (headerIdx >= 0) {
    const headerLine = lines[headerIdx];
    const colMap = {};
    for (const it of headerLine.items) {
      const k = it.str.trim().toLowerCase();
      if (/desc|particular|item|detail|service/i.test(k)) colMap.desc = it.x;
      else if (/qty|quantity|nos/i.test(k))               colMap.qty  = it.x;
      else if (/rate|unit\s*price|unit/i.test(k))         colMap.rate = it.x;
      else if (/amount|total/i.test(k))                   colMap.amt  = it.x;
    }

    for (let i = headerIdx + 1; i < lines.length; i++) {
      const line = lines[i];
      if (/^\s*(?:sub\s*total|grand\s*total|total|tax|gst|vat|balance)\s*$/i.test(line.text.trim())) break;
      if (/\b(?:sub\s*total|grand\s*total)\b/i.test(line.text)) break;

      let desc = '', qty = '', rate = '', amt = '';
      for (const it of line.items) {
        const closest = Object.entries(colMap)
          .map(([k, cx]) => ({ k, d: Math.abs(it.x - cx) }))
          .sort((a, b) => a.d - b.d)[0];

        if (!closest || closest.d > 80) {
          desc += (desc ? ' ' : '') + it.str;
        } else {
          if (closest.k === 'desc')      desc += (desc ? ' ' : '') + it.str;
          else if (closest.k === 'qty')  qty  = it.str;
          else if (closest.k === 'rate') rate = it.str;
          else if (closest.k === 'amt')  amt  = it.str;
        }
      }

      desc = desc.trim();
      if (!desc || desc.length < 3) continue;
      if (/^(?:sr\.?|s\.?no\.?|#)$/i.test(desc)) continue;

      const qtyN  = cleanNum(qty) || 1;
      const rateN = cleanNum(rate);
      const amtN  = cleanNum(amt) || rateN;
      line_items.push({ description: desc, notes: '', quantity: qtyN, unit_price: rateN || amtN, amount: String(amtN || rateN) });
    }
  }

  // Fallback: pattern matching on lines
  if (!line_items.length) {
    for (const line of lines) {
      const nums = [...line.text.matchAll(/([\d,]+(?:\.\d{1,2})?)/g)]
        .map(m => cleanNum(m[1])).filter(n => n > 0);
      if (!nums.length) continue;
      const textPart = line.text.replace(/([\d,]+(?:\.\d{1,2})?)/g, '').replace(/\s+/g,' ').trim();
      if (textPart.length < 4) continue;
      if (/total|subtotal|tax|gst|vat|balance|amount\s*due|invoice/i.test(textPart)) continue;
      const amt  = nums[nums.length - 1];
      const rate = nums.length >= 2 ? nums[nums.length - 2] : amt;
      const qty  = nums.length >= 3 ? nums[0] : 1;
      line_items.push({ description: textPart, notes: '', quantity: qty, unit_price: rate, amount: String(amt) });
    }
  }

  return { invoice_number, invoice_date, due_date, vendor_name, client_name, po_number_ref, currency, tax_amount, notes, line_items };
}
