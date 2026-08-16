import pdf from 'pdf-parse';

export function stripSummarySection(rawText) {
  const marker = "Abnormal Result(s) Summary End";
  const idx = rawText.indexOf(marker);
  return idx === -1 ? rawText : rawText.slice(idx + marker.length);
}

export async function extractText(buffer) {
  const data = await pdf(buffer);
  if (!data || !data.text || !data.text.trim()) {
    throw new Error("This report appears to be scanned/image-based. Please upload a text-based PDF.");
  }
  return stripSummarySection(data.text);
}
