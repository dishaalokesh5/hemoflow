import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export function stripSummarySection(rawText) {
  const marker = "Abnormal Result(s) Summary End";
  const idx = rawText.indexOf(marker);
  return idx === -1 ? rawText : rawText.slice(idx + marker.length);
}

export async function extractText(buffer) {
  const uint8Array = new Uint8Array(buffer);
  const loadingTask = pdfjsLib.getDocument({
    data: uint8Array,
    verbosity: 0 // Suppress non-critical font warning logs in server console
  });
  const pdfDoc = await loadingTask.promise;

  let allRows = [];
  let totalItemsCount = 0;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items = (textContent.items || []).filter(item => item.str && item.str.trim().length > 0);
    totalItemsCount += items.length;

    // Group items into rows based on y-coordinate tolerance (within 3 units)
    const pageRows = [];

    for (const item of items) {
      const x = item.transform[4];
      const y = item.transform[5];
      const text = item.str.trim();

      // Find an existing row within y-tolerance of 3
      let matchedRow = pageRows.find(r => Math.abs(r.y - y) <= 3);
      if (matchedRow) {
        matchedRow.items.push({ x, y, text });
      } else {
        pageRows.push({
          y,
          items: [{ x, y, text }]
        });
      }
    }

    // Sort page rows top-to-bottom (y-coordinate descending in PDF coordinates)
    pageRows.sort((a, b) => b.y - a.y);

    // Within each row, sort items left-to-right (x-coordinate ascending)
    for (const row of pageRows) {
      row.items.sort((a, b) => a.x - b.x);
      const rowLine = row.items.map(i => i.text).join(' ');
      allRows.push(rowLine);
    }
  }

  if (totalItemsCount === 0 || allRows.length === 0) {
    throw new Error("This report appears to be scanned/image-based. Please upload a text-based PDF.");
  }

  const rawText = allRows.join('\n');
  return stripSummarySection(rawText);
}
