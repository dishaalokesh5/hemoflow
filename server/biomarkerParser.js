import { BIOMARKER_ALIASES, normalize } from './reportFields.js';
import { REFERENCE_RANGES } from './referenceRanges.js';

const FOOTNOTE_PATTERNS = [
  /^note:/i,
  /^associated tests:/i,
  /reference interval as per/i,
  /^\*\*/,
  /^interpretation:/i,
  /^references:/i,
  /^deficiency:/i,
  /^normal:/i,
  /^\d+\.\s/
];

function isFootnoteLine(line) {
  return FOOTNOTE_PATTERNS.some(p => p.test(line.trim()));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fuzzyMatchLabel(normalizedLine, alias, canonicalKey) {
  // Strict check for MCH vs MCHC
  if (canonicalKey === 'mch') {
    if (/\bmchc\b/i.test(normalizedLine) || /concentration/i.test(normalizedLine)) {
      return false;
    }
  }

  if (canonicalKey === 'mchc') {
    if (!/\bmchc\b/i.test(normalizedLine) && !/concentration/i.test(normalizedLine)) {
      return false;
    }
  }

  // Prevent Vitamin D from matching unrelated lines
  if (canonicalKey === 'vitamin_d') {
    if (!/vitamin\s*d|vit\s*d|25\s*hydroxy/i.test(normalizedLine)) {
      return false;
    }
  }

  const aliasWords = alias.split(" ").filter(w => w.length > 2);
  if (aliasWords.length === 0) {
    return new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i').test(normalizedLine);
  }

  // Exact word boundary regex check
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

  // Extract patient metadata (Age, Gender) from PDF header
  let extractedAge = null;
  let extractedSex = null;
  for (let i = 0; i < Math.min(lines.length, 30); i++) {
    const l = lines[i];
    
    // Strict Age matching (require 'Years' or 'Yrs')
    const ageMatch = l.match(/\bAge\s*[:\-]?\s*(\d{1,3})\s*(Years|Yrs|Y)\b/i);
    if (ageMatch && !extractedAge) {
      extractedAge = parseInt(ageMatch[1], 10);
    }
    
    const sexMatch = l.match(/(?:Gender|Sex)\s*[:\-]?\s*(Female|Male|F|M)\b/i);
    if (sexMatch && sexMatch[1] && !extractedSex) {
      const s = sexMatch[1].toLowerCase();
      extractedSex = s.startsWith('f') ? 'female' : 'male';
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (isFootnoteLine(line)) continue;

    const normalizedLine = normalize(line);

    // Candidate label matching
    const candidates = [];
    for (const [canonicalKey, aliases] of Object.entries(BIOMARKER_ALIASES)) {
      if (foundKeys.has(canonicalKey)) continue;
      for (const alias of aliases) {
        const normAlias = normalize(alias);
        if (fuzzyMatchLabel(normalizedLine, normAlias, canonicalKey)) {
          candidates.push({ canonicalKey, normAlias, length: normAlias.length });
        }
      }
    }

    if (candidates.length === 0) continue;

    // Pick best match (longest alias first)
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

      let lineTextAfterLabel = line;
      const labelIdx = normalizedLine.indexOf(matchedLabel);
      if (labelIdx !== -1) {
        lineTextAfterLabel = line.slice(labelIdx + matchedLabel.length);
      }

      value = extractQualitativeValue(lineTextAfterLabel, canonicalKey);

      if (value === null) {
        for (let j = i + 1; j <= i + 8 && j < lines.length; j++) {
          const scanLine = lines[j];
          if (isFootnoteLine(scanLine)) break;

          const normalizedScanLine = normalize(scanLine);
          const isDifferentLabel = Object.entries(BIOMARKER_ALIASES).some(([otherKey, aliases]) => {
            if (otherKey === canonicalKey) return false;
            return aliases.some(alias => fuzzyMatchLabel(normalizedScanLine, normalize(alias), otherKey));
          });
          if (isDifferentLabel) break;

          debugLines.push(scanLine);
          value = extractQualitativeValue(scanLine, canonicalKey);
          if (value !== null) break;
        }
      }
    } else {
      // Range extraction from line or reference defaults
      const rangeMatch = line.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
      if (rangeMatch) {
        low = parseFloat(rangeMatch[1]);
        high = parseFloat(rangeMatch[2]);
      } else if (REFERENCE_RANGES[canonicalKey]) {
        low = REFERENCE_RANGES[canonicalKey].low;
        high = REFERENCE_RANGES[canonicalKey].high;
      }

      // 1. PRIORITIZE SAME-LINE VALUE EXTRACTION FIRST
      let lineTextAfterLabel = line;
      const labelIdx = normalizedLine.indexOf(matchedLabel);
      if (labelIdx !== -1) {
        lineTextAfterLabel = line.slice(labelIdx + matchedLabel.length);
      }

      // Clean out parenthetical test titles (e.g. "(25-Hydroxy Vit D)", "(HbA1c)", "(SAP)")
      lineTextAfterLabel = lineTextAfterLabel.replace(/\([^)]*\)/g, '');

      // Remove reference range pattern if present on same line
      const sameLineRangeMatch = lineTextAfterLabel.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
      if (sameLineRangeMatch) {
        lineTextAfterLabel = lineTextAfterLabel.replace(sameLineRangeMatch[0], '');
      }

      // Remove scientific exponent patterns and accreditation codes
      lineTextAfterLabel = lineTextAfterLabel.replace(/10\^\d+/g, '').replace(/MC-\d+/g, '');

      const sameLineNumMatch = lineTextAfterLabel.match(/(\d+(?:\.\d+)?)/);
      if (sameLineNumMatch) {
        value = parseFloat(sameLineNumMatch[1]);
      }

      // 2. FALL BACK TO MULTI-LINE FORWARD SCAN ONLY IF NO VALUE FOUND ON SAME LINE
      if (value === null) {
        for (let j = i + 1; j <= i + 8 && j < lines.length; j++) {
          const scanLine = lines[j];
          if (isFootnoteLine(scanLine)) break;

          const normalizedScanLine = normalize(scanLine);

          const isDifferentLabel = Object.entries(BIOMARKER_ALIASES).some(([otherKey, aliases]) => {
            if (otherKey === canonicalKey) return false;
            return aliases.some(alias => {
              const normOtherAlias = normalize(alias);
              return fuzzyMatchLabel(normalizedScanLine, normOtherAlias, otherKey);
            });
          });

          if (isDifferentLabel) break;

          debugLines.push(scanLine);

          // Skip lines containing explicit reference headers or footnote numbering
          if (!/Normal:|Deficiency:|Page\s+\d+|Interpretation/i.test(scanLine) && !/^\d+\.\s/.test(scanLine.trim())) {
            // Clean out MC-10068 accreditation codes if present
            const cleanScanLine = scanLine.replace(/MC-\d+/g, '').replace(/\([^)]*\)/g, '');
            const numMatch = cleanScanLine.match(/(\d+(?:\.\d+)?)/);
            if (numMatch) {
              value = parseFloat(numMatch[1]);
              break;
            }
          }
        }
      }
    }

    const isMissingRange = (low === null && high === null);
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

  // Attach extracted patient metadata
  results.patientMeta = { age: extractedAge, sex: extractedSex };

  return results;
}
