import { REPORT_FIELDS, normalize } from './reportFields.js';
import { REFERENCE_RANGES } from './referenceRanges.js';

export function parseBiomarkers(rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  // Sort labels longest-first so "Blood Urea Nitrogen (BUN)" is checked before "Urea"
  const sortedLabels = Object.keys(REPORT_FIELDS).sort((a, b) => b.length - a.length);

  const results = [];
  const foundKeys = new Set();
  const staticRangeKeys = ['glucose_fasting', 'glucose', 'vitamin_d', 'triglycerides', 'hdl', 'ldl'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const normalizedLine = normalize(line);

    // ROOT CAUSE 1: Require normalized line to START WITH normalized label
    const matchedLabel = sortedLabels.find(label => {
      const normLabel = normalize(label);
      return normalizedLine.startsWith(normLabel);
    });

    if (!matchedLabel) continue;

    const canonicalKey = REPORT_FIELDS[matchedLabel];
    if (foundKeys.has(canonicalKey)) continue;

    let low = null;
    let high = null;

    // ROOT CAUSE 2: Skip regex range extraction for static range fields (lookup from REFERENCE_RANGES)
    if (staticRangeKeys.includes(canonicalKey)) {
      const ref = REFERENCE_RANGES[canonicalKey] || { low: 0, high: 9999 };
      low = ref.low;
      high = ref.high;
    } else {
      // Range extraction via regex on the same line as label
      const rangeMatch = line.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
      if (rangeMatch) {
        low = parseFloat(rangeMatch[1]);
        high = parseFloat(rangeMatch[2]);
      }
    }

    // Forward-scan up to 8 lines, stopping immediately if line starts with another known label
    let value = null;
    const debugLines = [line];

    for (let j = i + 1; j <= i + 8 && j < lines.length; j++) {
      const scanLine = lines[j];
      const normalizedScanLine = normalize(scanLine);

      // ROOT CAUSE 1: Check if candidate line STARTS WITH a DIFFERENT known label
      const isDifferentLabel = sortedLabels.some(otherLabel => {
        const otherKey = REPORT_FIELDS[otherLabel];
        if (otherKey === canonicalKey) return false;
        const normOtherLabel = normalize(otherLabel);
        return normalizedScanLine.startsWith(normOtherLabel);
      });

      if (isDifferentLabel) {
        break; // Stop forward-scan immediately so we don't bleed into next field's block
      }

      debugLines.push(scanLine);
      const isolatedNumMatch = scanLine.match(/^(\d+(?:\.\d+)?)$/);
      if (isolatedNumMatch) {
        value = parseFloat(isolatedNumMatch[1]);
        break;
      }
    }

    // Fallback: If no isolated numeric line below within scan window, check same line after label
    if (value === null) {
      let lineTextAfterLabel = line;
      const normLabel = normalize(matchedLabel);
      const labelIdx = normalizedLine.indexOf(normLabel);
      if (labelIdx !== -1) {
        lineTextAfterLabel = line.slice(labelIdx + matchedLabel.length);
      }

      const sameLineRangeMatch = lineTextAfterLabel.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
      if (sameLineRangeMatch) {
        lineTextAfterLabel = lineTextAfterLabel.replace(sameLineRangeMatch[0], '');
      }

      lineTextAfterLabel = lineTextAfterLabel.replace(/10\^\d+/g, '');

      const sameLineNumMatch = lineTextAfterLabel.match(/(\d+(?:\.\d+)?)/);
      if (sameLineNumMatch) {
        value = parseFloat(sameLineNumMatch[1]);
      }
    }

    const isMissingRange = (low === null || high === null);
    const status = (value === null || isMissingRange) ? "NEEDS_REVIEW" : "EXTRACTED";

    results.push({
      name: canonicalKey,
      value,
      status,
      referenceLow: low,
      referenceHigh: high,
      debugLines
    });

    foundKeys.add(canonicalKey);
  }

  // DEBUG LOGGING: Active when DEBUG_PARSING=true
  if (process.env.DEBUG_PARSING === 'true' || process.env.DEBUG_PARSING === '1') {
    console.log('\n=================== DEBUG PARSER OUTPUT ===================');
    for (const res of results) {
      console.log(`\n[BIOMARKER: ${res.name.toUpperCase()}]`);
      console.log(`Status: ${res.status}`);
      console.log(`Extracted Value: ${res.value !== null ? res.value : 'NULL'}`);
      console.log(`Extracted Range: ${res.referenceLow !== null ? res.referenceLow : 'NULL'} - ${res.referenceHigh !== null ? res.referenceHigh : 'NULL'}`);
      console.log('Scanned Lines:');
      res.debugLines.forEach((l, idx) => console.log(`  Line ${idx + 1}: "${l}"`));
    }
    console.log('\n===========================================================\n');
  }

  return results;
}
