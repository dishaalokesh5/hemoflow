import { BIOMARKER_ALIASES, normalize } from './reportFields.js';
import { REFERENCE_RANGES } from './referenceRanges.js';

const FOOTNOTE_PATTERNS = [
  /^note:/i,
  /^associated tests:/i,
  /reference interval as per/i,
  /^\*\*/,
  /^interpretation\b/i,
  /^references\b/i,
  /^deficiency\b/i,
  /^bullet\b/i,
  /^•/,
  /^\d+\.\s/,
  /clinical correlation/i,
  /parathyroid/i,
  /tietz textbook/i,
  /roche kit insert/i
];

const GENERIC_PREFIXES = ['serum', 'total', 'direct', 'indirect', 'blood', 'count'];

function isInterpretationOrFootnoteLine(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('•')) return true;
  return FOOTNOTE_PATTERNS.some(p => p.test(trimmed));
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function fuzzyMatchLabel(normalizedLine, alias, canonicalKey) {
  // Prevent matching plain word 'type' inside interpretation text for rh_type
  if (canonicalKey === 'rh_type') {
    if (!/\brh\b/i.test(normalizedLine)) return false;
  }

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

  // Strict check for Vitamin B12
  if (canonicalKey === 'vitamin_b12') {
    if (!/\b(b12|vit\s*b12|cobalamin)\b/i.test(normalizedLine)) {
      return false;
    }
  }

  // Prevent Vitamin D from matching unrelated lines
  if (canonicalKey === 'vitamin_d') {
    if (!/vitamin\s*d|vit\s*d|25\s*hydroxy/i.test(normalizedLine)) {
      return false;
    }
  }

  const allWords = alias.split(" ").filter(w => w.length >= 2);
  const keyWords = allWords.filter(w => !GENERIC_PREFIXES.includes(w));
  const wordsToMatch = keyWords.length > 0 ? keyWords : allWords;

  if (wordsToMatch.length === 0) {
    return new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i').test(normalizedLine);
  }

  const matchedWords = wordsToMatch.filter(w =>
    new RegExp(`\\b${escapeRegex(w)}\\b`, 'i').test(normalizedLine)
  );

  return matchedWords.length === wordsToMatch.length;
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

    if (isInterpretationOrFootnoteLine(line)) continue;

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
          if (isInterpretationOrFootnoteLine(scanLine)) break;

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

      // Remove explicit reference range labels & numerical range patterns
      lineTextAfterLabel = lineTextAfterLabel
        .replace(/(?:Normal|Deficiency|Prediabetes|Diabetic|Optimal|Borderline|High Risk)\s*[:\-]?\s*(?:>=|<=|<|>)?\s*\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?/gi, '')
        .replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/g, '');

      // Remove scientific exponent patterns, accreditation codes, method strings, and alias names
      lineTextAfterLabel = lineTextAfterLabel
        .replace(/10\^\d+/g, '')
        .replace(/MC-\d+/g, '')
        .replace(/Gen\d+/gi, '')
        .replace(/hba1c/i, '');

      const sameLineNumMatch = lineTextAfterLabel.match(/(\d+(?:\.\d+)?)/);
      if (sameLineNumMatch) {
        value = parseFloat(sameLineNumMatch[1]);
      }

      // 2. FALL BACK TO MULTI-LINE FORWARD SCAN ONLY IF NO VALUE FOUND ON SAME LINE
      if (value === null) {
        for (let j = i + 1; j <= i + 8 && j < lines.length; j++) {
          const scanLine = lines[j];
          if (isInterpretationOrFootnoteLine(scanLine)) break;

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

          // Clean reference ranges, accreditation codes, method names, and parenthetical text
          let cleanScanLine = scanLine
            .replace(/(?:Normal|Deficiency|Prediabetes|Diabetic|Optimal|Borderline|High Risk)\s*[:\-]?\s*(?:>=|<=|<|>)?\s*\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?/gi, '')
            .replace(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/g, '')
            .replace(/MC-\d+/g, '')
            .replace(/\([^)]*\)/g, '')
            .replace(/Gen\d+/gi, '')
            .replace(/hba1c/i, '');

          const numMatch = cleanScanLine.match(/(\d+(?:\.\d+)?)/);
          if (numMatch) {
            value = parseFloat(numMatch[1]);
            break;
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
