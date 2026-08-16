import { BIOMARKER_ALIASES, normalize } from './reportFields.js';
import { REFERENCE_RANGES } from './referenceRanges.js';

const FOOTNOTE_PATTERNS = [
  /^note:/i,
  /^associated tests:/i,
  /reference interval as per/i,
  /^\*\*/,
];

function isFootnoteLine(line) {
  return FOOTNOTE_PATTERNS.some(p => p.test(line.trim()));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fuzzyMatchLabel(normalizedLine, alias) {
  const aliasWords = alias.split(" ").filter(w => w.length > 2);
  if (aliasWords.length === 0) {
    return new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i').test(normalizedLine);
  }
  const matchedWords = aliasWords.filter(w =>
    new RegExp(`\\b${escapeRegex(w)}\\b`, 'i').test(normalizedLine)
  );
  return matchedWords.length / aliasWords.length >= 0.7;
}

function extractQualitativeValue(text, canonicalKey) {
  if (!text) return null;
  const clean = text.replace(/^["'\s:]+|["'\s:]+$/g, '').trim();

  if (canonicalKey === 'blood_group') {
    const match = clean.match(/\b(A|B|AB|O)(?:\s*(POSITIVE|NEGATIVE|[+-]))?\b/i);
    if (match) return match[0].toUpperCase().replace(/\s+/g, ' ');
  }

  if (canonicalKey === 'rh_type') {
    const match = clean.match(/\b(POSITIVE|NEGATIVE|[+-])\b/i);
    if (match) return match[0].toUpperCase();
  }

  return null;
}

export function parseBiomarkers(rawText) {
  const lines = (rawText || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const results = [];
  const foundKeys = new Set();
  const QUALITATIVE_KEYS = ['blood_group', 'rh_type'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Skip footnote / reference interval lines entirely before label matching
    if (isFootnoteLine(line)) continue;

    const normalizedLine = normalize(line);

    // Fuzzy match line against all biomarker aliases using word-boundary regex
    const candidates = [];
    for (const [canonicalKey, aliases] of Object.entries(BIOMARKER_ALIASES)) {
      if (foundKeys.has(canonicalKey)) continue;
      for (const alias of aliases) {
        const normAlias = normalize(alias);
        if (fuzzyMatchLabel(normalizedLine, normAlias)) {
          candidates.push({ canonicalKey, normAlias, length: normAlias.length });
        }
      }
    }

    if (candidates.length === 0) continue;

    // Pick best match (longest normalized alias first to preserve collision handling)
    candidates.sort((a, b) => b.length - a.length);
    const bestMatch = candidates[0];
    const canonicalKey = bestMatch.canonicalKey;
    const matchedLabel = bestMatch.normAlias;

    let low = null;
    let high = null;
    let value = null;
    const debugLines = [line];
    const isQualitative = QUALITATIVE_KEYS.includes(canonicalKey);

    if (isQualitative) {
      low = 'N/A';
      high = 'N/A';

      // 1. Try extracting qualitative value from the SAME line first (after label)
      let lineTextAfterLabel = line;
      const labelIdx = normalizedLine.indexOf(matchedLabel);
      if (labelIdx !== -1) {
        lineTextAfterLabel = line.slice(labelIdx + matchedLabel.length);
      }

      value = extractQualitativeValue(lineTextAfterLabel, canonicalKey);

      // 2. If not found on same line, scan up to 8 forward lines below
      if (value === null) {
        for (let j = i + 1; j <= i + 8 && j < lines.length; j++) {
          const scanLine = lines[j];
          if (isFootnoteLine(scanLine)) break;

          const normalizedScanLine = normalize(scanLine);
          const isDifferentLabel = Object.entries(BIOMARKER_ALIASES).some(([otherKey, aliases]) => {
            if (otherKey === canonicalKey) return false;
            return aliases.some(alias => fuzzyMatchLabel(normalizedScanLine, normalize(alias)));
          });
          if (isDifferentLabel) break;

          debugLines.push(scanLine);
          value = extractQualitativeValue(scanLine, canonicalKey);
          if (value !== null) break;
        }
      }
    } else {
      // Try regex range extraction FIRST for quantitative fields; fall back to REFERENCE_RANGES if regex finds no "X - Y" pattern
      const rangeMatch = line.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
      if (rangeMatch) {
        low = parseFloat(rangeMatch[1]);
        high = parseFloat(rangeMatch[2]);
      } else if (REFERENCE_RANGES[canonicalKey]) {
        low = REFERENCE_RANGES[canonicalKey].low;
        high = REFERENCE_RANGES[canonicalKey].high;
      }

      // Forward-scan up to 8 lines for quantitative numeric result
      for (let j = i + 1; j <= i + 8 && j < lines.length; j++) {
        const scanLine = lines[j];
        if (isFootnoteLine(scanLine)) break;

        const normalizedScanLine = normalize(scanLine);

        // Boundary check: Check if scan line matches ANY alias of ANY OTHER biomarker
        const isDifferentLabel = Object.entries(BIOMARKER_ALIASES).some(([otherKey, aliases]) => {
          if (otherKey === canonicalKey) return false;
          return aliases.some(alias => {
            const normOtherAlias = normalize(alias);
            return fuzzyMatchLabel(normalizedScanLine, normOtherAlias);
          });
        });

        if (isDifferentLabel) {
          break; // Stop forward-scan immediately at next field boundary
        }

        debugLines.push(scanLine);

        // Widen isolated-value line pattern to match bare number OR number + unit fragment
        const isolatedNumMatch = scanLine.match(/^(\d+(?:\.\d+)?)\s*[a-zA-Z/%µ^0-9]*\s*$/);
        if (isolatedNumMatch) {
          value = parseFloat(isolatedNumMatch[1]);
          break;
        }
      }

      // Fallback: If no isolated numeric line below within scan window, check same line after label
      if (value === null) {
        let lineTextAfterLabel = line;
        const labelIdx = normalizedLine.indexOf(matchedLabel);
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
    }

    const isMissingRange = (low === null || high === null);
    const status = (value === null || (!isQualitative && isMissingRange)) ? "NEEDS_REVIEW" : (isQualitative ? "PASS" : "EXTRACTED");

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
